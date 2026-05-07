import type {
  TankRuntime, BotEvent, RadarHit, WallCollision, TankCollisionEvent, HitEvent,
} from './types.js';

export function buildEventsForTank(
  tank: TankRuntime,
  {
    radarHits,
    wallCollision,
    tankCollisions,
    incomingHits,
    outgoingHits,
    deltaT,
  }: {
    radarHits: RadarHit[];
    wallCollision: WallCollision | null;
    tankCollisions: TankCollisionEvent[];
    incomingHits: HitEvent[];
    outgoingHits: HitEvent[];
    deltaT: number;
  },
): BotEvent[] {
  const events: BotEvent[] = [];

  for (const hit of radarHits) {
    events.push({ type: 'onRadarInimigo', tankId: hit.tankId, distancia: hit.distancia, angulo: hit.angulo, vida: hit.vida });
  }

  if (wallCollision) {
    events.push({ type: 'onColisaoParede', angulo: wallCollision.angulo });
  }

  for (const col of tankCollisions) {
    const otherId = col.tankAId === tank.instanceId ? col.tankBId : col.tankAId;
    events.push({ type: 'onColisaoTanque', tankId: otherId, angulo: col.angulo });
  }

  for (const hit of incomingHits) {
    events.push({ type: 'onTomeiTiro', origemId: hit.ownerBotId, dano: hit.dano, anguloOrigem: hit.anguloOrigem });
  }

  for (const hit of outgoingHits) {
    events.push({ type: 'onTiroAcertou', tankId: hit.tankId, dano: hit.dano });
  }

  events.push({ type: 'onTick', deltaT });

  return events;
}
