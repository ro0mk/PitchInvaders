import { RANKS } from './config.js';

const KEY = 'pitchinvaders.save.v1';

const DEFAULTS = {
  bestTime: 0,
  bestXP: 0,
  careerXP: 0,
  runs: 0,
  bestCombo: 0,
  settings: {
    volume: 0.8,
    sensitivity: 1.0,
    quality: 'high',
    autoCam: true,
    invertY: false,
  },
};

export function loadSave() {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch (_) { saved = null; }
  const base = JSON.parse(JSON.stringify(DEFAULTS));
  if (!saved || typeof saved !== 'object') return base;
  return { ...base, ...saved, settings: { ...base.settings, ...(saved.settings || {}) } };
}

export function writeSave(save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch (_) { /* armazenamento indisponível: o jogo continua sem guardar */ }
}

// Nível de carreira: cada nível custa um pouco mais do que o anterior.
export function levelInfo(xp) {
  let level = 1;
  let need = 500;
  let floor = 0;
  while (xp >= floor + need) {
    floor += need;
    level++;
    need = Math.round(500 + (level - 1) * 350);
  }
  let title = RANKS[0].title;
  for (const r of RANKS) if (xp >= r.xp) title = r.title;
  return { level, title, progress: (xp - floor) / need, into: xp - floor, need };
}

export function formatTime(t) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const d = Math.floor((t * 10) % 10);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${d}`;
}
