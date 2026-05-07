import OpenAI from 'openai';
import * as acorn from 'acorn';

const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env['OPENROUTER_API_KEY'],
  defaultHeaders: {
    'HTTP-Referer': process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000',
    'X-Title': 'AI Battle Arena',
  },
});

const MODEL = process.env['OPENROUTER_MODEL'] ?? 'anthropic/claude-sonnet-4-5';
const MAX_TOKENS = 4096;
const MAX_CODE_BYTES = 16384;

export const SYSTEM_PROMPT = `Você é um especialista em programar bots para o jogo AI Battle Arena — arena 2D top-down com tanques autônomos.

Sua tarefa: converter a estratégia do jogador (em português) em código JavaScript que controla um tanque.

## Arena
- Campo 1000×1000. Ângulos em radianos: 0=direita, π/2=baixo, π=esquerda, -π/2=cima.
- Tanque: HP 100, energia 100 (regenera 0,5/tick). Raio 18.
- Tiro: custa power×20 de energia, causa power×15 de dano. Cooldown 30 ticks.
- Radar: cone 60°, alcance 400.

## API — handlers de evento
onNasci(fn)                               → nasceu/respawnou
onTick(fn(dt))                            → a cada tick (60/s), dt≈0.016
onRadarInimigo(fn(id, dist, ang, vida))   → inimigo detectado no cone do radar
onTomeiTiro(fn(origemId, dano, ang))      → recebeu dano
onTiroAcertou(fn(id, dano))              → acertou inimigo
onColisaoParede(fn(ang))                  → bateu na parede
onColisaoTanque(fn(id, ang))             → colidiu com outro tanque
onMorri(fn(quemMatou))                   → destruído

## API — ações (use dentro dos handlers)
andarFrente(v)   v∈[0,1]   andarTras(v)    v∈[0,1]
girarChassi(v)   v∈[-1,1]  girarTorre(v)   v∈[-1,1]  girarRadar(v)  v∈[-1,1]
atirar(poder)    poder∈[0,1]

## API — leitura de estado
selfPos()→{x,y}  selfChassisAngle()→rad  selfTurretAngle()→rad
selfHp()→0-100   selfEnergy()→0-100      print(msg)→debug

## Regras absolutas
- PROIBIDO: eval, Function, globalThis, require, import, process, __proto__, prototype, constructor
- Use var (não let/const)
- Sem classes ES6, sem módulos
- Máx 16KB

## Saída
SOMENTE o código JavaScript. Zero explicações, zero markdown, zero blocos de código.`;

export function validateGeneratedCode(code: string): { valid: boolean; reason?: string } {
  if (Buffer.byteLength(code, 'utf8') > MAX_CODE_BYTES) {
    return { valid: false, reason: `Código excede ${MAX_CODE_BYTES} bytes` };
  }
  try {
    (acorn as any).parse(code, { ecmaVersion: 2020 });
    return { valid: true };
  } catch (err) {
    return { valid: false, reason: err instanceof Error ? err.message : 'Erro de sintaxe' };
  }
}

export async function generateBotCode(
  userPrompt: string,
  previousAttempt?: { code: string; error: string },
): Promise<string> {
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'user', content: userPrompt },
  ];

  if (previousAttempt) {
    messages.push({ role: 'assistant', content: previousAttempt.code });
    messages.push({
      role: 'user',
      content: `O código anterior falhou na validação: ${previousAttempt.error}. Corrija e retorne apenas o código JavaScript corrigido.`,
    });
  }

  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
  });

  const content = response.choices[0]?.message?.content ?? '';
  // Remove blocos markdown se o modelo insistir em incluí-los
  return content.trim()
    .replace(/^```(?:javascript|js)?\n?/i, '')
    .replace(/\n?```$/i, '')
    .trim();
}
