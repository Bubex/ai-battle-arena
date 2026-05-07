# PRD: Tank Arena (nome provisório)

**Versão:** 0.2 (revisada após validação de tecnologias)
**Autor:** Marlon
**Data:** 2026-05-06
**Status:** Em definição
**Mudanças vs 0.1:** Linguagem do bot trocada de Lua para JavaScript (decisão de stack, sem impacto na experiência do usuário). Limites operacionais ajustados.

---

## 1. Visão geral

Tank Arena é um jogo 2D web multiplayer no qual cada jogador desenvolve um tanque de guerra autônomo "programado" via prompt de linguagem natural. O prompt é traduzido por LLM em código JavaScript que roda em sandbox isolada no servidor, controlando o tanque dentro de uma arena persistente em tempo real. Os tanques continuam batalhando mesmo quando o jogador está offline.

A proposta combina três experiências:

1. **Programação por linguagem natural** (acessível para não-programadores)
2. **Combate competitivo persistente** (engajamento de longo prazo via ranking)
3. **Simulação observável** (jogador acompanha o desempenho do próprio bot)

A inspiração direta é Robocode (combate de bots) somada a Screeps (mundo persistente onde o código do jogador roda 24/7), com a barreira técnica reduzida pelo uso de LLM. Aliás, Screeps usa exatamente a mesma estratégia de sandbox que adotaremos (isolated-vm), o que reduz risco técnico.

## 2. Problema e oportunidade

Jogos de programação competitiva (Robocode, CodinGame, Screeps) têm comunidade fiel mas estão presos a um público técnico. A barreira de aprender uma linguagem nova ou um SDK específico exclui:

- Profissionais de produto, design e marketing curiosos sobre IA
- Estudantes de ensino médio e graduação sem formação em programação
- Jogadores casuais interessados em "construir" mais do que "executar"

Com LLMs capazes de gerar código razoavelmente correto a partir de descrições em português, é viável criar uma camada de abstração onde o jogador descreve a estratégia ("ataque tanques que aparecerem no radar, recuando se a vida estiver baixa") e o sistema entrega código executável.

A oportunidade é capturar o segmento de "curiosos sobre IA aplicada" que hoje consomem conteúdo passivo (vídeos, posts) e oferecer um produto onde a IA é a ferramenta de criação.

## 3. Objetivos e métricas

### Objetivos do produto

| Objetivo | Métrica primária | Meta no MVP |
|---|---|---|
| Validar viabilidade técnica do modelo "prompt vira código que roda no servidor" | % de prompts que geram JS válido na primeira tentativa | 80% |
| Validar engajamento da arena persistente | Sessões de retorno em D1, D7 | D1 30%, D7 10% |
| Validar a experiência de iteração do bot | Mediana de edições de prompt por usuário ativo na primeira semana | 5+ |
| Manter custo unitário viável | Custo médio de LLM por usuário ativo por mês | < R$ 2 |

A meta de 70% subiu para 80% porque LLMs geram JavaScript com qualidade superior à de Lua (volume muito maior de JS no treino). É uma meta mais agressiva e justa.

### Não-objetivos do MVP

- Modos de jogo alternativos (capture the flag, equipes, etc.)
- Customização visual de tanques
- Marketplace ou compartilhamento de bots
- Mobile nativo (web responsivo é suficiente)
- Replays gravados (decisão explícita do escopo)
- Sistema social (chat, amigos, clãs)

## 4. Personas

### Persona primária: "Curioso de IA" (Lucas, 28, analista de marketing)

Acompanha conteúdo sobre IA, já usou ChatGPT para escrever textos, mas nunca programou. Quer ter uma experiência prática com IA além de chatbot. Valoriza ver resultado visual e progresso.

**Motivação:** "Quero brincar com IA fazendo algo, não só conversando."

### Persona secundária: "Hobbysta técnico" (Renata, 34, desenvolvedora)

Conhece Robocode/CodinGame e gosta de jogos de programação. Está curiosa sobre o quanto LLM consegue substituir a escrita direta de código.

