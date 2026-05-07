import { describe, it, expect, beforeEach } from 'vitest';
import { advanceTank, advanceProjectiles, resolveTankCollisions, resolveProjectileHits, applyActions } from '../arena/physics.js';
import type { TankRuntime, Projectile } from '../arena/types.js';
import { ARENA_W, ARENA_H, TANK_RADIUS, MAX_HP, MAX_ENERGY, PROJECTILE_DAMAGE, COLLISION_DAMAGE } from '../arena/constants.js';
import { IsolateManager } from '../sandbox/IsolateManager.js';

function makeTank(overrides: Partial<TankRuntime> = {}): TankRuntime {
  const sandbox = new IsolateManager('test-bot');
  return {
    instanceId: 'tank-1',
    botId: 'bot-1',
    ownerId: 'owner-1',
    ownerName: 'Tester',
    position: { x: 500, y: 500 },
    velocity: { x: 0, y: 0 },
    chassisAngle: 0,
    turretAngle: 0,
    radarAngle: 0,
    hp: MAX_HP,
    energy: MAX_ENERGY,
    shootCooldown: 0,
    alive: true,
    respawnTicksRemaining: 0,
    pendingActions: [],
    pendingEvents: [],
    sandbox,
    ...overrides,
  };
}

function makeProjectile(overrides: Partial<Projectile> = {}): Projectile {
  return {
    id: 'proj-1',
    ownerTankId: 'tank-other',
    ownerBotId: 'bot-other',
    position: { x: 100, y: 100 },
    angle: 0,
    power: 1,
    ticksAlive: 0,
    ...overrides,
  };
}

describe('advanceTank', () => {
  it('move o tanque pela velocidade', () => {
    const tank = makeTank({ velocity: { x: 2, y: 1 } });
    advanceTank(tank);
    expect(tank.position.x).toBe(502);
    expect(tank.position.y).toBe(501);
  });

  it('clamp e zeroa velocidade ao bater na parede esquerda', () => {
    const tank = makeTank({ position: { x: TANK_RADIUS - 1, y: 500 }, velocity: { x: -5, y: 0 } });
    const col = advanceTank(tank);
    expect(tank.position.x).toBe(TANK_RADIUS);
    expect(tank.velocity.x).toBe(0);
    expect(col).not.toBeNull();
  });

  it('clamp ao bater na parede direita', () => {
    const tank = makeTank({ position: { x: ARENA_W - TANK_RADIUS + 1, y: 500 }, velocity: { x: 5, y: 0 } });
    advanceTank(tank);
    expect(tank.position.x).toBe(ARENA_W - TANK_RADIUS);
    expect(tank.velocity.x).toBe(0);
  });

  it('clamp ao bater no teto', () => {
    const tank = makeTank({ position: { x: 500, y: TANK_RADIUS - 1 }, velocity: { x: 0, y: -5 } });
    advanceTank(tank);
    expect(tank.position.y).toBe(TANK_RADIUS);
    expect(tank.velocity.y).toBe(0);
  });

  it('retorna null quando não há colisão com parede', () => {
    const tank = makeTank({ velocity: { x: 1, y: 0 } });
    const col = advanceTank(tank);
    expect(col).toBeNull();
  });

  it('regenera energia a cada tick', () => {
    const tank = makeTank({ energy: 10 });
    advanceTank(tank);
    expect(tank.energy).toBeGreaterThan(10);
  });
});

describe('advanceProjectiles', () => {
  it('remove projétil que sai pela direita', () => {
    const p = makeProjectile({ position: { x: ARENA_W - 1, y: 500 }, angle: 0 });
    const destroyed = advanceProjectiles([p]);
    expect(destroyed).toHaveLength(1);
    expect(destroyed[0]!.id).toBe('proj-1');
  });

  it('não remove projétil dentro dos limites', () => {
    const p = makeProjectile({ position: { x: 500, y: 500 }, angle: 0 });
    const destroyed = advanceProjectiles([p]);
    expect(destroyed).toHaveLength(0);
  });
});

describe('resolveTankCollisions', () => {
  it('aplica dano de colisão e empurra os tanques', () => {
    const a = makeTank({ instanceId: 'a', position: { x: 500, y: 500 } });
    const b = makeTank({ instanceId: 'b', position: { x: 510, y: 500 } }); // muito próximo

    const events = resolveTankCollisions([a, b]);

    expect(events.length).toBeGreaterThan(0);
    expect(a.hp).toBe(MAX_HP - COLLISION_DAMAGE);
    expect(b.hp).toBe(MAX_HP - COLLISION_DAMAGE);
    // Devem ter sido empurrados para longe
    expect(Math.abs(b.position.x - a.position.x) + Math.abs(b.position.y - a.position.y))
      .toBeGreaterThanOrEqual(TANK_RADIUS * 2);
  });

  it('não afeta tanques distantes', () => {
    const a = makeTank({ instanceId: 'a', position: { x: 100, y: 100 } });
    const b = makeTank({ instanceId: 'b', position: { x: 900, y: 900 } });

    const events = resolveTankCollisions([a, b]);
    expect(events).toHaveLength(0);
    expect(a.hp).toBe(MAX_HP);
  });
});

describe('resolveProjectileHits', () => {
  it('aplica dano ao tanque atingido e destrói o projétil', () => {
    const tank = makeTank({ instanceId: 't1', position: { x: 500, y: 500 } });
    const p = makeProjectile({ position: { x: 502, y: 500 }, power: 1 });

    const { hits, destroyedProjectileIds } = resolveProjectileHits([p], [tank]);

    expect(hits).toHaveLength(1);
    expect(tank.hp).toBe(MAX_HP - PROJECTILE_DAMAGE);
    expect(destroyedProjectileIds.has('proj-1')).toBe(true);
  });

  it('não aplica dano se o projétil é do próprio tanque', () => {
    const tank = makeTank({ instanceId: 't1', position: { x: 500, y: 500 } });
    const p = makeProjectile({ ownerTankId: 't1', position: { x: 502, y: 500 } });

    const { hits } = resolveProjectileHits([p], [tank]);
    expect(hits).toHaveLength(0);
    expect(tank.hp).toBe(MAX_HP);
  });

  it('não atinge tanque morto', () => {
    const tank = makeTank({ instanceId: 't1', position: { x: 500, y: 500 }, alive: false });
    const p = makeProjectile({ position: { x: 502, y: 500 } });

    const { hits } = resolveProjectileHits([p], [tank]);
    expect(hits).toHaveLength(0);
  });
});
