'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn } from '@/lib/auth-client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await signIn.email({ email, password });
    if (error) {
      setError(error.message ?? 'Erro ao entrar');
      setLoading(false);
    } else {
      router.push('/');
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>AI Battle Arena</h1>
        <p style={styles.subtitle}>Entre na sua conta</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            style={styles.input}
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoFocus
          />
          <input
            style={styles.input}
            type="password"
            placeholder="Senha"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          {error && <p style={styles.error}>{error}</p>}
          <button style={styles.button} type="submit" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p style={styles.footer}>
          Não tem conta?{' '}
          <Link href="/register" style={styles.link}>Criar conta</Link>
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0d1117',
  } as React.CSSProperties,
  card: {
    background: '#161b22',
    border: '1px solid #30363d',
    borderRadius: 12,
    padding: '40px 36px',
    width: 360,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  },
  title: { fontSize: 22, fontWeight: 700, color: '#e6edf3', textAlign: 'center' as const },
  subtitle: { fontSize: 14, color: '#8b949e', textAlign: 'center' as const, marginBottom: 8 },
  form: { display: 'flex', flexDirection: 'column' as const, gap: 12, marginTop: 8 },
  input: {
    background: '#0d1117',
    border: '1px solid #30363d',
    borderRadius: 6,
    padding: '10px 14px',
    color: '#e6edf3',
    fontSize: 14,
    outline: 'none',
  } as React.CSSProperties,
  error: { color: '#f85149', fontSize: 13, margin: 0 },
  button: {
    background: '#1f6feb',
    border: 'none',
    borderRadius: 6,
    color: '#fff',
    padding: '10px 0',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 4,
  } as React.CSSProperties,
  footer: { fontSize: 13, color: '#8b949e', textAlign: 'center' as const, marginTop: 8 },
  link: { color: '#58a6ff', textDecoration: 'none' },
};
