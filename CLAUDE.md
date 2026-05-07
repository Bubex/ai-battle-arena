# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

M1 complete. Game server is running with 2 autonomous bots in combat, 35 unit tests passing.

## Commands

```bash
# Run game server (always from packages/game-server/ dir, NOT from repo root)
cd packages/game-server
NODE_OPTIONS=--no-node-snapshot npx tsx src/main.ts

# Dev with hot-reload
pnpm --filter game-server dev

# Run all tests
pnpm test

# Run single test file
cd packages/game-server && npx vitest run src/__tests__/physics.test.ts
```

**Node version:** Must use Node 22 LTS (not 24). Node 24 is incompatible with isolated-vm due to C++20 issues. Use `nvm use 22` before running anything.

**Trigger room creation** (bots don't load until a client connects):
```bash
curl -X POST http://localhost:2567/matchmake/joinOrCreate/arena -H "Content-Type: application/json" -d '{}'
```

## What This Is

**AI Battle Arena** — a web multiplayer game where players describe bot strategy in Portuguese natural language, an LLM converts it to JavaScript, and autonomous tanks battle 24/7 in a 2D arena. Players watch in real time but don't control anything directly.

## Planned Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16.2 (React 19, Turbopack), PixiJS 8.18, colyseus.js 0.17, TypeScript 5 |
| Game server | Node.js 22 LTS, Colyseus 0.17 + @colyseus/ws-transport |
| Sandbox | isolated-vm 6.1.x (V8 Isolates) |
| API/Auth | Next.js App Router route handlers, BetterAuth |
| Database | PostgreSQL 16, Redis 7 |
| AI | Claude Sonnet (cheap model; cost is a hard constraint) |
| Infra | Railway (MVP), Pino logging, Sentry |

## Architecture

Three distinct tiers that must remain separate:

1. **Web client** (`web-client/`) — Next.js app. Visualization and prompt editor only. No game logic.
2. **Game server** (`game-server/`) — authoritative simulation. Colyseus rooms, 60-tick game loop, isolated-vm sandboxes, physics, radar.
3. **Persistence** — PostgreSQL (users, bots, prompts, kill events, prompt cache) + Redis (presence, real-time ranking, pub/sub).

### Game Server Internals (`game-server/src/`)

```
arena/          ArenaRoom.ts, tickLoop.ts, physics.ts, radar.ts, events.ts
sandbox/        IsolateManager.ts, api.ts, validation.ts, cpuBudget.ts
persistence/    botRepo.ts, killEventRepo.ts, rankingService.ts
util/           logger.ts, metrics.ts
```

**Tick loop sequence (60 Hz):** event dispatch → sandbox execution → physics → collision → radar detection → death resolution → state broadcast.

### Sandbox (Critical — Read This First)

Each tank owns a dedicated `ivm.Isolate` (8 MB memory limit). Bot code runs inside it per tick via `Reference.applySync()` with a **2ms CPU timeout** — hard kill, not a warning. Node.js startup flag `--no-node-snapshot` is required for isolated-vm.

**isolated-vm 6.x API pattern (differs from 4.x):** Host functions injected via `jail.setSync('name', fn)` become synchronous Callbacks automatically. For functions that return values, use `new ivm.Callback(fn)`. Handler registration uses a preamble string (isolate-side JS defining `onTick(fn) { _handlers.onTick = fn }`) — do NOT use `new ivm.Reference(fn)` for cross-boundary callbacks. Handler `Reference` objects are extracted after bot code runs with `getSync('_handlers', { reference: true })` + per-name `getSync(name, { reference: true })`, checking `ref.typeof === 'function'`.

Two-layer validation before any code runs in the arena:
1. **AST scan** (acorn/babel): rejects `eval`, `Function`, `globalThis`, `import`, `require`, prototype pollution, excessive nesting.
2. **Size limit:** 16 KB max per bot.

Bot API (Portuguese names — keep them): event handlers `onRadarInimigo`, `onTiroAcertou`, `onTomeiTiro`, `onColisaoParede`, `onColisaoTanque`, `onTick`, `onMorri`, `onNasci`; actions `andarFrente`, `andarTras`, `girarChassi`, `girarTorre`, `girarRadar`, `atirar`; state reads `selfPos`, `selfChassisAngle`, `selfHp`, `selfEnergy`; utility `print()`.

### Code Generation Pipeline

1. User submits Portuguese prompt (≤ 4000 chars)
2. Rate limit: 10 generations/day/user
3. Cache check: identical prompts deduped for 7 days across users (`prompt_cache` table)
4. LLM call: Claude Sonnet with ~2.5K token system prompt
5. AST + syntax validation; auto-retry once on failure
6. Persist to `prompts` table with token/model/status metadata

Target cost: < R$ 2/active user/month. Cache expected to absorb ~30% of calls.

### Ranking

Sorted by kills in the **last 24 hours** (sliding window, not cumulative). Top 100 public leaderboard. Updated every minute via cron. Kill events stored in `kill_events` table.

### Hot-Swap

Replace bot code on a live tank: 30s cooldown, 0.5s invulnerability window on swap, position/HP/energy preserved.

## Key Constraints

- **MVP scope:** single arena, ≤ 16 concurrent tanks, ≤ 3 tanks per user, no replays, no manual code editing, no ELO.
- **Sandbox escape is the #1 security risk.** Never weaken AST validation or raise the CPU budget without explicit justification.
- **LLM cost is load-bearing.** Don't switch to a more expensive model without updating the cost model in `sdd.md`.
- Bot API names are Portuguese by design — do not rename them to English.
- The game server is authoritative; clients are display-only. Never trust client state.
