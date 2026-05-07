# SDD: Tank Arena

**Versão:** 0.2 (revisada após auditoria de versões em mai/2026)
**Autor:** Marlon
**Data:** 2026-05-06
**Status:** Em definição
**Documento de referência:** PRD Tank Arena 0.2

**Mudanças principais vs 0.1:**
- Sandbox de Lua (wasmoon) trocada para JavaScript em isolated-vm. wasmoon está parado há 2 anos com adoção marginal; isolated-vm é mantido ativamente, usado por Screeps e Cloudflare Workers em produção.
- Versões atualizadas para o estado em mai/2026: Next.js 16, Node.js 24 LTS, Colyseus 0.17, PixiJS 8.18.

---

## 1. Escopo deste documento

Este SDD descreve a arquitetura técnica, decisões de stack, modelos de dados, protocolos de comunicação e estratégia de sandbox para o MVP do Tank Arena. Não cobre operação de produção em escala (runbooks, alertas, escalabilidade horizontal além do MVP), que ficará em documento separado quando houver tráfego real.

## 2. Visão arquitetural

O sistema é composto por três planos:

1. **Plano de apresentação** (cliente web): renderiza estado, captura input do jogador para edição de bot.
2. **Plano de simulação** (game server): autoritativo sobre o estado da arena, executa loop de física a 60 ticks/s, executa o código JavaScript dos bots em sandbox.
3. **Plano de persistência** (banco e cache): armazena contas, prompts, código, ranking acumulado.

A escolha por servidor autoritativo é não-negociável: como o código do jogador roda no servidor (não no cliente), o cliente é puramente um terminal de visualização e edição. Isso simplifica anti-cheat e permite que tanques continuem ativos com o jogador offline.

### Diagrama de componentes

```
[Cliente Next.js 16]
  - Lobby, ranking, editor de prompt (HTTP/REST)
  - Arena viewer (PixiJS 8) (WebSocket via Colyseus.js 0.17)
       |
       | WebSocket (Colyseus)        HTTP (Next.js Route Handlers)
       v                              v
[Game Server (Node 24 + Colyseus 0.17)]   [API Server (Next.js 16)]
  - Sala "arena" persistente               - Auth (BetterAuth)
  - Loop de fisica 60tps                   - Geracao de JS (chama LLM)
  - Sandbox isolated-vm 6.x                - Validacao estatica do JS
  - Estado autoritativo                    - CRUD de bots/prompts
       |                                        |
       +----------+-----------+-----------+-----+
                  |           |
                  v           v
            [PostgreSQL 16]   [Redis 7]
            - contas       - presenca
            - bots         - cache de prompts
            - prompts      - ranking 24h (sorted set com timestamps)
            - rankings     - pub/sub entre processos
```

## 3. Decisões técnicas

### 3.1 Stack escolhido

Versões verificadas em maio de 2026.

| Camada | Tecnologia | Versão alvo | Justificativa |
|---|---|---|---|
| Cliente UI | Next.js | 16.2 | LTS atual; React 19 nativo; Turbopack estável |
| Cliente render | PixiJS | 8.18 | 2D performático com WebGL e WebGPU; Canvas fallback experimental |
| Cliente realtime | colyseus.js | 0.17 (parte do monorepo Colyseus) | Pareia com servidor; auto-reconnect novo na 0.17 |
| Game server | Node.js | 24 LTS ("Krypton") | LTS ativo; suporte até abril/2028 |
| Framework game server | Colyseus | 0.17 | API `defineServer` unificada, auto-reconnect, Express 5 |
| Sandbox JS | isolated-vm | 6.1.x | V8 Isolates, mesma tecnologia de Screeps e Cloudflare Workers |
| Auth | BetterAuth | última stable | Stack do autor |
| LLM | Claude Sonnet (barato) padrão | Claude Sonnet 4.7 ou superior | Custo aceitável, qualidade alta em JS |
| Banco principal | PostgreSQL | 16 | Stack do autor |
| Cache/Pubsub | Redis | 7 | Presença, ranking incremental, pub/sub |
| Linguagem | TypeScript | 5.x stable | Padrão do ecossistema |
| Deploy MVP | Railway | atual | MVP. Plano de migração para Fly.io ou VPS quando >100 CCU |
| Observabilidade | Sentry + pino | últimas stable | Padrão suficiente pro MVP |

