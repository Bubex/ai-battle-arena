import 'reflect-metadata';
import { Schema, MapSchema, ArraySchema, type } from '@colyseus/schema';

export class TankView extends Schema {
  @type('string') botId: string = '';
  @type('string') ownerName: string = '';
  @type('number') x: number = 0;
  @type('number') y: number = 0;
  @type('number') chassisAngle: number = 0;
  @type('number') turretAngle: number = 0;
  @type('number') radarAngle: number = 0;
  @type('number') hp: number = 0;
  @type('number') maxHp: number = 100;
  @type('number') energy: number = 0;
  @type('boolean') alive: boolean = true;
}

export class ProjectileView extends Schema {
  @type('string') id: string = '';
  @type('number') x: number = 0;
  @type('number') y: number = 0;
  @type('number') angle: number = 0;
}

export class ArenaState extends Schema {
  @type('number') tickCount: number = 0;
  @type({ map: TankView }) tanks = new MapSchema<TankView>();
  @type([ProjectileView]) projectiles = new ArraySchema<ProjectileView>();
}
