'use client';

import { useEffect, useRef, useState } from 'react';

export type TankSnapshot = {
  instanceId: string;
  botId: string;
  ownerName: string;
  x: number;
  y: number;
  chassisAngle: number;
  turretAngle: number;
  radarAngle: number;
  hp: number;
  maxHp: number;
  energy: number;
  alive: boolean;
};

export type ProjectileSnapshot = {
  id: string;
  x: number;
  y: number;
  angle: number;
};

export type ArenaSnapshot = {
  tanks: Map<string, TankSnapshot>;
  projectiles: ProjectileSnapshot[];
  tickCount: number;
};

function emptySnapshot(): ArenaSnapshot {
  return { tanks: new Map(), projectiles: [], tickCount: 0 };
}

const SNAPSHOT_URL = 'http://localhost:2567/api/snapshot';

export function useArenaRoom() {
  const snapshotRef = useRef<ArenaSnapshot>(emptySnapshot());
  const [uiSnapshot, setUiSnapshot] = useState<ArenaSnapshot>(emptySnapshot());
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let lastUiUpdate = 0;
    let running = true;

    async function poll() {
      while (running) {
        try {
          const res = await fetch(SNAPSHOT_URL);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();

          const tanks = new Map<string, TankSnapshot>();
          for (const t of data.tanks) tanks.set(t.instanceId, t);

          const snap: ArenaSnapshot = {
            tanks,
            projectiles: data.projectiles,
            tickCount: data.tickCount,
          };

          snapshotRef.current = snap;
          if (!connected) setConnected(true);
          setError(null);

          const now = Date.now();
          if (now - lastUiUpdate > 100) {
            lastUiUpdate = now;
            setUiSnapshot(snap);
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        }
        await new Promise(r => setTimeout(r, 50));
      }
    }

    poll();
    return () => { running = false; };
  }, []);

  return { snapshotRef, uiSnapshot, connected, error };
}