### 3.2 Decisões rejeitadas e por quê

- **Lua via wasmoon** rejeitado: lib parada há 2 anos, ~700 downloads semanais, sem manutenção visível. Risco inaceitável para a peça mais sensível do sistema.
- **vm2** rejeitado: maintainer admite "novos bypasses serão descobertos". CVE crítico CVE-2026-22709 (CVSS 9.8) em janeiro/2026. Recomendação oficial é migrar para isolated-vm.
- **Phaser** rejeitado: servidor autoritativo dispensa engine completo no cliente. PixiJS é mais leve.
- **Hathora/PlayFab** rejeitado: custo e dependência de fornecedor para MVP.
- **Servidor em Go ou Rust** considerado: melhor performance, mas autor tem stack TypeScript/Node, e o gargalo é o sandbox, não o engine.
- **WebSocket cru** rejeitado: reescrever sync de estado, salas e reconexão é desperdício para MVP.
- **MicroVMs (Firecracker, E2B, Daytona)** considerado: padrão da indústria para código de LLM, **mas inviável por tick**. Latência de 150ms para subir uma microVM é maior que o tick inteiro (16ms). Mantemos isolated-vm com isolate persistente por tanque.
- **Cloudflare Dynamic Workers** considerado: sandbox novo (lançado 2026) alinhado com o caso de uso, mas amarra a infra ao Cloudflare e tem cold starts incompatíveis com 60tps.
- **Bun** considerado como runtime: Colyseus suporta via `@colyseus/bun-websockets`, mas isolated-vm precisa do V8 nativo (Node).

### 3.3 Decisões pendentes (resolver antes da implementação)

- Modelo LLM exato (Sonnet barato vs GPT-4o-mini): testes A/B com 50 prompts reais para escolher o mais econômico que atende a meta de 80% de geração válida.
- Quantidade de game servers em paralelo no MVP (provavelmente um, com Redis presence preparado para escalar).
- TypeScript ou JavaScript puro como linguagem do bot? TypeScript no LLM gera código mais robusto, mas precisa transpilação. JS puro evita esse passo. Avaliar no protótipo.

## 4. Modelo de domínio

### 4.1 Entidades principais

```
User
  id (uuid)
  email
  name
  created_at
  daily_generation_count (reset diario)

Bot
  id (uuid)
  user_id (fk)
  name
  current_prompt_id (fk)
  current_code (text, JS)
  current_code_hash
  status (idle | active | dead | retired)
  created_at
  last_active_at

Prompt
  id (uuid)
  bot_id (fk)
  prompt_text
  generated_code
  generation_status (success | validation_failed | llm_error)
  validation_errors (jsonb, nullable)
  llm_model_used
  llm_tokens_in
  llm_tokens_out
  created_at

TankInstance (volatil, pode estar so em memoria + snapshot Redis)
  id (uuid, ephemeral)
  bot_id (fk)
  arena_id
  position { x, y }
  chassis_angle
  turret_angle
  radar_angle
  hp
  energy
  shoot_cooldown
  spawned_at
  last_action_at

KillEvent (auditoria e ranking)
  id (uuid)
  killer_bot_id (fk)
  victim_bot_id (fk)
  arena_id
  occurred_at
  killer_tank_lifetime_ms
  weapon_power
```

### 4.2 Estado de runtime na arena (memória + Redis)

Em memória do game server (autoritativo):

