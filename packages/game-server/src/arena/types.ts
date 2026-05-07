import type { IsolateManager } from '../sandbox/IsolateManager.js';

export interface Vec2 {
  x: number;
  y: number;
}

export type ActionType =
  | 'andarFrente'
  | 'andarTras'
  | 'girarChassi'
  | 'girarTorre'
  | 'girarRadar'
  | 'atirar';

export interface Action {
  type: ActionType;
  value: number; // intensity/power/velocity depending on action
}

export interface Projectile {
  id: string;
  ownerTankId: string;
  ownerBotId: string;
  position: Vec2;
  angle: number;
  power: number;
  ticksAlive: number;
}

export interface TankRuntime {
  instanceId: string;
  botId: string;
  ownerId: string;
  ownerName: string;
  position: Vec2;
  velocity: Vec2;
  chassisAngle: number;
  turretAngle: number;
  radarAngle: number;
  hp: number;
  energy: number;
  shootCooldown: number;
  alive: boolean;
  respawnTicksRemaining: number;
  pendingActions: Action[];
  pendingEvents: BotEvent[];
  sandbox: IsolateManager;
}

// Events dispatched to bot handlers
export type BotEvent =
  | { type: 'onRadarInimigo'; tankId: string; distancia: number; angulo: number; vida: number }
  | { type: 'onTomeiTiro'; origemId: string; dano: number; anguloOrigem: number }
  | { type: 'onTiroAcertou'; tankId: string; dano: number }
  | { type: 'onColisaoParede'; angulo: number }
  | { type: 'onColisaoTanque'; tankId: string; angulo: number }
  | { type: 'onTick'; deltaT: number }
  | { type: 'onMorri'; quemMatou: string }
  | { type: 'onNasci' };

export interface RadarHit {
  tankId: string;
  distancia: number;
  angulo: number;
  vida: number;
}

export interface WallCollision {
  tankId: string;
  angulo: number;
}

export interface TankCollisionEvent {
  tankAId: string;
  tankBId: string;
  angulo: number;
}

export interface HitEvent {
  projectileId: string;
  tankId: string;
  ownerBotId: string;
  dano: number;
  anguloOrigem: number;
}
