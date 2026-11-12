// systems/Sound.js
// Efeitos sonoros 100% sintetizados com a Web Audio API (nenhum arquivo de áudio é baixado).
// Ideia: todo som é uma combinação de poucos "ingredientes":
//   ruído branco filtrado (passos, quebrar, fogo), osciladores (vozes dos mobs) e envelopes (ataque/decaimento).
// Som posicional: o volume cai com a distância e o "pan" (esquerda/direita) vem do ângulo até a câmera.

const CATEGORY_RANGE = { blocks: 16, creatures: 22, player: 1, ambient: 16, ui: 1 };

// material do bloco → filtro (frequência central, ressonância, duração)
const MAT = {
  stone: { f: 1900, q: 1.2, d: 0.09, thump: 0 },
  wood: { f: 650, q: 3, d: 0.11, thump: 140 },
  grass: { f: 900, q: 0.6, d: 0.12, thump: 0, low: true },
  gravel: { f: 700, q: 0.8, d: 0.13, thump: 0, low: true },
  sand: { f: 2600, q: 0.5, d: 0.12, thump: 0 },
  snow: { f: 1400, q: 0.5, d: 0.14, thump: 0, low: true },
  cloth: { f: 500, q: 0.4, d: 0.1, thump: 0, low: true },
  glass: { f: 3000, q: 4, d: 0.08, thump: 0 },
  metal: { f: 2400, q: 6, d: 0.12, thump: 0, ring: 1800 },
  none: null,
};