```ts
interface ArenaState {
  arenaId: string;
  tanks: Map<string, TankRuntime>;
  projectiles: Projectile[];
  obstacles: Obstacle[]; // estatico, carregado no boot
  tickCount: number;
}

interface TankRuntime {
  tankInstanceId: string;
  botId: string;
  ownerId: string;
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  chassisAngle: number;
  turretAngle: number;
  radarAngle: number;
  hp: number;
  energy: number;
  shootCooldown: number;
  isolate: ivm.Isolate;        // isolated-vm Isolate
  context: ivm.Context;        // contexto ativo
  pendingActions: Action[];
  cpuTimeUsedThisTick: bigint; // em nanossegundos
}
```

## 5. Loop do game server

O coração do sistema é o loop autoritativo. Roda a 60 ticks por segundo (16.67ms por tick).

### 5.1 Sequência de um tick

1. **Coleta de eventos do tick anterior**: colisões, detecções de radar, tiros que acertaram, danos recebidos.
2. **Para cada tanque:**
   - Despachar eventos relevantes para o sandbox (chama os handlers registrados pelo bot).
   - Sandbox processa eventos e enfileira ações na fila do tanque (`pendingActions`).
   - Engine valida e aplica as ações (respeitando cooldowns, energia disponível, etc).
3. **Avançar física** (movimento, rotações, projéteis).
4. **Detectar colisões e interseções** (tanque-parede, tanque-tanque, projétil-tanque, projétil-parede).
5. **Detectar radar:** para cada tanque, calcular o cone e identificar entidades dentro. Gera eventos para o próximo tick.
6. **Resolver mortes:** tanques com HP <= 0 viram mortos, agendar respawn em 10s, registrar `KillEvent`.
7. **Snapshot do estado** para o broadcast Colyseus (delta-encoded automaticamente).
8. **Atualizar ranking incremental** no Redis (sorted set com timestamps para janela móvel de 24h).

### 5.2 Garantias do tick

- **Determinismo dentro de um tick:** ordem de processamento é fixa (por `tankInstanceId` ascendente).
- **Isolamento por tanque:** se o sandbox de um tanque trava ou estoura orçamento, apenas aquele tanque perde o tick.
- **Backpressure:** se o tick custar mais de 16ms, o servidor loga warning. Tickrate efetivo cai mas não trava.

### 5.3 Estrutura de código

```
game-server/
  src/
    main.ts                    # bootstrap, defineServer
    arena/
      ArenaRoom.ts             # Colyseus Room (API 0.17)
      ArenaState.ts            # Schema sincronizado
      tickLoop.ts              # loop principal
      physics.ts               # movimento, colisao, vetores
      radar.ts                 # deteccao de cone
      events.ts                # geracao e dispatch
    sandbox/
      IsolateManager.ts        # wrapper isolated-vm
      api.ts                   # API exposta ao bot (registrarHandler etc)
      validation.ts            # parser AST, blacklist
      cpuBudget.ts             # tracking de CPU time por tanque
    persistence/
      botRepo.ts
      killEventRepo.ts
      rankingService.ts
    util/
      logger.ts                # pino
      metrics.ts
```

## 6. Sandbox JavaScript

Componente mais sensível do sistema. Decisão arquitetural reformulada da v0.1: usamos isolated-vm com isolate persistente por tanque.

### 6.1 Modelo de execução

Cada tanque tem um `ivm.Isolate` próprio. O ciclo de vida é:

1. **Criar isolate:** quando o tanque entra na arena, cria um `Isolate` com limite de memória (8 MB) e um `Context` com a API exposta.
2. **Carregar código:** o JavaScript validado é compilado dentro do isolate como `Script` e executado uma vez para registrar handlers.
3. **Executar handlers:** a cada tick, eventos pendentes invocam os handlers via `Reference.apply()` com timeout em CPU time.
4. **Encerrar:** quando o tanque é removido ou hot-swap acontece, `isolate.dispose()` libera tudo.

isolated-vm é a tecnologia que Screeps usa em produção para rodar código JavaScript de jogadores por dias seguidos. É o caso de uso mais próximo do nosso.

