import ivm from 'isolated-vm';
import type { Action, ActionType, TankRuntime } from '../arena/types.js';
import { MAX_ENERGY, MAX_SPEED, MAX_ROTATE } from '../arena/constants.js';
import { logger } from '../util/logger.js';

// Injected into the isolate as JS code — defines handler registration functions
// so bot code can call onTick(fn) without crossing the isolate boundary.
export const BOT_PREAMBLE = `
  var _handlers = {};
  function onTick(fn)           { _handlers.onTick = fn; }
  function onRadarInimigo(fn)   { _handlers.onRadarInimigo = fn; }
  function onTomeiTiro(fn)      { _handlers.onTomeiTiro = fn; }
  function onTiroAcertou(fn)    { _handlers.onTiroAcertou = fn; }
  function onColisaoParede(fn)  { _handlers.onColisaoParede = fn; }
  function onColisaoTanque(fn)  { _handlers.onColisaoTanque = fn; }
  function onMorri(fn)          { _handlers.onMorri = fn; }
  function onNasci(fn)          { _handlers.onNasci = fn; }
`;

export const HANDLER_NAMES = [
  'onTick', 'onRadarInimigo', 'onTomeiTiro', 'onTiroAcertou',
  'onColisaoParede', 'onColisaoTanque', 'onMorri', 'onNasci',
] as const;

export type HandlerName = typeof HANDLER_NAMES[number];

function clamp(v: number, min: number, max: number): number {
  return Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : min;
}

export function injectHostApi(
  jail: ivm.Reference,
  getTank: () => TankRuntime,
  pendingActions: Action[],
): void {
  function pushAction(type: ActionType, raw: number, min = 0, max = 1): void {
    pendingActions.push({ type, value: clamp(raw, min, max) });
  }

  // Actions — plain functions become sync Callbacks in isolated-vm 6.x (args auto-copied)
  jail.setSync('andarFrente', (v: number) => pushAction('andarFrente', v, 0, 1));
  jail.setSync('andarTras',   (v: number) => pushAction('andarTras', v, 0, 1));
  jail.setSync('girarChassi', (v: number) => pushAction('girarChassi', v, -1, 1));
  jail.setSync('girarTorre',  (v: number) => pushAction('girarTorre', v, -1, 1));
  jail.setSync('girarRadar',  (v: number) => pushAction('girarRadar', v, -1, 1));
  jail.setSync('atirar',      (v: number) => pushAction('atirar', v, 0, 1));

  // State reads — use ivm.Callback for return values (sync, args auto-copied)
  jail.setSync('selfPos',            new ivm.Callback(() => ({ x: getTank().position.x, y: getTank().position.y })));
  jail.setSync('selfHp',             new ivm.Callback(() => getTank().hp));
  jail.setSync('selfEnergy',         new ivm.Callback(() => getTank().energy));
  jail.setSync('selfMaxEnergy',      new ivm.Callback(() => MAX_ENERGY));
  jail.setSync('selfShootCooldown',  new ivm.Callback(() => getTank().shootCooldown));
  jail.setSync('selfChassisAngle',   new ivm.Callback(() => getTank().chassisAngle));
  jail.setSync('selfTurretAngle',    new ivm.Callback(() => getTank().turretAngle));
  jail.setSync('selfRadarAngle',     new ivm.Callback(() => getTank().radarAngle));
  jail.setSync('selfMaxSpeed',       new ivm.Callback(() => MAX_SPEED));
  jail.setSync('selfMaxRotate',      new ivm.Callback(() => MAX_ROTATE));

  // Utility
  jail.setSync('print', (...args: unknown[]) => {
    const tank = getTank();
    logger.info({ botId: tank.botId, msg: args.map(String).join(' ') }, '[bot]');
  });
}
