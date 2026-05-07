export const ARENA_W = 1000;
export const ARENA_H = 1000;

export const TANK_RADIUS = 18;
export const PROJECTILE_RADIUS = 4;
export const PROJECTILE_SPEED = 12;   // units/tick
export const MAX_SPEED = 3;            // units/tick forward/backward
export const MAX_ROTATE = 0.05;        // radians/tick for chassis/turret/radar

export const RADAR_RANGE = 400;
export const RADAR_CONE_RAD = Math.PI / 3; // 60°

export const MAX_HP = 100;
export const MAX_ENERGY = 100;
export const ENERGY_REGEN = 0.5;      // per tick
export const FIRE_ENERGY_COST = 20;   // * power
export const FIRE_COOLDOWN_TICKS = 30; // ~0.5s at 60tps
export const PROJECTILE_DAMAGE = 15;  // * power
export const COLLISION_DAMAGE = 3;
export const RESPAWN_TICKS = 600;     // 10s at 60tps

export const SANDBOX_MEMORY_MB = 8;
export const SANDBOX_CPU_MS = 2;
export const MAX_CODE_BYTES = 16_384; // 16KB

export const TICK_RATE = 60;
export const TICK_MS = 1000 / TICK_RATE;
export const TICK_DURATION_WARN_MS = 16;