### 6.2 API JavaScript exposta

O bot tem acesso a:

```javascript
// Registro de handlers
onRadarInimigo((tanqueId, distancia, angulo, vida) => { ... })
onRadarParede((distancia, angulo) => { ... })
onTiroAcertou((tanqueId, dano) => { ... })
onTomeiTiro((origemId, dano, anguloOrigem) => { ... })
onColisaoParede((angulo) => { ... })
onColisaoTanque((tanqueId, angulo) => { ... })
onTick((deltaT) => { ... })
onMorri((quemMatou) => { ... })
onNasci(() => { ... })

// Acoes (enfileiram para o engine aplicar)
andarFrente(intensidade)         // 0 a 1
andarTras(intensidade)
girarChassi(velocidade)          // -1 a 1
girarTorre(velocidade)
girarRadar(velocidade)
atirar(potencia)                 // 0 a 1, consome energia

// Leitura de estado (do proprio tanque)
selfPos()                        // retorna { x, y }
selfChassisAngle()
selfTurretAngle()
selfRadarAngle()
selfHp()
selfEnergy()
selfShootCooldown()

// Utilitario
print(...args)                   // exibe na HUD do dono
Math.* (apenas funcoes puras, isolate ja remove o resto)

// BLOQUEADO (nao existe dentro do isolate por padrao)
// Sem fetch, XMLHttpRequest, WebSocket, fs, process, require, import,
// eval, Function, setTimeout, setInterval. O isolate nao tem nenhum
// desses globais a menos que sejam injetados explicitamente.
```

### 6.3 Sandbox via isolated-vm

isolated-vm cria um V8 Isolate completamente separado do isolate do Node. Garantias:

- **Memória isolada:** o código não pode acessar o heap do Node.
- **API explícita:** apenas o que for transferido via `Reference` ou `ExternalCopy` é visível.
- **Limite de memória:** definido na criação do isolate (8 MB por tanque).
- **Limite de CPU:** mensurável via `Isolate.cpuTime` e `Isolate.wallTime`. `Reference.apply()` aceita `timeout` em ms que mata a execução se estourar.

### 6.4 Validação estática (antes de executar)

Antes de carregar o código no isolate, o servidor:

1. **Parser:** `acorn` ou `@babel/parser` para validar sintaxe e gerar AST.
2. **AST scan:** percorre a AST procurando:
   - Identifiers proibidos (`eval`, `Function`, `globalThis`, `import`, `require`)
   - Member expressions suspeitas (`constructor.constructor`, `__proto__`)
   - Statements proibidos (`with`, `import()`)
   - Loops aninhados além de profundidade 4 (heurística contra DoS)
3. **Tamanho:** rejeita código maior que 16KB.

Se qualquer checagem falhar, retorna erro sem nunca carregar no isolate. A validação é defesa em profundidade: mesmo que o LLM gere algo malicioso, o AST scan barra antes de chegar ao isolate.

### 6.5 Orçamento de CPU por tick

- Cada tanque tem orçamento de **2ms de CPU por tick** (medido por `isolate.cpuTime`).
- O budget é "recarregado" no início de cada tick.
- Cada chamada de handler usa `Reference.apply(undefined, args, { timeout: 2 })` com timeout de 2ms wall clock.
- Se o handler estoura timeout, isolated-vm mata a execução e marca o isolate como "travado naquele tick". Próximo tick continua normal.
- Estouros repetidos viram penalidade visível na HUD ("tanque travado por excesso de código").

### 6.6 Hot-swap

Sequência:

1. Recebe novo código validado.
2. Chama `isolate.dispose()` no isolate antigo.
3. Cria novo `Isolate` + `Context`, injeta API.
4. Compila e executa o novo código (registra novos handlers).
5. Retoma o tick. Tudo isso em sub-segundo.

Posição, vida, energia ficam em variáveis do engine (fora do isolate), então sobrevivem.

## 7. Pipeline de geração de código a partir do prompt

### 7.1 Fluxo