**Motivação:** "Quero ver até onde dá pra ir só descrevendo a estratégia."

### Persona terciária: "Educador" (Prof. Daniel, 45, professor de informática)

Quer usar a plataforma como ferramenta didática para introduzir conceitos de IA, lógica condicional e estratégia algorítmica para alunos.

**Motivação:** "Preciso de algo que prenda a atenção dos alunos enquanto ensina pensamento computacional."

## 5. Jornada do usuário

### Fluxo principal (primeiro uso)

1. Usuário acessa o site, vê a arena ao vivo na home (tanques batalhando em background)
2. Cria conta (BetterAuth, login social ou email)
3. É levado para o editor de bot, com um template inicial preenchido ("ataque qualquer inimigo no radar")
4. Edita o prompt em português descrevendo a estratégia
5. Clica em "Gerar bot", aguarda 5 a 15 segundos enquanto o LLM produz o código
6. Sistema mostra preview da estratégia gerada (resumo legível, não o código bruto por padrão)
7. Usuário clica "Lançar tanque", o tanque entra na arena
8. Visualização da arena abre, com câmera seguindo o tanque do jogador
9. HUD mostra: posição no ranking, kills, deaths, tempo vivo, mensagens recentes do tanque

### Fluxo de iteração

1. Jogador observa o tanque batalhando, percebe falha de comportamento
2. Volta ao editor, ajusta o prompt
3. Sistema gera novo código, valida
4. Jogador escolhe entre:
   - **Hot-swap** (substitui o código no tanque vivo, sujeito a cooldown)
   - **Aguardar morte** (próximo respawn já usa o código novo)

### Fluxo de offline

1. Jogador fecha o navegador
2. Tanque continua na arena rodando o último código submetido
3. Quando morre, respawna após X segundos
4. Stats acumulam no perfil do jogador
5. Jogador retorna depois e vê o histórico

## 6. Requisitos funcionais

### 6.1 Tanque e arena

- **RF-01.** A arena é um mapa 2D fechado com paredes nas bordas e obstáculos internos estáticos.
- **RF-02.** O tanque tem três entidades giratórias independentes: chassi (corpo), torre (canhão) e radar.
- **RF-03.** As ações do tanque são:
  - Andar para frente (acelerar no sentido do chassi)
  - Andar para trás (acelerar no sentido inverso do chassi)
  - Rodar chassi sentido horário
  - Rodar chassi sentido anti-horário
  - Rodar torre sentido horário
  - Rodar torre sentido anti-horário
  - Rodar radar sentido horário
  - Rodar radar sentido anti-horário
  - Atirar
- **RF-04.** Cada ação tem custos (energia, tempo de cooldown) e parâmetros (intensidade do giro, potência do tiro) que estão definidos no sistema e expostos para o bot.
- **RF-05.** Cada tanque tem: pontos de vida, energia (regenera no tempo), cooldown de tiro, posição, orientação do chassi, orientação da torre, orientação do radar.
- **RF-06.** Tanques colidem com paredes, obstáculos e outros tanques (com dano de colisão).

### 6.2 Sistema de eventos

O sandbox JavaScript reage a eventos disparados pelo engine. O bot deve registrar handlers para os eventos relevantes.

**Eventos mínimos do MVP:**

- `radar_detectou_inimigo(tanque_id, distancia, angulo, vida)`
- `radar_detectou_parede(distancia, angulo)`
- `tiro_acertou_inimigo(tanque_id, dano)`
- `tomei_tiro(origem_id, dano, angulo_de_origem)`
- `colisao_com_parede(angulo)`
- `colisao_com_tanque(tanque_id, angulo)`
- `tick(delta_t)` (chamado a cada tick do servidor, usado para lógica contínua)
- `morri(quem_matou)`
- `nasci()` (chamado no respawn)

**Não-evento:** o radar é um cone que o bot precisa girar ativamente. Inimigos fora do cone não disparam evento.

### 6.3 Edição e geração do bot

