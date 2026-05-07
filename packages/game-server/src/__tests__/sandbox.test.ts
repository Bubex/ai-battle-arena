import { describe, it, expect, afterEach } from 'vitest';
import { IsolateManager } from '../sandbox/IsolateManager.js';
import type { TankRuntime } from '../arena/types.js';
import { MAX_HP, MAX_ENERGY } from '../arena/constants.js';

function makeFakeTank(): TankRuntime {
  const sandbox = new IsolateManager('test-bot');
  return {
    instanceId: 'tank-test',
    botId: 'bot-test',
    ownerId: 'owner-test',
    ownerName: 'Tester',
    position: { x: 100, y: 200 },
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
  };
}

describe('IsolateManager', () => {
  const managers: IsolateManager[] = [];
  afterEach(() => {
    for (const m of managers) m.dispose();
    managers.length = 0;
  });

  it('enfileira ação andarFrente quando onTick é chamado', async () => {
    const tank = makeFakeTank();
    const mgr = tank.sandbox;
    managers.push(mgr);

    mgr.load(`
      onTick(function(dt) {
        andarFrente(0.75);
      });
    `, () => tank);

    mgr.callHandlerSync('onTick', [0.016]);
    const actions = mgr.drainActions();

    expect(actions[0]?.type).toBe('andarFrente');
    expect(actions[0]?.value).toBe(0.75);
  });

  it('passa deltaT corretamente para onTick', async () => {
    const tank = makeFakeTank();
    const mgr = tank.sandbox;
    managers.push(mgr);

    mgr.load(`
      onTick(function(dt) {
        andarFrente(dt);
      });
    `, () => tank);

    mgr.callHandlerSync('onTick', [0.016]);
    const actions = mgr.drainActions();

    expect(actions[0]?.value).toBeCloseTo(0.016);
  });

  it('não lança exceção quando handler não está registrado', async () => {
    const tank = makeFakeTank();
    const mgr = tank.sandbox;
    managers.push(mgr);

    mgr.load('// sem handlers', () => tank);
    expect(() => mgr.callHandlerSync('onTick', [0.016])).not.toThrow();
  });

  it('aborta handler com loop infinito após 2ms sem travar o processo', async () => {
    const tank = makeFakeTank();
    const mgr = tank.sandbox;
    managers.push(mgr);

    mgr.load(`
      onTick(function() {
        while (true) {}
      });
    `, () => tank);

    // Deve ser silencioso (timeout é capturado internamente)
    expect(() => mgr.callHandlerSync('onTick', [0.016])).not.toThrow();
  }, 5000);

  it('clamp valor de atirar para [0, 1]', async () => {
    const tank = makeFakeTank();
    const mgr = tank.sandbox;
    managers.push(mgr);

    mgr.load(`
      onTick(function() {
        atirar(99);
      });
    `, () => tank);

    mgr.callHandlerSync('onTick', [0.016]);
    const actions = mgr.drainActions();

    expect(actions[0]?.type).toBe('atirar');
    expect(actions[0]?.value).toBe(1);
  });

  it('lê hp do tanque via selfHp()', async () => {
    const tank = makeFakeTank();
    tank.hp = 42;
    const mgr = tank.sandbox;
    managers.push(mgr);

    let hpRead: number | null = null;
    mgr.load(`
      onTick(function() {
        var hp = selfHp();
        andarFrente(hp / 100);
      });
    `, () => tank);

    mgr.callHandlerSync('onTick', [0.016]);
    const actions = mgr.drainActions();

    // andarFrente(42/100) = 0.42
    expect(actions[0]?.value).toBeCloseTo(0.42);
  });

  it('isLoaded reflete estado do isolate', async () => {
    const tank = makeFakeTank();
    const mgr = tank.sandbox;

    mgr.load('onTick(function(){});', () => tank);
    expect(mgr.isLoaded).toBe(true);

    mgr.dispose();
    expect(mgr.isLoaded).toBe(false);
  });

  it('sobrevive a múltiplos ticks após timeout', async () => {
    const tank = makeFakeTank();
    const mgr = tank.sandbox;
    managers.push(mgr);

    let tick = 0;
    mgr.load(`
      var count = 0;
      onTick(function() {
        count++;
        if (count === 2) { while(true){} }
        andarFrente(count / 10);
      });
    `, () => tank);

    // Tick 1 — normal
    mgr.callHandlerSync('onTick', [0.016]);
    const t1 = mgr.drainActions();
    expect(t1[0]?.value).toBeCloseTo(0.1);

    // Tick 2 — timeout (silencioso)
    mgr.callHandlerSync('onTick', [0.016]);
    mgr.drainActions();

    // Tick 3 — volta a funcionar
    mgr.callHandlerSync('onTick', [0.016]);
    const t3 = mgr.drainActions();
    expect(t3[0]?.value).toBeCloseTo(0.3);
  }, 10000);
});