1. Usuário submete prompt no editor.
2. Backend Next.js recebe via Route Handler `POST /api/bots/[id]/generate`.
3. Verifica rate limit (10/dia/usuário).
4. Verifica cache: se o prompt textual já foi processado nos últimos 7 dias e gerou código válido, retorna cache.
5. Monta a chamada ao LLM com o system prompt fixo (especificação completa da API JavaScript).
6. Chama o LLM. Espera resposta com código dentro de bloco ```javascript ... ```.
7. Extrai o código, passa pela validação estática (seção 6.4).
8. Se válido, persiste em `Prompt`, atualiza `Bot.current_code`.
9. Se inválido, faz uma segunda tentativa com mensagem adicional explicando o erro.
10. Se a segunda também falha, retorna erro ao usuário com explicação amigável.

### 7.2 System prompt do LLM

O system prompt é versionado (importante para reproducibilidade) e contém:

- Descrição do jogo e mecânicas
- Especificação completa da API JavaScript (mesma da seção 6.2)
- Lista de construções proibidas
- Exemplos de bons bots (3 a 5 exemplos)
- Restrições de tamanho e estilo (sem comentários longos, sem código morto)
- Instrução de retornar apenas o código dentro de ```javascript ... ```

Tamanho estimado: 2 a 3 mil tokens. É enviado em todas as gerações.

### 7.3 Cache de prompts idênticos

Tabela `prompt_cache` com chave (hash do prompt + versão do system prompt + modelo LLM). Se o mesmo prompt foi gerado por outro usuário em até 7 dias, retorna o código cacheado. Reduz custo de LLM em ~30% estimado.

### 7.4 Custos estimados

Por geração com Sonnet barato (preços de referência):
- System prompt: ~2.5K tokens entrada
- Prompt do usuário: ~200 tokens entrada
- Resposta: ~800 tokens saída
- Custo aproximado: US$ 0.005 a 0.010 por geração

Com 10 gerações/dia/usuário no pior caso: US$ 0.05 a 0.10/dia/usuário, ou US$ 1.50 a 3.00/mês. Acima da meta de R$ 2/mês mas próximo. Cache reduz mais. Vai precisar monitorar e ajustar.

Modelo Sonnet completo só em retentativas após validação falhar (caso raro com sandbox de JS).

## 8. Comunicação cliente-servidor

### 8.1 Canais

- **HTTP (Next.js Route Handlers do App Router):** ações fora da arena (login, geração de bot, listagem de ranking, perfil).
- **WebSocket (Colyseus):** estado em tempo real da arena.

### 8.2 Schema sincronizado (Colyseus 0.17)

Colyseus 0.17 mudou o tipo genérico de `Room<State, Metadata>` para `Room<{ state?, metadata?, client? }>`. Schema continua igual.

```ts
class ArenaState extends Schema {
  @type("number") tickCount: number;
  @type({ map: TankView }) tanks = new MapSchema<TankView>();
  @type([ProjectileView]) projectiles = new ArraySchema<ProjectileView>();
}

class TankView extends Schema {
  @type("string") botId: string;
  @type("string") ownerName: string;
  @type("number") x: number;
  @type("number") y: number;
  @type("number") chassisAngle: number;
  @type("number") turretAngle: number;
  @type("number") radarAngle: number;
  @type("number") hp: number;
  @type("number") maxHp: number;
  @type("boolean") alive: boolean;
}

class ProjectileView extends Schema {
  @type("string") id: string;
  @type("number") x: number;
  @type("number") y: number;
  @type("number") angle: number;
}
```

Colyseus faz delta encoding automaticamente.

### 8.3 Mensagens do cliente para o servidor

Mínimas. Apenas:
- `subscribeCamera(botId)`: muda o foco da câmera.
- `requestChatLog(botId)`: pede log recente do bot do jogador.

O cliente nunca envia ações do tanque. Ações vêm exclusivamente do sandbox.

### 8.4 Reconexão

