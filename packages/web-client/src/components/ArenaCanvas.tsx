'use client';

import { useEffect, useRef, type RefObject } from 'react';
import type { ArenaSnapshot, TankSnapshot } from '@/game/useArenaRoom';

const DISPLAY = 700;
const S = DISPLAY / 1000;

// Tank geometry (in local pixels, before scaling)
const BODY_W  = 26 * S;
const BODY_H  = 36 * S;
const TRACK_W = 7  * S;
const TRACK_H = 38 * S;
const TURRET_R = 11 * S;
const BARREL_W =  5 * S;
const BARREL_H = 22 * S;
const RADAR_R  = 280 * S;  // visual range
const RADAR_CONE = Math.PI / 3;

type Colors = { body: number; track: number; turret: number; radar: number };

const PALETTE: Record<string, Colors> = {
  'bot-a': { body: 0x1d4ed8, track: 0x1e3a8a, turret: 0x3b82f6, radar: 0x60a5fa },
  'bot-b': { body: 0x991b1b, track: 0x7f1d1d, turret: 0xef4444, radar: 0xfca5a5 },
};
const DEFAULT_PALETTE: Colors = { body: 0x374151, track: 0x1f2937, turret: 0x6b7280, radar: 0x9ca3af };

function palette(botId: string): Colors { return PALETTE[botId] ?? DEFAULT_PALETTE; }

type Sprite = {
  container:      any;
  radarG:         any;
  chassisG:       any;
  turretContainer: any;
  hpBg:           any;
  hpFill:         any;
};

function buildChassis(g: any, c: Colors) {
  // Left track
  g.roundRect(-BODY_W / 2 - TRACK_W, -TRACK_H / 2, TRACK_W, TRACK_H, 2);
  g.fill({ color: c.track });
  // Right track
  g.roundRect(BODY_W / 2, -TRACK_H / 2, TRACK_W, TRACK_H, 2);
  g.fill({ color: c.track });
  // Track tread marks
  for (let i = 0; i < 6; i++) {
    const y = -TRACK_H / 2 + (TRACK_H / 6) * i + TRACK_H / 12;
    g.rect(-BODY_W / 2 - TRACK_W + 1, y - 1.5, TRACK_W - 2, 3);
    g.fill({ color: 0x000000, alpha: 0.25 });
    g.rect(BODY_W / 2 + 1, y - 1.5, TRACK_W - 2, 3);
    g.fill({ color: 0x000000, alpha: 0.25 });
  }
  // Body
  g.roundRect(-BODY_W / 2, -BODY_H / 2, BODY_W, BODY_H, 3);
  g.fill({ color: c.body });
  // Body highlight
  g.roundRect(-BODY_W / 2 + 3, -BODY_H / 2 + 3, BODY_W - 6, BODY_H / 2 - 4, 2);
  g.fill({ color: 0xffffff, alpha: 0.07 });
}

function buildTurret(g: any, c: Colors) {
  // Barrel
  g.roundRect(-BARREL_W / 2, -BARREL_H, BARREL_W, BARREL_H, 2);
  g.fill({ color: c.turret });
  // Turret circle
  g.circle(0, 0, TURRET_R);
  g.fill({ color: c.turret });
  // Highlight
  g.circle(-TURRET_R * 0.3, -TURRET_R * 0.3, TURRET_R * 0.35);
  g.fill({ color: 0xffffff, alpha: 0.18 });
}

function drawRadarCone(g: any, c: Colors) {
  g.clear();
  g.moveTo(0, 0);
  g.arc(0, 0, RADAR_R, -RADAR_CONE / 2, RADAR_CONE / 2);
  g.lineTo(0, 0);
  g.fill({ color: c.radar, alpha: 0.1 });
  // edge lines
  g.moveTo(0, 0);
  g.lineTo(Math.cos(-RADAR_CONE / 2) * RADAR_R, Math.sin(-RADAR_CONE / 2) * RADAR_R);
  g.stroke({ width: 1, color: c.radar, alpha: 0.35 });
  g.moveTo(0, 0);
  g.lineTo(Math.cos(RADAR_CONE / 2) * RADAR_R, Math.sin(RADAR_CONE / 2) * RADAR_R);
  g.stroke({ width: 1, color: c.radar, alpha: 0.35 });
}

function makeSprite(PIXI: any, stage: any, c: Colors): Sprite {
  const container = new PIXI.Container();
  stage.addChild(container);

  const radarG = new PIXI.Graphics();
  container.addChild(radarG);

  const chassisG = new PIXI.Graphics();
  buildChassis(chassisG, c);
  container.addChild(chassisG);

  const turretContainer = new PIXI.Container();
  const turretG = new PIXI.Graphics();
  buildTurret(turretG, c);
  turretContainer.addChild(turretG);
  container.addChild(turretContainer);

  const hpBg   = new PIXI.Graphics();
  const hpFill = new PIXI.Graphics();
  stage.addChild(hpBg);
  stage.addChild(hpFill);

  return { container, radarG, chassisG, turretContainer, hpBg, hpFill };
}