- **RF-07.** Editor de prompt é um campo de texto simples com contador de caracteres (limite: 4000 caracteres).
- **RF-08.** O prompt é enviado a um LLM com um system prompt fixo que contém a especificação completa da API JavaScript disponível.
- **RF-09.** O LLM retorna código JavaScript que é validado por:
  - Parser sintático (erro de sintaxe = rejeita)
  - Análise de AST procurando construções proibidas (acesso a globais perigosos, eval, Function, etc.)
  - Limite de tamanho do código (rejeita acima de 16KB)
- **RF-10.** Se a validação falhar, o sistema retorna ao usuário uma explicação amigável e tenta uma vez automaticamente. Se a segunda tentativa falhar, mostra o erro e pede revisão do prompt.
- **RF-11.** Cada usuário tem um limite de **10 gerações de bot por dia** no MVP.
- **RF-12.** O usuário pode visualizar o código gerado (modo "avançado") mas não pode editá-lo manualmente no MVP.

O limite caiu de 20 para 10 após a análise de custo na seção 7.4 do SDD original. Mantém custo abaixo da meta com modelo Sonnet barato como padrão.

### 6.4 Hot-swap

- **RF-13.** Jogador pode substituir o código de um tanque vivo por um novo. O tanque mantém posição, vida e energia.
- **RF-14.** Hot-swap tem cooldown de 30 segundos por tanque.
- **RF-15.** Durante hot-swap (que leva sub-segundo), o tanque fica imóvel e não pode receber dano por 0.5 segundos para evitar abuso (kill steal por troca de código).

### 6.5 Arena persistente

- **RF-16.** A arena fica sempre online com pelo menos um tanque "stub" (NPC simples) para que jogadores que entram não vejam a arena vazia.
- **RF-17.** Limite máximo de tanques simultâneos por arena: 16 no MVP.
- **RF-18.** Quando atinge o limite, novos tanques entram em fila ou em arena secundária (decisão técnica no SDD).
- **RF-19.** Quando um tanque morre, respawna em local seguro (longe de outros tanques) após 10 segundos.
- **RF-20.** Jogador pode "remover" o próprio tanque a qualquer momento (some da arena, stats são preservadas).
- **RF-21.** Tanques inativos (sem hot-swap nem respawn ativo há 14 dias) são removidos automaticamente da arena (mas não da conta).

### 6.6 Ranking

- **RF-22.** Ranking global ordena por kills nas últimas 24 horas (janela móvel).
- **RF-23.** Métricas exibidas no perfil do jogador: kills totais, deaths, K/D, tempo total vivo, dano causado, dano recebido.
- **RF-24.** Ranking é atualizado em tempo real (ou com delay de até 5 segundos).
- **RF-25.** O top 100 é exibido publicamente.

A janela de 24h substitui "kills totais acumulados" para evitar o problema do veterano que domina permanentemente o leaderboard só por tempo de exposição (risco R6 da v0.1).

### 6.7 Visualização

- **RF-26.** Cliente web renderiza a arena em 2D com PixiJS (decisão técnica).
- **RF-27.** Câmera segue por padrão o tanque do jogador. Modos alternativos: spectator livre, seguir top 1.
- **RF-28.** HUD mostra: vida, energia, cooldown de tiro, posição no ranking, ID do tanque, mensagens (logs do bot via função `print` permitida).
- **RF-29.** Visualização do cone do radar (apenas para o próprio tanque do jogador).
- **RF-30.** Indicação visual de tiros, explosões e impactos.

### 6.8 Conta e autenticação

- **RF-31.** Login via BetterAuth (email/senha + Google).
- **RF-32.** Cada conta pode ter no máximo 3 tanques na arena simultaneamente no MVP.
- **RF-33.** Histórico de prompts antigos preservado no perfil (últimos 20).

## 7. Requisitos não-funcionais

### Performance
- Latência cliente para servidor: < 100ms p95 para sul/sudeste do Brasil
- Tickrate do servidor: 60 ticks por segundo
- Tempo de geração de código a partir do prompt: < 15s p95
- Tempo de execução do código por tick por tanque: < 2ms p99

### Escala
- Suportar 200 usuários ativos simultaneamente no MVP
- 16 tanques por arena, com possibilidade de até 3 arenas paralelas

