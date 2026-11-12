// systems/OptionsMenu.js
// Tela de opções com abas: Geral (idioma), Vídeo, Áudio e Controles (troca de teclas).
// Cada alteração é salva na hora (Settings) e aplicada pelo jogo via settings.onChange.
import { t, LANGS, applyDOM } from './i18n.js';
import { keyLabel } from './Settings.js';

const ACTIONS = ['forward', 'back', 'left', 'right', 'jump', 'sneak', 'sprint', 'inventory', 'drop', 'chat', 'command', 'toggleMode', 'fly', 'debug'];

export class OptionsMenu {
  constructor(root, settings, sound) {
    this.root = root; this.settings = settings; this.sound = sound;
    this.tab = 'general';
    this.onClose = null;
    this.capturing = null;
    window.addEventListener('keydown', (e) => {
      if (!this.capturing) return;
      e.preventDefault(); e.stopPropagation();
      if (e.code !== 'Escape') this.settings.setBind(this.capturing, e.code);
      this.capturing = null;
      this.render();
    }, true);
  }

  open() { this.root.hidden = false; this.render(); }
  close() { this.root.hidden = true; this.capturing = null; if (this.onClose) this.onClose(); }
  isOpen() { return !this.root.hidden; }

  render() {
    const S = this.settings;
    const tabs = ['general', 'video', 'audio', 'controls'];
    const el = this.root;
    el.innerHTML = '';
    const card = document.createElement('div'); card.className = 'menu-card options';
    const h = document.createElement('p'); h.className = 'big'; h.textContent = t('opt.title');
    const tabRow = document.createElement('div'); tabRow.className = 'tabs'; tabRow.setAttribute('role', 'tablist');
    for (const k of tabs) {
      const b = document.createElement('button'); b.className = 'tab' + (k === this.tab ? ' on' : ''); b.textContent = t('opt.' + k);
      b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', k === this.tab);
      b.addEventListener('click', () => { this.tab = k; this.click(); this.render(); });
      tabRow.appendChild(b);
    }
    const body = document.createElement('div'); body.className = 'opt-body';
    const row = (label, control, note) => {
      const r = document.createElement('div'); r.className = 'opt-row';
      const l = document.createElement('span'); l.className = 'opt-label'; l.textContent = label;
      r.append(l, control);
      if (note) { const n = document.createElement('small'); n.className = 'opt-note'; n.textContent = note; r.appendChild(n); }
      body.appendChild(r);
    };
    const slider = (id, min, max, step, value, fmt, onInput) => {
      const w = document.createElement('div'); w.className = 'slider';
      const inp = document.createElement('input'); inp.type = 'range'; inp.id = id; inp.min = min; inp.max = max; inp.step = step; inp.value = value;
      const out = document.createElement('output'); out.textContent = fmt(+value);
      inp.addEventListener('input', () => { out.textContent = fmt(+inp.value); onInput(+inp.value); });
      w.append(inp, out);
      return w;
    };
    const toggle = (id, value, onChange) => {
      const b = document.createElement('button'); b.id = id; b.className = 'btn toggle' + (value ? ' on' : '');
      b.textContent = value ? t('opt.on') : t('opt.off'); b.setAttribute('aria-pressed', value);
      b.addEventListener('click', () => { onChange(!value); this.click(); this.render(); });
      return b;
    };
    const pct = (v) => Math.round(v * 100) + '%';

    if (this.tab === 'general') {
      const sel = document.createElement('select'); sel.id = 'opt-lang';
      for (const [code, L] of Object.entries(LANGS)) { const o = document.createElement('option'); o.value = code; o.textContent = L.label; sel.appendChild(o); }
      sel.value = S.get('lang');
      sel.addEventListener('change', () => { S.set('lang', sel.value); applyDOM(); this.render(); });
      row(t('opt.language'), sel);
      row(t('opt.fov'), slider('opt-fov', 50, 110, 1, S.get('fov'), (v) => v + '°', (v) => S.set('fov', v)));
      row(t('opt.sensitivity'), slider('opt-sens', 0.2, 2.5, 0.05, S.get('sensitivity'), pct, (v) => S.set('sensitivity', v)));
    } else if (this.tab === 'video') {
      row(t('opt.renderDistance'), slider('opt-rd', 2, 12, 1, S.get('renderDistance'), (v) => t('opt.chunks', { n: v }), (v) => S.set('renderDistance', v)), t('opt.rdNote'));
      row(t('opt.brightness'), slider('opt-bright', 0, 1, 0.05, S.get('brightness'), (v) => (v <= 0.05 ? t('opt.moody') : v >= 0.95 ? t('opt.bright') : pct(v)), (v) => S.set('brightness', v)));
      row(t('opt.renderScale'), slider('opt-scale', 0.5, 1, 0.05, S.get('renderScale'), pct, (v) => S.set('renderScale', v)));
      row(t('opt.smoothLighting'), toggle('opt-smooth', S.get('smoothLighting'), (v) => S.set('smoothLighting', v)));
      row(t('opt.clouds'), toggle('opt-clouds', S.get('clouds'), (v) => S.set('clouds', v)));
      row(t('opt.bobbing'), toggle('opt-bob', S.get('bobbing'), (v) => S.set('bobbing', v)));
    } else if (this.tab === 'audio') {
      const v = S.get('volume');
      for (const [cat, label] of [['master', 'opt.master'], ['blocks', 'opt.blocks'], ['creatures', 'opt.creatures'], ['player', 'opt.player'], ['ambient', 'opt.ambient'], ['ui', 'opt.uiSounds']]) {
        row(t(label), slider('opt-vol-' + cat, 0, 1, 0.05, v[cat], pct, (x) => { S.setVolume(cat, x); if (cat === 'ui') this.click(); }));
      }
    } else {
      const binds = S.get('binds');
      for (const a of ACTIONS) {
        const b = document.createElement('button'); b.className = 'btn keybind' + (this.capturing === a ? ' capturing' : ''); b.id = 'bind-' + a;
        b.textContent = this.capturing === a ? t('opt.pressKey') : keyLabel(binds[a]);
        const dup = Object.entries(binds).some(([k, c]) => k !== a && c === binds[a]);
        if (dup) b.classList.add('dup');
        b.addEventListener('click', () => { this.capturing = a; this.render(); });
        row(t('key.' + a), b);
      }
      const reset = document.createElement('button'); reset.className = 'btn'; reset.textContent = t('opt.reset');
      reset.addEventListener('click', () => { S.resetBinds(); this.click(); this.render(); });
      body.appendChild(reset);
    }
    const done = document.createElement('button'); done.className = 'btn primary'; done.id = 'opt-done'; done.textContent = t('opt.done');
    done.addEventListener('click', () => { this.click(); this.close(); });
    card.append(h, tabRow, body, done);
    el.appendChild(card);
  }

  click() { if (this.sound) this.sound.play('click'); }
}
