import 'reflect-metadata';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { createServer } from 'http';
import express from 'express';
import { ArenaRoom, activeRoom } from './arena/ArenaRoom.js';
import { logger } from './util/logger.js';

const PORT = Number(process.env['PORT'] ?? 2567);

const app = express();
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

const httpServer = createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define('arena', ArenaRoom);

app.get('/api/snapshot', (_req, res) => {
  if (!activeRoom) {
    res.json({ tanks: [], projectiles: [], tickCount: 0 });
    return;
  }
  res.json({
    tanks: [...activeRoom.tanks.values()].map(t => ({
      instanceId: t.instanceId,
      botId: t.botId,
      ownerName: t.ownerName,
      x: t.position.x,
      y: t.position.y,
      chassisAngle: t.chassisAngle,
      turretAngle: t.turretAngle,
      radarAngle: t.radarAngle,
      hp: Math.max(0, t.hp),
      maxHp: 100,
      energy: t.energy,
      alive: t.alive,
    })),
    projectiles: activeRoom.projectiles.map(p => ({
      id: p.id,
      x: p.position.x,
      y: p.position.y,
      angle: p.angle,
    })),
    tickCount: activeRoom.state.tickCount,
  });
});

gameServer.listen(PORT).then(() => {
  logger.info({ port: PORT }, 'Game server ouvindo');
}).catch(err => {
  logger.error({ err }, 'Falha ao iniciar game server');
  process.exit(1);
});
