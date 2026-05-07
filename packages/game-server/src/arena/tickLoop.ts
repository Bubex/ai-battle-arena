import type { ArenaRoom } from './ArenaRoom.js';
import type { TankRuntime, Projectile, BotEvent } from './types.js';
import { applyActions, advanceTank, advanceProjectiles, resolveTankCollisions, resolveProjectileHits } from './physics.js';
import { detectRadar } from './radar.js';
import { buildEventsForTank } from './events.js';
import { ProjectileView } from './ArenaState.js';
import { TICK_MS, TICK_DURATION_WARN_MS, RESPAWN_TICKS, MAX_HP, MAX_ENERGY, ARENA_W, ARENA_H, TANK_RADIUS } from './constants.js';
import { logger } from '../util/logger.js';
import { nanoid } from '../util/nanoid.js';

export function startTickLoop(room: ArenaRoom): ReturnType<typeof setInterval> {
  return setInterval(() => runTick(room), TICK_MS);
}

function runTick(room: ArenaRoom): void {
  const start = process.hrtime.bigint();

  const { tanks, state } = room;
  const allTankList = [...tanks.values()];
  const aliveTanks = allTankList.filter(t => t.alive);
  const newProjectiles: Projectile[] = [];

  // Step 1: Dispatch pending events to sandboxes (accumulated from previous tick)
  for (const tank of aliveTanks) {
    for (const event of tank.pendingEvents) {
      dispatchEvent(tank, event);
    }
    tank.pendingEvents = [];
  }

  // Step 2: Drain actions and apply them (fire projectiles if requested)
  for (const tank of aliveTanks) {
    const actions = tank.sandbox.drainActions();
    const projectile = applyActions(tank, actions);
    if (projectile) newProjectiles.push(projectile);
  }

  // Step 3: Advance tank physics (movement + wall collision)
  const wallCollisions = new Map<string, ReturnType<typeof advanceTank>>();
  for (const tank of aliveTanks) {
    wallCollisions.set(tank.instanceId, advanceTank(tank));
  }

  // Step 4: Advance projectiles (move + detect out-of-bounds)
  const allProjectiles = [...room.projectiles, ...newProjectiles];
  const destroyedByWall = advanceProjectiles(allProjectiles);
  const destroyedByWallIds = new Set(destroyedByWall.map(p => p.id));

  // Step 5: Tank–tank collisions
  const tankCollisions = resolveTankCollisions(aliveTanks);

  // Step 6: Projectile–tank hits
  const activeProjectiles = allProjectiles.filter(p => !destroyedByWallIds.has(p.id));
  const { hits, destroyedProjectileIds } = resolveProjectileHits(activeProjectiles, allTankList);
  room.projectiles = activeProjectiles.filter(p => !destroyedProjectileIds.has(p.id));

  // Step 7: Radar scan → queue events for next tick
  for (const tank of aliveTanks) {
    const radarHits = detectRadar(tank, allTankList);
    const wallCol = wallCollisions.get(tank.instanceId) ?? null;
    const myTankCols = tankCollisions.filter(c => c.tankAId === tank.instanceId || c.tankBId === tank.instanceId);
    const myIncomingHits = hits.filter(h => h.tankId === tank.instanceId);
    const myOutgoingHits = hits.filter(h => h.ownerBotId === tank.botId && h.tankId !== tank.instanceId);

    tank.pendingEvents = buildEventsForTank(tank, {
      radarHits,
      wallCollision: wallCol,
      tankCollisions: myTankCols,
      incomingHits: myIncomingHits,
      outgoingHits: myOutgoingHits,
      deltaT: TICK_MS / 1000,
    });
  }

  // Step 8: Resolve deaths and schedule respawns
  for (const tank of allTankList) {
    if (tank.alive && tank.hp <= 0) {
      tank.alive = false;
      tank.respawnTicksRemaining = RESPAWN_TICKS;
      const killerHit = hits.find(h => h.tankId === tank.instanceId);
      const killerId = killerHit?.ownerBotId ?? 'arena';
      tank.pendingEvents.push({ type: 'onMorri', quemMatou: killerId });

      logger.info({ botId: tank.botId, killedBy: killerId }, 'Tank morreu');
    }

    if (!tank.alive && tank.respawnTicksRemaining > 0) {
      tank.respawnTicksRemaining--;
      if (tank.respawnTicksRemaining === 0) {
        respawnTank(tank);
        tank.pendingEvents.push({ type: 'onNasci' });
        logger.info({ botId: tank.botId }, 'Tank respawnou');
      }
    }
  }

  // Step 9: Sync Colyseus schema (delta encoded automatically by Colyseus)
  state.tickCount++;
  for (const tank of allTankList) {
    const view = state.tanks.get(tank.instanceId);
    if (!view) continue;
    view.x = tank.position.x;
    view.y = tank.position.y;
    view.chassisAngle = tank.chassisAngle;
    view.turretAngle = tank.turretAngle;
    view.radarAngle = tank.radarAngle;
    view.hp = Math.max(0, tank.hp);
    view.energy = tank.energy;
    view.alive = tank.alive;
  }

  state.projectiles.clear();
  for (const p of room.projectiles) {
    const view = new ProjectileView();
    view.id = p.id;
    view.x = p.position.x;
    view.y = p.position.y;
    view.angle = p.angle;
    state.projectiles.push(view);
  }

  // Step 10: Broadcast snapshot to spectators every 3 ticks (~20fps)
  if (state.tickCount % 3 === 0) {
    room.broadcast('s', {
      tanks: allTankList.map(t => ({
        instanceId: t.instanceId,
        botId: t.botId,
        ownerName: t.ownerName,
        x: t.position.x,
        y: t.position.y,
        chassisAngle: t.chassisAngle,
        turretAngle: t.turretAngle,
        hp: Math.max(0, t.hp),
        maxHp: 100,
        energy: t.energy,
        alive: t.alive,
      })),
      projectiles: room.projectiles.map(p => ({
        id: p.id,
        x: p.position.x,
        y: p.position.y,
        angle: p.angle,
      })),
      tickCount: state.tickCount,
    });
  }

  // Backpressure warning
  const elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000;
  if (elapsedMs > TICK_DURATION_WARN_MS) {
    logger.warn({ elapsedMs, tickCount: state.tickCount }, 'Tick lento (>16ms)');
  }

}