export class Sound {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.listener = { x: 0, y: 0, z: 0, rx: 1, rz: 0 };
    const unlock = () => { this.init(); if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      const n = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, n, n);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      this.updateVolume();
    } catch (e) { this.ctx = null; }
  }

  updateVolume() { if (this.master) this.master.gain.value = this.settings.get('volume').master; }

  setListener(pos, dirX, dirZ) {
    this.listener.x = pos.x; this.listener.y = pos.y; this.listener.z = pos.z;
    const l = Math.hypot(dirX, dirZ) || 1;
    this.listener.rx = -dirZ / l; this.listener.rz = dirX / l; // vetor "direita"
  }

  // Cria a saída de um som: ganho (volume x distância) + pan estéreo. Retorna null se inaudível.
  out(cat, pos, vol = 1) {
    if (!this.ctx || this.ctx.state !== 'running') return null;
    const v = this.settings.get('volume');
    let g = (v[cat] ?? 1) * vol;
    let pan = 0;
    if (pos) {
      const dx = pos.x - this.listener.x, dy = pos.y - this.listener.y, dz = pos.z - this.listener.z;
      const dist = Math.hypot(dx, dy, dz);
      const range = CATEGORY_RANGE[cat] || 16;
      if (dist > range) return null;
      g *= Math.pow(1 - dist / range, 1.4);
      if (dist > 0.5) pan = Math.max(-1, Math.min(1, (dx * this.listener.rx + dz * this.listener.rz) / dist)) * 0.8;
    }
    if (g <= 0.001) return null;
    const gain = this.ctx.createGain();
    gain.gain.value = g;
    if (this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner(); p.pan.value = pan;
      gain.connect(p); p.connect(this.master);
    } else gain.connect(this.master);
    return gain;
  }

  // ----- ingredientes -----
  noiseBurst(dest, { t = 0, dur = 0.1, f = 1000, q = 1, type = 'bandpass', vol = 1, attack = 0.004, sweepTo = null }) {
    const c = this.ctx, now = c.currentTime + t;
    const src = c.createBufferSource(); src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const flt = c.createBiquadFilter(); flt.type = type; flt.frequency.value = f; flt.Q.value = q;
    if (sweepTo) flt.frequency.exponentialRampToValueAtTime(sweepTo, now + dur);
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(vol, now + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(flt); flt.connect(env); env.connect(dest);
    src.start(now, Math.random() * 0.5); src.stop(now + dur + 0.05);
  }

  tone(dest, { t = 0, dur = 0.2, f = 440, f2 = null, type = 'sine', vol = 0.5, attack = 0.01, vib = 0, vibRate = 0, lp = null }) {
    const c = this.ctx, now = c.currentTime + t;
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f, now);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, now + dur);
    if (vib) {
      const l = c.createOscillator(), lg = c.createGain();
      l.frequency.value = vibRate; lg.gain.value = vib; l.connect(lg); lg.connect(o.frequency);
      l.start(now); l.stop(now + dur + 0.05);
    }
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(vol, now + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    let node = o;
    if (lp) { const flt = c.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = lp; o.connect(flt); node = flt; }
    node.connect(env); env.connect(dest);
    o.start(now); o.stop(now + dur + 0.05);
  }

  // ----- sons de bloco -----
  block(kind, material, pos) {
    const m = MAT[material];
    if (!m) return;
    const vol = kind === 'step' ? 0.22 : kind === 'place' ? 0.6 : kind === 'hit' ? 0.25 : 0.7;
    const out = this.out('blocks', pos, vol);
    if (!out) return;
    const dur = m.d * (kind === 'break' ? 1.8 : kind === 'step' ? 0.8 : 1);
    if (material === 'glass' && kind === 'break') {
      for (let i = 0; i < 6; i++) this.tone(out, { t: i * 0.025, dur: 0.15, f: 2500 + Math.random() * 3000, type: 'triangle', vol: 0.15 });
      this.noiseBurst(out, { dur: 0.25, f: 4000, q: 0.7, type: 'highpass', vol: 0.4 });
      return;
    }
    const n = kind === 'break' ? 3 : 1;
    for (let i = 0; i < n; i++) {
      this.noiseBurst(out, { t: i * 0.035, dur, f: m.f * (0.85 + Math.random() * 0.3), q: m.q, type: m.low ? 'lowpass' : 'bandpass', vol: 0.9 });
    }
    if (m.thump) this.tone(out, { dur: dur * 1.2, f: m.thump * (kind === 'step' ? 1.2 : 1), f2: m.thump * 0.6, type: 'sine', vol: 0.5 });
    if (m.ring && kind !== 'step') this.tone(out, { dur: 0.25, f: m.ring, type: 'triangle', vol: 0.15 });
  }

  // ----- vozes de criaturas -----
  mob(type, kind, pos) {
    const out = this.out('creatures', pos, kind === 'hurt' ? 0.8 : 0.6);
    if (!out) return;
    const hurt = kind === 'hurt', death = kind === 'death';
    const p = (hurt ? 1.25 : 1) * (death ? 0.8 : 1) * (0.92 + Math.random() * 0.16);
    switch (type) {
      case 'pig': case 'phyg': {
        const k = type === 'phyg' ? 1.3 : 1;
        for (let i = 0; i < (hurt ? 1 : 2); i++) this.tone(out, { t: i * 0.16, dur: 0.14, f: 240 * p * k, f2: 170 * p * k, type: 'sawtooth', vol: 0.35, lp: 900, vib: 30, vibRate: 40 });
        break;
      }
      case 'cow': this.tone(out, { dur: hurt ? 0.35 : 0.9, f: 120 * p, f2: 95 * p, type: 'sawtooth', vol: 0.35, lp: 600, vib: 6, vibRate: 5, attack: 0.08 }); break;
      case 'sheep': case 'sheepuff': this.tone(out, { dur: hurt ? 0.3 : 0.6, f: (type === 'sheepuff' ? 420 : 330) * p, type: 'sawtooth', vol: 0.3, lp: 1400, vib: 25, vibRate: 22, attack: 0.03 }); break;
      case 'chicken': for (let i = 0; i < 3; i++) this.tone(out, { t: i * 0.08, dur: 0.06, f: 1100 * p, f2: 800 * p, type: 'square', vol: 0.15, lp: 2500 }); break;
      case 'wolf': this.tone(out, { dur: 0.15, f: 520 * p, f2: 260 * p, type: 'sawtooth', vol: 0.4, lp: 1600 }); if (!hurt) this.tone(out, { t: 0.2, dur: 0.12, f: 480 * p, f2: 250 * p, type: 'sawtooth', vol: 0.35, lp: 1600 }); break;
      case 'fox': this.tone(out, { dur: 0.12, f: 900 * p, f2: 1300 * p, type: 'sawtooth', vol: 0.25, lp: 2400 }); break;
      case 'zombie': case 'pigman': {
        const f = type === 'pigman' ? 150 : 95;
        this.tone(out, { dur: hurt ? 0.3 : 0.8, f: f * p, f2: f * 0.75 * p, type: 'sawtooth', vol: 0.4, lp: 500, vib: 8, vibRate: 7, attack: 0.1 });
        this.noiseBurst(out, { dur: hurt ? 0.3 : 0.7, f: 400, q: 1, vol: 0.15, attack: 0.1 });
        break;
      }
      case 'skeleton': for (let i = 0; i < 5; i++) this.noiseBurst(out, { t: i * 0.05 + Math.random() * 0.02, dur: 0.03, f: 3000, q: 3, vol: 0.6 }); break;
      case 'spider': this.noiseBurst(out, { dur: hurt ? 0.25 : 0.5, f: 5000, q: 0.5, type: 'highpass', vol: 0.4, attack: 0.08 }); break;
      default: this.tone(out, { dur: 0.2, f: 300 * p, type: 'triangle', vol: 0.3 });
    }
    if (death) this.noiseBurst(out, { t: 0.15, dur: 0.3, f: 800, q: 0.7, type: 'lowpass', vol: 0.4, sweepTo: 200 });
  }

  // ----- diversos -----
  play(name, pos) {
    const cat = { hurt: 'player', eat: 'player', burp: 'player', pop: 'player', splash: 'ambient', fire: 'ambient', ignite: 'blocks', portal: 'ambient',
      travel: 'ambient', door: 'blocks', explode: 'blocks', click: 'ui', attack: 'player', bow: 'creatures', bucket: 'blocks', levelup: 'ui', drown: 'player' }[name] || 'ui';
    const out = this.out(cat, pos, 1);
    if (!out) return;
    switch (name) {
      case 'hurt': this.tone(out, { dur: 0.18, f: 260, f2: 150, type: 'square', vol: 0.25, lp: 1200 }); this.noiseBurst(out, { dur: 0.1, f: 800, q: 0.7, vol: 0.3 }); break;
      case 'attack': this.noiseBurst(out, { dur: 0.09, f: 1200, q: 0.8, vol: 0.5, sweepTo: 400 }); break;
      case 'eat': for (let i = 0; i < 3; i++) this.noiseBurst(out, { t: i * 0.12, dur: 0.07, f: 1500 + Math.random() * 800, q: 1.5, vol: 0.45 }); break;
      case 'burp': this.tone(out, { dur: 0.25, f: 140, f2: 90, type: 'sawtooth', vol: 0.3, lp: 400 }); break;
      case 'pop': this.tone(out, { dur: 0.08, f: 600 + Math.random() * 400, f2: 1400, type: 'sine', vol: 0.18 }); break;
      case 'splash': this.noiseBurst(out, { dur: 0.45, f: 2500, q: 0.6, type: 'lowpass', vol: 0.6, sweepTo: 500 }); break;
      case 'bucket': this.noiseBurst(out, { dur: 0.3, f: 1200, q: 1, type: 'lowpass', vol: 0.5, sweepTo: 300 }); break;
      case 'fire': for (let i = 0; i < 4; i++) this.noiseBurst(out, { t: Math.random() * 0.4, dur: 0.02, f: 2000 + Math.random() * 3000, q: 2, vol: 0.35 }); this.noiseBurst(out, { dur: 0.6, f: 300, q: 0.5, type: 'lowpass', vol: 0.12, attack: 0.2 }); break;
      case 'ignite': this.noiseBurst(out, { dur: 0.05, f: 4000, q: 3, vol: 0.6 }); this.noiseBurst(out, { t: 0.05, dur: 0.4, f: 600, q: 0.5, type: 'lowpass', vol: 0.4, sweepTo: 1800 }); break;
      case 'portal': this.tone(out, { dur: 1.6, f: 80, f2: 120, type: 'sawtooth', vol: 0.15, lp: 400, vib: 6, vibRate: 3, attack: 0.5 }); break;
      case 'travel': this.tone(out, { dur: 1.2, f: 200, f2: 900, type: 'sine', vol: 0.3, vib: 30, vibRate: 9, attack: 0.1 }); this.noiseBurst(out, { dur: 1.2, f: 600, q: 0.6, vol: 0.3, sweepTo: 4000, attack: 0.2 }); break;
      case 'door': this.tone(out, { dur: 0.12, f: 160, f2: 90, type: 'sine', vol: 0.5 }); this.noiseBurst(out, { dur: 0.2, f: 700, q: 3, vol: 0.4 }); this.tone(out, { t: 0.02, dur: 0.18, f: 900, f2: 600, type: 'sawtooth', vol: 0.05, lp: 1500 }); break;
      case 'explode': this.noiseBurst(out, { dur: 1.4, f: 1200, q: 0.4, type: 'lowpass', vol: 1, attack: 0.005, sweepTo: 60 }); this.tone(out, { dur: 0.9, f: 70, f2: 30, type: 'sine', vol: 0.8 }); break;
      case 'bow': this.noiseBurst(out, { dur: 0.25, f: 2500, q: 1.2, vol: 0.4, sweepTo: 600 }); break;
      case 'click': this.tone(out, { dur: 0.05, f: 1800, type: 'square', vol: 0.08, lp: 3000 }); break;
      case 'levelup': [523, 659, 784].forEach((f, i) => this.tone(out, { t: i * 0.08, dur: 0.25, f, type: 'triangle', vol: 0.2 })); break;
      case 'drown': for (let i = 0; i < 4; i++) this.tone(out, { t: i * 0.07, dur: 0.06, f: 500 + i * 120, type: 'sine', vol: 0.15 }); break;
    }
  }
}
