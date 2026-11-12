// systems/Settings.js
// Opções do jogador, salvas no localStorage (um "armazenamento chave-valor" simples do navegador).
// Ficam separadas do mundo: valem para qualquer save.

export const DEFAULT_BINDS = {
  forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space', sneak: 'ShiftLeft', sprint: 'ControlLeft',
  inventory: 'KeyE', drop: 'KeyQ', chat: 'KeyT', command: 'Slash', toggleMode: 'KeyG', fly: 'KeyF', debug: 'F3',
};

const DEFAULTS = {
  lang: null, // null = detectar (inglês se não for pt/es)
  fov: 75, sensitivity: 1, invertY: false,
  renderDistance: 6, brightness: 0.5, bobbing: true, smoothLighting: true, clouds: true, renderScale: 1,
  volume: { master: 0.8, blocks: 1, creatures: 1, player: 1, ambient: 0.7, ui: 0.6 },
  binds: { ...DEFAULT_BINDS },
};

const KEY = 'webcraft.settings.v1';

export class Settings {
  constructor() {
    this.data = structuredClone(DEFAULTS);
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        Object.assign(this.data, d);
        this.data.volume = { ...DEFAULTS.volume, ...(d.volume || {}) };
        this.data.binds = { ...DEFAULT_BINDS, ...(d.binds || {}) };
      }
    } catch (e) { /* armazenamento bloqueado: usa os padrões */ }
    if (!this.data.lang) {
      const nav = (navigator.language || 'en').slice(0, 2);
      this.data.lang = ['pt', 'es'].includes(nav) ? nav : 'en';
    }
    this.listeners = new Set();
  }

  get(k) { return this.data[k]; }
  set(k, v) { this.data[k] = v; this.save(); for (const fn of this.listeners) fn(k, v); }
  setVolume(cat, v) { this.data.volume[cat] = v; this.save(); for (const fn of this.listeners) fn('volume', this.data.volume); }
  setBind(action, code) { this.data.binds[action] = code; this.save(); for (const fn of this.listeners) fn('binds', this.data.binds); }
  resetBinds() { this.data.binds = { ...DEFAULT_BINDS }; this.save(); for (const fn of this.listeners) fn('binds', this.data.binds); }
  onChange(fn) { this.listeners.add(fn); }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* ignora */ } }
}

// Nome legível de uma tecla (KeyW → W, ShiftLeft → Shift esq.)
export function keyLabel(code) {
  if (!code) return '—';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const map = { Space: 'Space', ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift', ControlLeft: 'L-Ctrl', ControlRight: 'R-Ctrl', AltLeft: 'L-Alt', AltRight: 'R-Alt', Slash: '/', Backquote: '`', Tab: 'Tab', Enter: 'Enter', CapsLock: 'Caps' };
  return map[code] || code;
}
