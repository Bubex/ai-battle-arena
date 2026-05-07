import 'reflect-metadata';
import { Room, type Client } from '@colyseus/core';
import { ArenaState, TankView } from './ArenaState.js';
import type { TankRuntime, Projectile } from './types.js';
import { IsolateManager } from '../sandbox/IsolateManager.js';
import { validateBotCode } from '../sandbox/validation.js';
import { startTickLoop, createTankRuntime } from './tickLoop.js';
import { BOT_A_CODE, BOT_B_CODE } from './stubBots.js';
import { MAX_HP, MAX_ENERGY } from './constants.js';
import { logger } from '../util/logger.js';

export let activeRoom: ArenaRoom | null = null;

export class ArenaRoom extends Room<ArenaState> {
  tanks: Map<string, TankRuntime> = new Map();
  projectiles: Projectile[] = [];

  private tickInterval: ReturnType<typeof setInterval> | null = null;

  override onCreate(_options: unknown): void {
    this.autoDispose = false;
    this.setState(new ArenaState());
    this.addBot('bot-a', 'stub-owner-a', 'Bot A', BOT_A_CODE);
    this.addBot('bot-b', 'stub-owner-b', 'Bot B', BOT_B_CODE);
    this.tickInterval = startTickLoop(this);
    activeRoom = this;
    logger.info('ArenaRoom criada, 2 bots carregados, loop iniciado');
  }

  override onJoin(client: Client, _options: unknown): void {
    logger.info({ sessionId: client.sessionId }, 'Client conectou');
  }

  override onLeave(client: Client, _consented: boolean): void {
    logger.info({ sessionId: client.sessionId }, 'Client desconectou');
  }

  override onDispose(): void {
    if (this.tickInterval) clearInterval(this.tickInterval);
    for (const tank of this.tanks.values()) {
      tank.sandbox.dispose();
    }
    activeRoom = null;
    logger.info('ArenaRoom destruída');
  }

  addBot(botId: string, ownerId: string, ownerName: string, code: string): void {
    const validation = validateBotCode(code);
    if (!validation.valid) {
      logger.error({ botId, reason: validation.reason }, 'Código do bot inválido');
      return;
    }

    const sandbox = new IsolateManager(botId);
    const tank = createTankRuntime(botId, ownerId, ownerName, sandbox);
    sandbox.load(code, () => tank);

    this.tanks.set(tank.instanceId, tank);

    const view = new TankView();
    view.botId = botId;
    view.ownerName = ownerName;
    view.x = tank.position.x;
    view.y = tank.position.y;
    view.chassisAngle = tank.chassisAngle;
    view.turretAngle = tank.turretAngle;
    view.radarAngle = tank.radarAngle;
    view.hp = MAX_HP;
    view.maxHp = MAX_HP;
    view.energy = MAX_ENERGY;
    view.alive = true;

    this.state.tanks.set(tank.instanceId, view);
    logger.info({ botId, instanceId: tank.instanceId }, 'Bot adicionado à arena');
  }
}
