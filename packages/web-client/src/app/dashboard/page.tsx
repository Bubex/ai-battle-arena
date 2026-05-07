'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession, signOut } from '@/lib/auth-client';

const MAX_CHARS = 4000;

type GenerateResult = {
  botId: string;
  code: string;
  fromCache: boolean;
};

export default function DashboardPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  const [prompt, setPrompt] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isPending && !session) router.push('/login');
  }, [session, isPending, router]);

  if (isPending || !session) return null;

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/bots/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erro desconhecido');
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar bot');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.page}>
      {/* Header */}
      <header style={s.header}>
        <Link href="/" style={s.logo}>AI Battle Arena</Link>
        <div style={s.headerRight}>
          <span style={s.userName}>{session.user.name}</span>
          <button style={s.logoutBtn} onClick={() => signOut().then(() => router.push('/login'))}>
            Sair
          </button>
        </div>
      </header>

      <main style={s.main}>
        <div style={s.container}>
          <h1 style={s.title}>Criar Bot</h1>
          <p style={s.subtitle}>Descreva a estratégia do seu bot em português.</p>

          <form onSubmit={handleGenerate} style={s.form}>
            <div>
              <input
                style={s.input}
                type="text"
                placeholder="Nome do bot (ex: Atirador Furtivo)"
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={60}
              />
            </div>

            <div style={{ position: 'relative' }}>
              <textarea
                style={s.textarea}
                placeholder={`Descreva a estratégia... ex:\n"Meu bot deve patrulhar a arena em círculos, girar o radar constantemente e atirar com força máxima assim que detectar um inimigo. Quando bater em paredes, deve girar bruscamente e continuar andando."`}
                value={prompt}
                onChange={e => setPrompt(e.target.value.slice(0, MAX_CHARS))}
                rows={6}
                required
              />
              <span style={s.charCount}>{prompt.length}/{MAX_CHARS}</span>
            </div>

            {error && <div style={s.error}>{error}</div>}

            <button style={{ ...s.btn, opacity: loading ? 0.7 : 1 }} type="submit" disabled={loading}>
              {loading ? 'Gerando com Claude...' : 'Gerar Bot'}
            </button>
          </form>

          {result && (
            <div style={s.result}>
              <div style={s.resultHeader}>
                <span style={s.resultLabel}>
                  Código gerado {result.fromCache && <span style={s.cacheBadge}>cache</span>}
                </span>
                <span style={s.resultId}>Bot ID: {result.botId.slice(0, 8)}…</span>
              </div>
              <pre style={s.code}>{result.code}</pre>
              <p style={s.savedMsg}>Bot salvo com sucesso. Em breve você poderá ativá-lo na arena.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page:        { minHeight: '100vh', background: '#0d1117', color: '#e6edf3' },
  header:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', borderBottom: '1px solid #21262d' },
  logo:        { fontWeight: 700, fontSize: 18, color: '#e6edf3', textDecoration: 'none' },
  headerRight: { display: 'flex', alignItems: 'center', gap: 16 },
  userName:    { color: '#8b949e', fontSize: 14 },
  logoutBtn:   { background: 'none', border: '1px solid #30363d', borderRadius: 6, color: '#8b949e', padding: '5px 12px', cursor: 'pointer', fontSize: 13 },
  main:        { display: 'flex', justifyContent: 'center', padding: '40px 24px' },
  container:   { width: '100%', maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 20 },
  title:       { fontSize: 24, fontWeight: 700 },
  subtitle:    { color: '#8b949e', fontSize: 14, marginTop: -12 },
  form:        { display: 'flex', flexDirection: 'column', gap: 14 },
  input:       { width: '100%', background: '#161b22', border: '1px solid #30363d', borderRadius: 6, padding: '10px 14px', color: '#e6edf3', fontSize: 14, outline: 'none', boxSizing: 'border-box' },
  textarea:    { width: '100%', background: '#161b22', border: '1px solid #30363d', borderRadius: 6, padding: '12px 14px', color: '#e6edf3', fontSize: 14, outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.5 },
  charCount:   { position: 'absolute', bottom: 10, right: 12, fontSize: 11, color: '#8b949e' },
  error:       { background: '#21262d', border: '1px solid #f8514966', borderRadius: 6, padding: '10px 14px', color: '#f85149', fontSize: 13 },
  btn:         { background: '#1f6feb', border: 'none', borderRadius: 6, color: '#fff', padding: '11px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  result:      { background: '#161b22', border: '1px solid #30363d', borderRadius: 8, overflow: 'hidden' },
  resultHeader:{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #21262d' },
  resultLabel: { fontSize: 13, fontWeight: 600, color: '#8b949e', display: 'flex', alignItems: 'center', gap: 8 },
  cacheBadge:  { background: '#1f6feb33', color: '#58a6ff', borderRadius: 4, padding: '1px 6px', fontSize: 11, fontWeight: 500 },
  resultId:    { fontSize: 11, color: '#6e7681', fontFamily: 'monospace' },
  code:        { margin: 0, padding: '16px', overflowX: 'auto', fontSize: 12, lineHeight: 1.6, color: '#79c0ff', fontFamily: 'monospace', background: '#0d1117', maxHeight: 400, overflowY: 'auto' },
  savedMsg:    { padding: '12px 16px', fontSize: 12, color: '#3fb950', borderTop: '1px solid #21262d', margin: 0 },
};