Colyseus 0.17 traz `onDrop()` e `onReconnect()` no servidor e cliente. Configuração:
- `await this.allowReconnection(client, 60)` no `onDrop`.
- Cliente reconecta automaticamente preservando callbacks e listeners.

Se passa de 60s, é uma nova sessão (mas o tanque do jogador segue na arena).

## 9. Persistência

### 9.1 PostgreSQL: schemas principais

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  daily_generation_count INT DEFAULT 0,
  daily_generation_reset_at TIMESTAMP
);

CREATE TABLE bots (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  name VARCHAR(50),
  current_prompt_id UUID,
  current_code TEXT,
  current_code_hash VARCHAR(64),
  status VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW(),
  last_active_at TIMESTAMP
);

CREATE TABLE prompts (
  id UUID PRIMARY KEY,
  bot_id UUID REFERENCES bots(id),
  prompt_text TEXT NOT NULL,
  generated_code TEXT,
  generation_status VARCHAR(20),
  validation_errors JSONB,
  llm_model_used VARCHAR(50),
  llm_tokens_in INT,
  llm_tokens_out INT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE kill_events (
  id UUID PRIMARY KEY,
  killer_bot_id UUID REFERENCES bots(id),
  victim_bot_id UUID REFERENCES bots(id),
  arena_id VARCHAR(50),
  occurred_at TIMESTAMP DEFAULT NOW(),
  killer_tank_lifetime_ms BIGINT,
  weapon_power FLOAT
);

CREATE INDEX idx_kill_events_killer ON kill_events(killer_bot_id);
CREATE INDEX idx_kill_events_occurred ON kill_events(occurred_at DESC);
CREATE INDEX idx_kill_events_killer_occurred ON kill_events(killer_bot_id, occurred_at DESC);

CREATE TABLE prompt_cache (
  cache_key VARCHAR(128) PRIMARY KEY,
  generated_code TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 9.2 Redis: estruturas

- `arena:{arenaId}:presence` (set): tankInstanceIds ativos.
- `ranking:kills:24h` (sorted set): score = kills nas últimas 24h. Atualizado por job que recalcula a cada minuto a partir de `kill_events`.
- `tank:{tankInstanceId}:state` (hash): snapshot recente para failover.
- `pubsub:arena_events` (canal): para coordenação entre processos quando houver mais de um game server.

### 9.3 Atualização de ranking

A cada `KillEvent`:

1. Insere em `kill_events` no Postgres (auditável).
2. Job cron (a cada 1 min) recalcula sorted set `ranking:kills:24h` filtrando por `occurred_at > now() - interval '24h'`.

A janela móvel não dá pra fazer só com `ZINCRBY` porque kills antigas precisam sair do score. O recálculo periódico é o caminho correto.

## 10. Modelo de implantação

### 10.1 MVP

Componentes em Railway:
- 1x Next.js app (web + API)
- 1x Game server Node 24 (Colyseus 0.17)
- 1x PostgreSQL 16 gerenciado
- 1x Redis 7 gerenciado

Custo estimado: US$ 60 a 120/mês.

### 10.2 Limites do MVP

Com 1 game server:
- 1 arena ativa
- Até 16 tanques simultâneos
- Até 200 jogadores conectados como espectadores

### 10.3 Plano de escala (não no MVP)

- Sticky session via Colyseus + Redis presence permite múltiplos game servers, cada um cuidando de N arenas.
- Game servers viram stateless (estado em Redis para failover).
- Migrar de Railway para Fly.io ou VPS dedicado quando custo/performance for problema.

## 11. Anti-cheat e abuso

### 11.1 Vetores de ataque

| Vetor | Mitigação |
|---|---|
| Cliente forja ações do tanque | Não existe canal cliente-para-ação. Sandbox é a única fonte. |
| Código escapa do sandbox | isolated-vm (V8 Isolates), validação AST como segunda camada |
| Código DoS por loop infinito | Timeout de 2ms por handler via `Reference.apply` |
| LLM gera código que escapa | Validação AST reaplica regras independente do LLM |
| Spam de geração de bot | Rate limit 10/dia/usuário |
| Múltiplas contas para farmar | Detecção heurística pós-MVP (mesmo IP, padrões de prompt) |
| Hot-swap durante combate para roubar kill | Cooldown de 30s + invulnerabilidade 0.5s sem dano |

### 11.2 Dados sensíveis

- Senhas via BetterAuth (já gerencia hashing).
- Prompt do usuário é privado. Só o código gerado pode aparecer em modo avançado para o próprio dono.
- Logs do LLM não são expostos publicamente.

## 12. Observabilidade

### 12.1 Métricas críticas

- `game_server.tick_duration_ms` (histograma)
- `game_server.tanks_active`
- `sandbox.cpu_timeout_count` por tanque
- `sandbox.runtime_error_count` por tanque
- `llm.generation_latency_ms`
- `llm.generation_tokens_in/out`
- `llm.validation_failure_rate`
- `arena.events_per_tick`

### 12.2 Logs estruturados (pino)

- Todo evento de matar/morrer.
- Toda violação de sandbox: log estruturado com snippet anonimizado.
- Toda geração de código: hash do prompt, modelo usado, tokens, status.

### 12.3 Alertas mínimos

- Tick duration p95 > 20ms por mais de 1 minuto
- LLM error rate > 10% em 5 minutos
- Game server CPU > 80% sustentado
- Sandbox timeout rate > 5% dos ticks

## 13. Plano de testes

### 13.1 Unitários
- Física (movimento, colisão, rotação)
- Detecção de radar (cone)
- Validação AST (cobertura de cada construção da blacklist)

### 13.2 Integração
- Código de exemplo executando um tick completo no isolate
- Hot-swap preservando estado
- Geração de código via LLM mockado retornando códigos válidos e inválidos

### 13.3 Carga
- Simulação de 16 tanques rodando códigos de complexidade média por 30 minutos
- Spike de 200 espectadores conectando em 10 segundos

### 13.4 Adversariais
- Bateria de prompts maliciosos tentando gerar código que escape do sandbox
- Códigos JavaScript escritos manualmente tentando explorar cada item da blacklist
- Casos clássicos de escape (`constructor.constructor`, prototype pollution, etc.)

## 14. Riscos técnicos abertos

- **isolated-vm e Node 24:** o README do isolated-vm avisa que Node 20+ exige flag `--no-node-snapshot`. Validar no Node 24 antes de assumir compatibilidade total. Plano B: ficar em Node 22 LTS (em maintenance mas suportado até abril/2027).
- **isolated-vm como dependência nativa:** requer compilador C++ no build. Railway suporta, mas é uma fricção a mais no deploy.
- **Custo de LLM:** estimativa de US$ 1.50 a 3/mês está no limite da meta. Cache e modelo barato são essenciais.
- **Comportamento emergente do LLM:** pode gerar código que passa na validação mas tem comportamento inesperado em combate. Aceitar como parte do produto e iterar.
- **Latência percebida:** 60 tps no servidor com cliente em sub/sudeste do Brasil deve atender < 100ms, mas conexões ruins viram reclamação. Plano B: predição básica no cliente (interpolação de movimento entre ticks).

## 15. Próximos passos

1. **Protótipo isolated-vm + Node 24** (1 dia): validar que a flag `--no-node-snapshot` não traz problemas. Medir overhead de criar/destruir isolates e de chamar handlers.
2. **Validar geração de código via LLM** (1 dia): 50 prompts de teste, medir taxa de JS válido na primeira tentativa com Sonnet barato e GPT-4o-mini. Escolher o modelo definitivo.
3. **Consolidar custo estimado** com base nos testes acima.
4. **Revisar PRD se custo for inviável.**
5. **Começar implementação da arena single-player** (sem multiplayer ainda) com 2 tanques rodando JS em isolated-vm.
