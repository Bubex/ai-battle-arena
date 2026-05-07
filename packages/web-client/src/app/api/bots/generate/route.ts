import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { auth } from '@/lib/auth';
import { generateBotCode, validateGeneratedCode } from '@/lib/llm';
import { db, bot, promptCache } from '@arena/db';
import { eq, and, gte, count } from 'drizzle-orm';

const MAX_PROMPT_CHARS = 4000;
const DAILY_LIMIT = 10;

export async function POST(req: NextRequest) {
  // Auth
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  const userId = session.user.id;

  const body = await req.json();
  const { prompt, name } = body as { prompt?: string; name?: string };

  if (!prompt || prompt.trim().length < 10) {
    return NextResponse.json({ error: 'Prompt muito curto (mín. 10 caracteres)' }, { status: 400 });
  }
  if (prompt.length > MAX_PROMPT_CHARS) {
    return NextResponse.json({ error: `Prompt excede ${MAX_PROMPT_CHARS} caracteres` }, { status: 400 });
  }

  // Rate limit: 10 gerações por dia
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [{ value: todayCount }] = await db
    .select({ value: count() })
    .from(bot)
    .where(and(eq(bot.userId, userId), gte(bot.createdAt, since)));

  if (todayCount >= DAILY_LIMIT) {
    return NextResponse.json({ error: `Limite de ${DAILY_LIMIT} gerações por dia atingido` }, { status: 429 });
  }

  // Cache: hash do prompt normalizado
  const promptHash = createHash('sha256').update(prompt.trim().toLowerCase()).digest('hex');
  const cached = await db.query.promptCache.findFirst({ where: eq(promptCache.promptHash, promptHash) });

  let code: string;
  let fromCache = false;

  if (cached) {
    code = cached.code;
    fromCache = true;
  } else {
    // Geração LLM com retry único em falha de validação
    code = await generateBotCode(prompt);
    const validation = validateGeneratedCode(code);

    if (!validation.valid) {
      code = await generateBotCode(prompt, { code, error: validation.reason! });
      const retry = validateGeneratedCode(code);
      if (!retry.valid) {
        return NextResponse.json(
          { error: `Código gerado inválido após retry: ${retry.reason}` },
          { status: 422 },
        );
      }
    }

    // Salva no cache
    await db.insert(promptCache).values({
      id: crypto.randomUUID(),
      promptHash,
      code,
    }).onConflictDoNothing();
  }

  // Salva o bot do usuário
  const botId = crypto.randomUUID();
  await db.insert(bot).values({
    id: botId,
    userId,
    name: (name?.trim() || 'Meu Bot').slice(0, 60),
    prompt: prompt.trim(),
    code,
  });

  return NextResponse.json({ botId, code, fromCache });
}
