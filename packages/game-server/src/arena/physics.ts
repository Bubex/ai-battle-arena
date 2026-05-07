import type { Action, TankRuntime, Projectile, WallCollision, TankCollisionEvent, HitEvent } from './types.js';
import {
  ARENA_W, ARENA_H, TANK_RADIUS, PROJECTILE_RADIUS,
  MAX_SPEED, MAX_ROTATE, PROJECTILE_SPEED,
  ENERGY_REGEN, MAX_ENERGY, FIRE_ENERGY_COST, FIRE_COOLDOWN_TICKS,
  PROJECTILE_DAMAGE, COLLISION_DAMAGE,
} from './constants.js';
import { nanoid } from '../util/nanoid.js';

export function applyActions(tank: TankRuntime, actions: Action[]): Projectile | null {
  let newProjectile: Projectile | null = null;

  for (const action of actions) {
    switch (action.type) {
      case 'andarFrente': {
        const speed = action.value * MAX_SPEED;
        tank.velocity.x = Math.cos(tank.chassisAngle) * speed;
        tank.velocity.y = Math.sin(tank.chassisAngle) * speed;
        break;
      }
      case 'andarTras': {
        const speed = action.value * MAX_SPEED;
        tank.velocity.x = -Math.cos(tank.chassisAngle) * speed;
        tank.velocity.y = -Math.sin(tank.chassisAngle) * speed;
        break;
      }
      case 'girarChassi':
        tank.chassisAngle += action.value * MAX_ROTATE;
        break;
      case 'girarTorre':
        tank.turretAngle += action.value * MAX_ROTATE;
        break;
      case 'girarRadar':
        tank.radarAngle += action.value * MAX_ROTATE;
        break;
      case 'atirar': {
        if (tank.shootCooldown > 0 || tank.energy < FIRE_ENERGY_COST * action.value) break;
        tank.energy -= FIRE_ENERGY_COST * action.value;
        tank.shootCooldown = FIRE_COOLDOWN_TICKS;
        newProjectile = {
          id: nanoid(),
          ownerTankId: tank.instanceId,
          ownerBotId: tank.botId,
          position: {
            x: tank.position.x + Math.cos(tank.turretAngle) * (TANK_RADIUS + PROJECTILE_RADIUS + 2),
            y: tank.position.y + Math.sin(tank.turretAngle) * (TANK_RADIUS + PROJECTILE_RADIUS + 2),
          },
          angle: tank.turretAngle,
          power: action.value,
          ticksAlive: 0,
        };
        break;
      }
    }
  }

  return newProjectile;
}

export function advanceTank(tank: TankRuntime): WallCollision | null {
  // Regenerate energy
  tank.energy = Math.min(MAX_ENERGY, tank.energy + ENERGY_REGEN);
  // Decrease shoot cooldown
  if (tank.shootCooldown > 0) tank.shootCooldown--;

  tank.position.x += tank.velocity.x;
  tank.position.y += tank.velocity.y;

  let wallAngle: number | null = null;

  if (tank.position.x - TANK_RADIUS < 0) {
    tank.position.x = TANK_RADIUS;
    tank.velocity.x = 0;
    wallAngle = Math.PI;
  } else if (tank.position.x + TANK_RADIUS > ARENA_W) {
    tank.position.x = ARENA_W - TANK_RADIUS;
    tank.velocity.x = 0;
    wallAngle = 0;
  }

  if (tank.position.y - TANK_RADIUS < 0) {
    tank.position.y = TANK_RADIUS;
    tank.velocity.y = 0;
    wallAngle = -Math.PI / 2;
  } else if (tank.position.y + TANK_RADIUS > ARENA_H) {
    tank.position.y = ARENA_H - TANK_RADIUS;
    tank.velocity.y = 0;
    wallAngle = Math.PI / 2;
  }

  if (wallAngle !== null) {
    return { tankId: tank.instanceId, angulo: wallAngle };
  }
  return null;
}

export function advanceProjectiles(projectiles: Projectile[]): Projectile[] {
  const destroyed: Projectile[] = [];
  for (const p of projectiles) {
    p.position.x += Math.cos(p.angle) * PROJECTILE_SPEED;
    p.position.y += Math.sin(p.angle) * PROJECTILE_SPEED;
    p.ticksAlive++;

    const outOfBounds =
      p.position.x < 0 || p.position.x > ARENA_W ||
      p.position.y < 0 || p.position.y > ARENA_H;

    if (outOfBounds) destroyed.push(p);
  }
  return destroyed;
}

export function resolveTankCollisions(tanks: TankRuntime[]): TankCollisionEvent[] {
  const events: TankCollisionEvent[] = [];
  const aliveTanks = tanks.filter(t => t.alive);

  for (let i = 0; i < aliveTanks.length; i++) {
    for (let j = i + 1; j < aliveTanks.length; j++) {
      const a = aliveTanks[i]!;
      const b = aliveTanks[j]!;
      const dx = b.position.x - a.position.x;
      const dy = b.position.y - a.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = TANK_RADIUS * 2;

      if (dist < minDist && dist > 0) {
        // Push apart
        const overlap = (minDist - dist) / 2;
        const nx = dx / dist;
        const ny = dy / dist;
        a.position.x -= nx * overlap;
        a.position.y -= ny * overlap;
        b.position.x += nx * overlap;
        b.position.y += ny * overlap;
        a.velocity.x = 0;
        a.velocity.y = 0;
        b.velocity.x = 0;
        b.velocity.y = 0;

        a.hp -= COLLISION_DAMAGE;
        b.hp -= COLLISION_DAMAGE;

        const angulo = Math.atan2(dy, dx);
        events.push({ tankAId: a.instanceId, tankBId: b.instanceId, angulo });
      }
    }
  }

  return events;
}

export function resolveProjectileHits(
  projectiles: Projectile[],
  tanks: TankRuntime[],
): { hits: HitEvent[]; destroyedProjectileIds: Set<string> } {
  const hits: HitEvent[] = [];
  const destroyedProjectileIds = new Set<string>();

  for (const p of projectiles) {
    if (destroyedProjectileIds.has(p.id)) continue;

    for (const tank of tanks) {
      if (!tank.alive) continue;
      if (tank.instanceId === p.ownerTankId) continue;

      const dx = tank.position.x - p.position.x;
      const dy = tank.position.y - p.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < TANK_RADIUS + PROJECTILE_RADIUS) {
        const dano = Math.round(PROJECTILE_DAMAGE * p.power);
        tank.hp -= dano;

        const anguloOrigem = Math.atan2(
          p.position.y - tank.position.y,
          p.position.x - tank.position.x,
        );

        hits.push({
          projectileId: p.id,
          tankId: tank.instanceId,
          ownerBotId: p.ownerBotId,
          dano,
          anguloOrigem,
        });

        destroyedProjectileIds.add(p.id);
        break;
      }
    }
  }

  return { hits, destroyedProjectileIds };
}
