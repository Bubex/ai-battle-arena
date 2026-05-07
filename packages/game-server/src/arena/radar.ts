import type { TankRuntime, RadarHit } from './types.js';
import { RADAR_RANGE, RADAR_CONE_RAD } from './constants.js';

function angleDiff(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

export function detectRadar(scanner: TankRuntime, targets: TankRuntime[]): RadarHit[] {
  const hits: RadarHit[] = [];

  for (const target of targets) {
    if (!target.alive) continue;
    if (target.instanceId === scanner.instanceId) continue;

    const dx = target.position.x - scanner.position.x;
    const dy = target.position.y - scanner.position.y;
    const distancia = Math.sqrt(dx * dx + dy * dy);

    if (distancia > RADAR_RANGE) continue;

    const angleToTarget = Math.atan2(dy, dx);
    if (angleDiff(angleToTarget, scanner.radarAngle) <= RADAR_CONE_RAD / 2) {
      hits.push({
        tankId: target.instanceId,
        distancia,
        angulo: angleToTarget,
        vida: target.hp,
      });
    }
  }

  return hits;
}
