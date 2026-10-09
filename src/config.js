// Dimensões do estádio (metros). Eixo X = comprimento do campo, eixo Z = largura.
export const HALF_L = 52.5;
export const HALF_W = 34;
// Área jogável: até aos painéis publicitários.
export const BOUNDS_X = 58;
export const BOUNDS_Z = 39.5;
export const GOAL_W = 7.32;
export const GOAL_H = 2.44;
export const GOAL_D = 2.0;

export const PLAYER = {
  runSpeed: 6.2,
  sprintSpeed: 8.7,
  accel: 38,
  airAccel: 10,
  gravity: 22,
  jumpVel: 6.6,
  staminaMax: 100,
  sprintDrain: 19,
  staminaRegen: 15,
  regenDelay: 0.55,
};

// Truques do invasor.
export const TRICKS = {
  juke: { name: 'FINTA', cost: 11, dur: 0.2, cooldown: 0.35, xp: 60 },
  spin: { name: 'ROLETA', cost: 18, dur: 0.45, cooldown: 0.8, xp: 90 },
  jump: { name: 'SALTO', cost: 8, dur: 0.6, cooldown: 0.15, xp: 80 },
  slide: { name: 'DESLIZE', cost: 14, dur: 0.62, cooldown: 0.45, xp: 80 },
};

// Tipos de perseguidores.
export const ENEMY_TYPES = {
  steward: {
    label: 'Segurança',
    speed: 6.0, accel: 14, turn: 7,
    attack: 'grab', height: 'high',
    range: 2.9, windup: 0.4, lungeSpeed: 9.5, lungeDur: 0.32,
    recover: 0.7, predict: 0.45, catchR: 0.68, reach: 0.55, cooldown: 1.2,
    color: '#ffd21f',
  },
  police: {
    label: 'Polícia',
    speed: 6.9, accel: 16, turn: 8,
    attack: 'dive', height: 'low',
    range: 4.0, windup: 0.33, lungeSpeed: 11.5, lungeDur: 0.42,
    recover: 1.5, predict: 0.75, catchR: 0.72, reach: 1.0, cooldown: 1.0,
    color: '#ff3b3b',
  },
  dog: {
    label: 'Cão',
    speed: 9.3, accel: 8.5, turn: 4.5,
    attack: 'leap', height: 'high',
    range: 4.4, windup: 0.22, lungeSpeed: 12.5, lungeDur: 0.34,
    recover: 0.8, predict: 0.3, catchR: 0.6, reach: 0.5, cooldown: 1.4,
    color: '#ff8a1f',
  },
};

export const COLORS = {
  skin: ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#a0673a'],
  hair: ['#2b1b10', '#4a2c17', '#111111', '#c9a15b', '#6b3e1f', '#8a8a8a'],
  home: { shirt: '#d4202c', shorts: '#ffffff', socks: '#d4202c', gk: '#22b14c' },
  away: { shirt: '#4fb3e8', shorts: '#14284b', socks: '#4fb3e8', gk: '#ff9f1a' },
};

// Títulos de carreira (XP acumulado de todas as invasões).
export const RANKS = [
  { xp: 0, title: 'Adepto de Bancada' },
  { xp: 600, title: 'Invasor Novato' },
  { xp: 2000, title: 'Corredor de Relvado' },
  { xp: 5000, title: 'Mestre da Finta' },
  { xp: 10000, title: 'Pesadelo da Segurança' },
  { xp: 20000, title: 'Fantasma do Estádio' },
  { xp: 40000, title: 'Lenda da Invasão' },
  { xp: 75000, title: 'Imparável' },
];