### Segurança
- Sandbox JavaScript via isolated-vm (V8 Isolates, mesma tecnologia usada por Screeps e Cloudflare Workers)
- Nenhum acesso a rede, sistema de arquivos, ou outras APIs do host
- Rate limit de geração de código (10 por dia por usuário) e geração de tiros (cooldown no engine)
- Validação estática (AST scan) do código antes de executar

### Disponibilidade
- 99% de uptime no MVP (queda planejada permitida fora de horário de pico)

### Custo
- Custo de infra inicial: até US$ 200/mês
- Custo médio de LLM por usuário ativo: < R$ 2/mês

## 8. Escopo do MVP

### Inclui
- Editor de prompt e geração de código JavaScript
- Uma única arena persistente com até 16 tanques
- Sistema de eventos completo da seção 6.2
- Hot-swap com cooldown
- Ranking global por kills nas últimas 24h
- HUD básica e câmera seguindo o tanque
- Conta e autenticação
- Histórico de prompts (últimos 20)
- Limite de 3 tanques por conta

### Não inclui (backlog pós-MVP)
- Replays
- Múltiplos modos de jogo
- Customização visual
- Compartilhamento de bots
- Marketplace
- Equipes ou clãs
- Mobile nativo
- Edição manual do código
- Ranking ELO ou ponderado por dificuldade

## 9. Hipóteses e riscos

### Hipóteses críticas
- **H1:** LLM moderno gera JavaScript correto na primeira tentativa em pelo menos 80% dos prompts de jogadores não-técnicos.
- **H2:** Jogadores aceitam o tempo de geração de 5 a 15 segundos sem desistir.
- **H3:** Arena persistente (sem rounds) gera engajamento de retorno comparável a sessões fechadas.
- **H4:** Custo de LLM por usuário fica abaixo de R$ 2/mês com modelo barato (Sonnet barato ou GPT-4o-mini).

### Riscos
- **R1: Sandbox tem fuga.** Mitigação: isolated-vm tem track record de produção em Screeps, Cloudflare Workers, Algolia. Validação estática como segunda camada.
- **R2: Custo de LLM explode.** Mitigação: rate limit reduzido a 10/dia por usuário, cache de prompts idênticos, modelo barato por padrão.
- **R3: Bots ficam todos parecidos (LLM converge para mesma estratégia).** Mitigação: variar temperatura do LLM, expor parâmetros que incentivem diferenciação.
- **R4: Servidor não escala com tanques 24/7.** Mitigação: limite de tanques por conta, expiração de tanques inativos, monitoramento de CPU por tanque.
- **R5: Jogador casual frustra com o jogo "rodando sozinho".** Mitigação: feedback visual claro do que o bot está fazendo, logs legíveis, tutorial interativo.
- **R6: Ranking incentiva farmar tanques fracos.** Mitigação: já endereçada pela mudança para janela móvel de 24h. Pós-MVP avaliar ELO.

## 10. Marcos sugeridos

- **M1 (semana 4):** Engine de tanque rodando local (sem multiplayer), com JS manual em isolated-vm. Validação técnica do sandbox.
- **M2 (semana 8):** Multiplayer básico com 2 tanques, sem prompt (só JS manual).
- **M3 (semana 12):** Editor de prompt e geração de JS via LLM. Alpha fechado.
- **M4 (semana 16):** Arena persistente, ranking, hot-swap. Beta público.
- **M5 (semana 20):** Polimento, observabilidade, lançamento.

## 11. Perguntas em aberto

- O prompt é em português apenas, ou suportamos inglês desde o MVP?
- Vamos ter "tutoriais" com prompts pré-definidos como onboarding?
- Como tratar bots que nunca atiram (passivos)? Têm valor de jogo ou viram lixo na arena?
- Tanques inativos respawnam ou ficam mortos esperando o jogador voltar?
- Vamos cobrar pelo produto em algum momento? O modelo de monetização precisa estar mapeado para evitar decisões arquiteturais que bloqueiem isso depois.
