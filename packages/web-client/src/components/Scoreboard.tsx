import type { ArenaSnapshot } from '@/game/useArenaRoom';

const BOT_LABELS: Record<string, string> = { 'bot-a': 'Bot A', 'bot-b': 'Bot B' };
const BOT_COLORS: Record<string, string> = { 'bot-a': '#3b82f6', 'bot-b': '#ef4444' };

type Props = { snapshot: ArenaSnapshot; connected: boolean };

export default function Scoreboard({ snapshot, connected }: Props) {
  const tanks = [...snapshot.tanks.values()];

  return (
    <div style={{ width: 200, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: '#8b949e' }}>
        Placar
      </div>

      {!connected && (
        <div style={{ color: '#8b949e', fontSize: 13 }}>Conectando...</div>
      )}

      {tanks.map(t => {
        const color = BOT_COLORS[t.botId] ?? '#888';
        const hpRatio = Math.max(0, t.hp / t.maxHp);
        const hpColor = hpRatio > 0.5 ? '#22c55e' : hpRatio > 0.25 ? '#f59e0b' : '#ef4444';
        return (
          <div key={t.botId} style={{ background: '#161b22', borderRadius: 8, padding: '12px 14px', border: `1px solid ${t.alive ? color : '#30363d'}44` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontWeight: 600, fontSize: 14, color }}>{BOT_LABELS[t.botId] ?? t.botId}</span>
              <span style={{ fontSize: 11, color: t.alive ? '#22c55e' : '#ef4444', fontWeight: 500 }}>
                {t.alive ? 'vivo' : 'morto'}
              </span>
            </div>

            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8b949e', marginBottom: 3 }}>
                <span>HP</span><span>{Math.round(t.hp)} / {t.maxHp}</span>
              </div>
              <div style={{ background: '#21262d', borderRadius: 3, height: 6, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 3, width: `${hpRatio * 100}%`, background: hpColor, transition: 'width 0.1s' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8b949e', marginBottom: 3 }}>
                <span>Energia</span><span>{Math.round(t.energy)}</span>
              </div>
              <div style={{ background: '#21262d', borderRadius: 3, height: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 3, width: `${(t.energy / 100) * 100}%`, background: '#60a5fa', transition: 'width 0.1s' }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