function updateSprite(sp: Sprite, t: TankSnapshot, c: Colors) {
  const sx = t.x * S, sy = t.y * S;
  sp.container.x = sx;
  sp.container.y = sy;
  sp.container.visible = true;

  // Chassis rotation: local "forward" is -Y, physics angle 0 = right → offset +π/2
  sp.chassisG.rotation      = t.chassisAngle + Math.PI / 2;
  sp.turretContainer.rotation = t.turretAngle  + Math.PI / 2;

  // Radar cone
  sp.radarG.rotation = t.radarAngle;
  drawRadarCone(sp.radarG, c);

  if (!t.alive) {
    sp.container.alpha = 0.3;
    sp.hpBg.visible   = false;
    sp.hpFill.visible = false;
    return;
  }
  sp.container.alpha = 1;

  // HP bar
  const bw = 46, bh = 5;
  const bx = sx - bw / 2, by = sy - TRACK_H / 2 - 13;
  const ratio = Math.max(0, t.hp / t.maxHp);
  const hpColor = ratio > 0.5 ? 0x22c55e : ratio > 0.25 ? 0xf59e0b : 0xef4444;

  sp.hpBg.clear();
  sp.hpBg.roundRect(bx - 1, by - 1, bw + 2, bh + 2, 2);
  sp.hpBg.fill({ color: 0x000000, alpha: 0.6 });
  sp.hpBg.roundRect(bx, by, bw, bh, 2);
  sp.hpBg.fill({ color: 0x21262d });
  sp.hpBg.visible = true;

  sp.hpFill.clear();
  if (ratio > 0) {
    sp.hpFill.roundRect(bx, by, bw * ratio, bh, 2);
    sp.hpFill.fill({ color: hpColor });
  }
  sp.hpFill.visible = true;
}

type Props = { snapshotRef: RefObject<ArenaSnapshot> };

export default function ArenaCanvas({ snapshotRef }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let app: any;
    let destroyed = false;
    const sprites = new Map<string, Sprite>();

    async function init() {
      const PIXI = await import('pixi.js');

      app = new PIXI.Application();
      await app.init({
        width: DISPLAY, height: DISPLAY,
        backgroundColor: 0x0d1117,
        antialias: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
      });
      if (destroyed) { app.destroy(true); return; }
      containerRef.current!.appendChild(app.canvas as HTMLCanvasElement);

      // Background grid
      const grid = new PIXI.Graphics();
      const GRID = 100 * S;
      for (let x = 0; x <= DISPLAY; x += GRID) {
        grid.moveTo(x, 0); grid.lineTo(x, DISPLAY);
        grid.stroke({ width: 0.5, color: 0x161b22 });
      }
      for (let y = 0; y <= DISPLAY; y += GRID) {
        grid.moveTo(0, y); grid.lineTo(DISPLAY, y);
        grid.stroke({ width: 0.5, color: 0x161b22 });
      }
      grid.rect(0, 0, DISPLAY, DISPLAY);
      grid.stroke({ width: 2, color: 0x30363d });
      app.stage.addChild(grid);

      // Projectile layer
      const projG = new PIXI.Graphics();
      app.stage.addChild(projG);

      app.ticker.add(() => {
        const { tanks, projectiles } = snapshotRef.current;

        // Update / create sprites
        const seen = new Set<string>();
        for (const [id, t] of tanks) {
          seen.add(id);
          if (!sprites.has(id)) {
            sprites.set(id, makeSprite(PIXI, app.stage, palette(t.botId)));
          }
          updateSprite(sprites.get(id)!, t, palette(t.botId));
        }
        // Remove stale sprites
        for (const [id, sp] of sprites) {
          if (!seen.has(id)) {
            app.stage.removeChild(sp.container, sp.hpBg, sp.hpFill);
            sprites.delete(id);
          }
        }

        // Projectiles
        projG.clear();
        for (const p of projectiles) {
          const px = p.x * S, py = p.y * S;
          projG.circle(px, py, 6);
          projG.fill({ color: 0xfde047, alpha: 0.25 });
          projG.circle(px, py, 3);
          projG.fill({ color: 0xfef9c3 });
        }
      });
    }

    init().catch(console.error);
    return () => {
      destroyed = true;
      app?.destroy(true, { children: true });
    };
  }, [snapshotRef]);

  return (
    <div
      ref={containerRef}
      style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #21262d', lineHeight: 0 }}
    />
  );
}
