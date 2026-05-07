'use client';

import dynamic from 'next/dynamic';
import { useArenaRoom } from '@/game/useArenaRoom';
import Scoreboard from './Scoreboard';

const ArenaCanvas = dynamic(() => import('./ArenaCanvas'), {
  ssr: false,
  loading: () => (
    <div style={{ width: 700, height: 700, background: '#161b22', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b949e' }}>
      Carregando...
    </div>
  ),
});

export default function ArenaView() {
  const { snapshotRef, uiSnapshot, connected, error } = useArenaRoom();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px' }}>
        AI Battle Arena
      </h1>

      {error && (
        <div style={{ color: '#f85149', fontSize: 14, background: '#21262d', padding: '8px 16px', borderRadius: 6 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        <ArenaCanvas snapshotRef={snapshotRef} />
        <Scoreboard snapshot={uiSnapshot} connected={connected} />
      </div>

      <p style={{ color: '#8b949e', fontSize: 12 }}>
        {connected ? `Tick ${uiSnapshot.tickCount.toLocaleString('pt-BR')}` : 'Conectando ao servidor...'}
      </p>
    </div>
  );
}