function dispatchEvent(tank: TankRuntime, event: BotEvent): void {
  switch (event.type) {
    case 'onTick':
      tank.sandbox.callHandlerSync('onTick', [event.deltaT]);
      break;
    case 'onRadarInimigo':
      tank.sandbox.callHandlerSync('onRadarInimigo', [event.tankId, event.distancia, event.angulo, event.vida]);
      break;
    case 'onTomeiTiro':
      tank.sandbox.callHandlerSync('onTomeiTiro', [event.origemId, event.dano, event.anguloOrigem]);
      break;
    case 'onTiroAcertou':
      tank.sandbox.callHandlerSync('onTiroAcertou', [event.tankId, event.dano]);
      break;
    case 'onColisaoParede':
      tank.sandbox.callHandlerSync('onColisaoParede', [event.angulo]);
      break;
    case 'onColisaoTanque':
      tank.sandbox.callHandlerSync('onColisaoTanque', [event.tankId, event.angulo]);
      break;
    case 'onMorri':
      tank.sandbox.callHandlerSync('onMorri', [event.quemMatou]);
      break;
    case 'onNasci':
      tank.sandbox.callHandlerSync('onNasci', []);
      break;
  }
}

function respawnTank(tank: TankRuntime): void {
  tank.alive = true;
  tank.hp = MAX_HP;
  tank.energy = MAX_ENERGY;
  tank.velocity = { x: 0, y: 0 };
  tank.shootCooldown = 0;
  tank.position = {
    x: TANK_RADIUS * 2 + Math.random() * (ARENA_W - TANK_RADIUS * 4),
    y: TANK_RADIUS * 2 + Math.random() * (ARENA_H - TANK_RADIUS * 4),
  };
}

export function createTankRuntime(
  botId: string,
  ownerId: string,
  ownerName: string,
  sandbox: import('../sandbox/IsolateManager.js').IsolateManager,
): TankRuntime {
  return {
    instanceId: nanoid(),
    botId,
    ownerId,
    ownerName,
    position: {
      x: TANK_RADIUS * 2 + Math.random() * (ARENA_W - TANK_RADIUS * 4),
      y: TANK_RADIUS * 2 + Math.random() * (ARENA_H - TANK_RADIUS * 4),
    },
    velocity: { x: 0, y: 0 },
    chassisAngle: Math.random() * Math.PI * 2,
    turretAngle: 0,
    radarAngle: 0,
    hp: MAX_HP,
    energy: MAX_ENERGY,
    shootCooldown: 0,
    alive: true,
    respawnTicksRemaining: 0,
    pendingActions: [],
    pendingEvents: [{ type: 'onNasci' }],
    sandbox,
  };
}
