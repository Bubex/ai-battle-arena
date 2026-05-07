// Stub bots hardcoded for M1 validation.

// Bot A: patrulha em círculo, atira ao detectar inimigo.
export const BOT_A_CODE = `
var radarAngulo = 0;

onNasci(function() {
  print('Bot A nasceu!');
});

onTick(function(dt) {
  // Move sempre para frente e gira o chassi (patrulha em arco)
  andarFrente(1);
  girarChassi(0.5);
  girarRadar(1);
  girarTorre(0.3);
});

onRadarInimigo(function(tankId, distancia, angulo, vida) {
  // Alinha torre ao inimigo e atira
  var diffTorre = angulo - selfTurretAngle();
  while (diffTorre > Math.PI)  diffTorre -= 2 * Math.PI;
  while (diffTorre < -Math.PI) diffTorre += 2 * Math.PI;
  girarTorre(diffTorre > 0 ? 1 : -1);
  if (selfEnergy() > 30) atirar(0.8);
});

onColisaoParede(function(angulo) {
  // Inverte direção e gira mais agressivamente
  girarChassi(1);
});

onColisaoTanque(function(tankId, angulo) {
  girarChassi(1);
});

onTomeiTiro(function(origemId, dano, anguloOrigem) {
  // Gira torre em direção ao atacante
  var diff = anguloOrigem - selfTurretAngle();
  while (diff > Math.PI)  diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  girarTorre(diff > 0 ? 1 : -1);
  atirar(1);
});

onMorri(function(quemMatou) {
  print('Bot A foi morto por ' + quemMatou);
});
`;

// Bot B: move em diagonal e atira periodicamente com a torre girando.
export const BOT_B_CODE = `
var tick = 0;

onNasci(function() {
  print('Bot B nasceu!');
  tick = 0;
});

onTick(function(dt) {
  tick++;
  andarFrente(1);
  girarChassi(-0.4);  // gira oposto ao Bot A para trajetórias distintas
  girarRadar(-1);
  girarTorre(0.6);
  // Atira a cada 40 ticks se tiver energia
  if (tick % 40 === 0 && selfEnergy() > 20) atirar(0.9);
});

onRadarInimigo(function(tankId, distancia, angulo, vida) {
  var diffTorre = angulo - selfTurretAngle();
  while (diffTorre > Math.PI)  diffTorre -= 2 * Math.PI;
  while (diffTorre < -Math.PI) diffTorre += 2 * Math.PI;
  girarTorre(diffTorre > 0 ? 1 : -1);
  if (selfEnergy() > 25) atirar(1);
});

onColisaoParede(function(angulo) {
  girarChassi(-1);
});

onColisaoTanque(function(tankId, angulo) {
  girarChassi(-1);
});

onMorri(function(quemMatou) {
  print('Bot B foi morto por ' + quemMatou);
  tick = 0;
});
`;
