// systems/UI.js
// Interface em DOM (HTML/CSS) por cima do canvas 3D: HUD (vida, fome, hotbar) e telas
// (inventário, bancada, fornalha, baú, criativo). A lógica de clique segue a do Minecraft:
// clique esquerdo pega/solta a pilha, direito divide/coloca 1, Shift+clique move rápido.
import { ITEMS, maxStack } from './Items.js';
import { ATLAS_COLS, BLOCKS, B } from '../world/Blocks.js';
import { matchRecipe } from './Crafting.js';
import { cloneStack, makeStack } from './Inventory.js';
import { COOK_TIME } from './Furnace.js';
import { t } from './i18n.js';

const ICON = 32;

export class UI {
  constructor(root, atlasURL) {
    this.root = root;
    this.atlasURL = atlasURL;
    this.cursor = null;          // pilha "na mão do mouse" enquanto a tela está aberta
    this.screen = null;          // nome da tela aberta
    this.refreshers = [];
    this.onClose = null;
    this.dropToWorld = null;     // callback para itens que não couberam
    this.buildHUD();
    this.cursorEl = document.createElement('div');
    this.cursorEl.className = 'cursor-stack';
    document.body.appendChild(this.cursorEl);
    window.addEventListener('mousemove', (e) => { this.cursorEl.style.left = e.clientX + 'px'; this.cursorEl.style.top = e.clientY + 'px'; });
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'tooltip'; this.tooltip.hidden = true;
    document.body.appendChild(this.tooltip);
  }

  // ---------- ícones ----------
  iconStyle(id) {
    const it = ITEMS[id];
    if (!it) return '';
    const tile = it.tile;
    const col = tile % ATLAS_COLS, row = Math.floor(tile / ATLAS_COLS);
    const size = ATLAS_COLS * ICON;
    const pos = `-${col * ICON}px -${row * ICON}px`;
    let tint = '';
    const bd = it.isBlock ? BLOCKS[it.block] : null;
    if (bd && bd.tint && bd.id !== B.GRASS) tint = 'background-color:#5fa83a;background-blend-mode:multiply;';
    return `background-image:url(${this.atlasURL});background-size:${size}px ${size}px;background-position:${pos};` +
      `-webkit-mask-image:url(${this.atlasURL});-webkit-mask-size:${size}px ${size}px;-webkit-mask-position:${pos};` +
      `mask-image:url(${this.atlasURL});mask-size:${size}px ${size}px;mask-position:${pos};${tint}`;
  }

  renderStack(el, stack) {
    if (!stack) { el.innerHTML = ''; return; }
    const it = ITEMS[stack.id];
    let dur = '';
    if (it && it.durability && stack.dmg) {
      const f = 1 - stack.dmg / it.durability;
      dur = `<div class="dur"><div style="width:${f * 100}%;background:hsl(${f * 120},90%,45%)"></div></div>`;
    }
    el.innerHTML = `<div class="icon" style="${this.iconStyle(stack.id)}"></div>${stack.count > 1 ? `<span class="count">${stack.count}</span>` : ''}${dur}`;
  }

  // ---------- HUD ----------
  buildHUD() {
    const hud = document.createElement('div');
    hud.className = 'hud';
    hud.innerHTML = `
      <div class="crosshair"></div>
      <div class="damage-flash"></div>
      <div class="burn-overlay"></div>
      <div class="sleep-overlay"></div>
      <div class="portal-overlay"></div>
      <div class="water-overlay"></div>
      <div class="item-name"></div>
      <div class="messages"></div>
      <div class="chat" hidden><div class="chat-log"></div><div class="chat-suggest"></div><input id="chat-input" class="chat-input" autocomplete="off" spellcheck="false"></div>
      <div class="debug" hidden></div>
      <div class="bottom">
        <div class="bars">
          <div class="left-bars"><div class="armor-bar"></div><div class="hearts"></div></div>
          <div class="right-bars"><div class="air"></div><div class="food"></div></div>
        </div>
        <div class="hotbar"></div>
      </div>`;
    this.root.appendChild(hud);
    this.hud = hud;
    this.hotbarEl = hud.querySelector('.hotbar');
    this.hotbarSlots = [];
    for (let i = 0; i < 9; i++) {
      const s = document.createElement('div'); s.className = 'slot'; this.hotbarEl.appendChild(s); this.hotbarSlots.push(s);
    }
    this.heartsEl = hud.querySelector('.hearts');
    this.foodEl = hud.querySelector('.food');
    this.airEl = hud.querySelector('.air');
    this.itemNameEl = hud.querySelector('.item-name');
    this.debugEl = hud.querySelector('.debug');
    this.flashEl = hud.querySelector('.damage-flash');
    this.portalEl = hud.querySelector('.portal-overlay');
    this.waterEl = hud.querySelector('.water-overlay');
    this.messagesEl = hud.querySelector('.messages');
    this.barsEl = hud.querySelector('.bars');
    this.armorEl = hud.querySelector('.armor-bar');
    this.burnEl = hud.querySelector('.burn-overlay');
    this.sleepEl = hud.querySelector('.sleep-overlay');
    this.chatEl = hud.querySelector('.chat');
    this.chatLog = hud.querySelector('.chat-log');
    this.chatInput = hud.querySelector('.chat-input');
    this.chatSuggest = hud.querySelector('.chat-suggest');
    this._lastHUD = '';
  }

  updateHotbar(inv) {
    for (let i = 0; i < 9; i++) {
      this.renderStack(this.hotbarSlots[i], inv.slots[i]);
      this.hotbarSlots[i].classList.toggle('selected', i === inv.selected);
    }
  }

  showItemName(inv) {
    const s = inv.held;
    this.itemNameEl.textContent = s ? ITEMS[s.id].name : '';
    this.itemNameEl.classList.remove('show'); void this.itemNameEl.offsetWidth;
    if (s) this.itemNameEl.classList.add('show');
  }

  updateBars(player) {
    const armor = this.inventory ? this.inventory.armorPoints() : 0;
    const key = [player.mode, Math.ceil(player.health), player.hunger, Math.ceil(player.air / 30), player.headInWater, armor].join('|');
    if (key === this._lastHUD) return;
    this._lastHUD = key;
    this.barsEl.hidden = player.mode === 'creative';
    let h = '';
    for (let i = 0; i < 10; i++) {
      const v = player.health - i * 2;
      h += `<span class="heart ${v >= 2 ? 'full' : v === 1 ? 'half' : 'empty'}"></span>`;
    }
    this.heartsEl.innerHTML = h;
    let ar = '';
    if (armor > 0) for (let i = 0; i < 10; i++) { const v = armor - i * 2; ar += `<span class="shield ${v >= 2 ? 'full' : v === 1 ? 'half' : 'empty'}"></span>`; }
    this.armorEl.innerHTML = ar;
    let f = '';
    for (let i = 0; i < 10; i++) {
      const v = player.hunger - i * 2;
      f += `<span class="drum ${v >= 2 ? 'full' : v === 1 ? 'half' : 'empty'}"></span>`;
    }
    this.foodEl.innerHTML = f;
    let a = '';
    if (player.headInWater || player.air < player.maxAir) {
      const n = Math.ceil(player.air / 30);
      for (let i = 0; i < 10; i++) a += `<span class="bubble ${i < n ? '' : 'empty'}"></span>`;
    }
    this.airEl.innerHTML = a;
  }

  flashDamage() { this.flashEl.classList.remove('on'); void this.flashEl.offsetWidth; this.flashEl.classList.add('on'); }

  message(text, ms = 3500) {
    const m = document.createElement('div');
    m.textContent = text;
    this.messagesEl.appendChild(m);
    setTimeout(() => m.remove(), ms);
  }

  // ---------- telas ----------
  isOpen() { return !!this.screen; }

  open(name, build) {
    this.close(true);
    this.screen = name;
    const overlay = document.createElement('div');
    overlay.className = 'screen-overlay';
    const panel = document.createElement('div');
    panel.className = 'panel';
    overlay.appendChild(panel);
    overlay.addEventListener('contextmenu', (e) => e.preventDefault());
    this.root.appendChild(overlay);
    this.overlay = overlay;
    this.refreshers = [];
    this.closeHooks = [];
    build(panel);
    this.refresh();
  }

  close(silent = false) {
    if (!this.screen) return;
    for (const fn of this.closeHooks) fn();
    if (this.cursor) { this.giveBack(this.cursor); this.cursor = null; }
    this.overlay.remove();
    this.overlay = null;
    this.screen = null;
    this.tooltip.hidden = true;
    this.renderCursor();
    if (!silent && this.onClose) this.onClose();
  }

  giveBack(stack) {
    if (!stack) return;
    const left = this.inventory.add(stack.id, stack.count, stack.dmg);
    if (left > 0 && this.dropToWorld) this.dropToWorld({ id: stack.id, count: left, dmg: stack.dmg });
  }

  refresh() { for (const r of this.refreshers) r(); this.renderCursor(); }
  renderCursor() { this.renderStack(this.cursorEl, this.cursor); }

  // Cria um slot ligado a um "ref" { get, set, output?, canPlace?, onTake?, group }
  slot(parent, ref, cls = '') {
    const el = document.createElement('div');
    el.className = 'slot ' + cls;
    parent.appendChild(el);
    this.refreshers.push(() => this.renderStack(el, ref.get()));
    el.addEventListener('mousedown', (e) => { e.preventDefault(); this.clickSlot(ref, e.button, e.shiftKey); this.refresh(); });
    el.addEventListener('mouseenter', () => {
      const s = ref.get();
      if (!s) return;
      this.tooltip.textContent = ITEMS[s.id].name + (ITEMS[s.id].durability && s.dmg ? `  (${ITEMS[s.id].durability - s.dmg}/${ITEMS[s.id].durability})` : '');
      this.tooltip.hidden = false;
    });
    el.addEventListener('mousemove', (e) => { this.tooltip.style.left = e.clientX + 14 + 'px'; this.tooltip.style.top = e.clientY - 10 + 'px'; });
    el.addEventListener('mouseleave', () => { this.tooltip.hidden = true; });
    return el;
  }

  clickSlot(ref, button, shift) {
    const cur = this.cursor;
    const st = ref.get();
    if (ref.creative) {
      if (shift) { this.inventory.add(ref.itemId, maxStack(ref.itemId)); return; }
      if (cur && cur.id === ref.itemId) { cur.count = Math.min(maxStack(cur.id), cur.count + 1); return; }
      this.cursor = makeStack(ref.itemId, button === 2 ? 1 : maxStack(ref.itemId));
      return;
    }
    if (ref.trash) { this.cursor = null; return; }
    if (ref.output) {
      if (!st) return;
      if (shift) {
        // fabrica o máximo possível direto para o inventário
        let guard = 64;
        while (ref.get() && guard-- > 0) {
          const out = ref.get();
          if (this.inventory.add(out.id, out.count, out.dmg) > 0) break;
          ref.onTake();
        }
        return;
      }
      if (!cur) { this.cursor = cloneStack(st); ref.onTake(); }
      else if (cur.id === st.id && cur.count + st.count <= maxStack(st.id)) { cur.count += st.count; ref.onTake(); }
      return;
    }
    if (shift && st && ref.quickMove) { ref.quickMove(); return; }
    const canPlace = (s) => !ref.canPlace || ref.canPlace(s);
    if (button === 2) { // botão direito
      if (!cur && st) {
        const half = Math.ceil(st.count / 2);
        this.cursor = { id: st.id, count: half, dmg: st.dmg };
        st.count -= half; ref.set(st.count > 0 ? st : null);
      } else if (cur && canPlace(cur)) {
        if (!st) { ref.set({ id: cur.id, count: 1, dmg: cur.dmg }); cur.count--; }
        else if (st.id === cur.id && st.count < maxStack(st.id)) { st.count++; cur.count--; ref.set(st); }
        if (cur.count <= 0) this.cursor = null;
      }
      return;
    }
    if (!cur) { if (st) { this.cursor = st; ref.set(null); } return; }
    if (!canPlace(cur)) return;
    if (!st) { ref.set(cur); this.cursor = null; return; }
    if (st.id === cur.id && maxStack(st.id) > 1) {
      const n = Math.min(maxStack(st.id) - st.count, cur.count);
      st.count += n; cur.count -= n; ref.set(st);
      if (cur.count <= 0) this.cursor = null;
      return;
    }
    ref.set(cur); this.cursor = st;
  }

  // refs de slots do inventário do jogador
  invRef(i, otherTarget) {
    const inv = this.inventory;
    return {
      get: () => inv.slots[i],
      set: (v) => { inv.slots[i] = v; inv.changed(); },
      quickMove: () => {
        const s = inv.slots[i];
        const ar = ITEMS[s.id].armor;
        if (!otherTarget && ar && !inv.armor[ar.slot]) { inv.armor[ar.slot] = s; inv.slots[i] = null; }
        else if (otherTarget) { const left = otherTarget(s); inv.slots[i] = left > 0 ? { ...s, count: left } : null; }
        else {
          // hotbar ↔ inventário principal
          inv.slots[i] = null;
          const range = i < 9 ? [9, 36] : [0, 9];
          let left = s.count;
          for (let k = range[0]; k < range[1] && left > 0; k++) {
            const t = inv.slots[k];
            if (t && t.id === s.id && t.count < maxStack(s.id) && !ITEMS[s.id].durability) { const n = Math.min(maxStack(s.id) - t.count, left); t.count += n; left -= n; }
          }
          for (let k = range[0]; k < range[1] && left > 0; k++) if (!inv.slots[k]) { inv.slots[k] = { ...s, count: left }; left = 0; }
          if (left > 0) inv.slots[i] = { ...s, count: left };
        }
        inv.changed();
      },
    };
  }

  playerInventorySection(panel, otherTarget) {
    const main = document.createElement('div'); main.className = 'grid g9';
    for (let i = 9; i < 36; i++) this.slot(main, this.invRef(i, otherTarget));
    const bar = document.createElement('div'); bar.className = 'grid g9 hotbar-row';
    for (let i = 0; i < 9; i++) this.slot(bar, this.invRef(i, otherTarget));
    const label = document.createElement('h3'); label.textContent = t('inv.title');
    panel.append(label, main, bar);
  }

  // Grade de crafting (2x2 ou 3x3) com slot de resultado
  craftingSection(panel, size) {
    const grid = new Array(size * size).fill(null);
    const wrap = document.createElement('div'); wrap.className = 'craft';
    const g = document.createElement('div'); g.className = 'grid g' + size;
    const arrow = document.createElement('div'); arrow.className = 'arrow'; arrow.textContent = '➜';
    const outWrap = document.createElement('div');
    const result = () => {
      const r = matchRecipe(grid.map((s) => (s ? s.id : 0)), size);
      return r ? { id: r.id, count: r.count, dmg: 0 } : null;
    };
    for (let i = 0; i < grid.length; i++) {
      this.slot(g, {
        get: () => grid[i], set: (v) => { grid[i] = v; },
        quickMove: () => { const s = grid[i]; const left = this.inventory.add(s.id, s.count, s.dmg); grid[i] = left ? { ...s, count: left } : null; },
      });
    }
    this.slot(outWrap, {
      output: true, get: result,
      onTake: () => { for (let i = 0; i < grid.length; i++) if (grid[i]) { grid[i].count--; if (grid[i].count <= 0) grid[i] = null; } },
    }, 'big');
    wrap.append(g, arrow, outWrap);
    const label = document.createElement('h3'); label.textContent = size === 2 ? t('inv.crafting') : t('inv.table');
    if (this.armorSlotsFor) {
      const row = document.createElement('div'); row.className = 'inv-top';
      const col = document.createElement('div'); col.className = 'armor-col';
      this.armorSlotsFor(col);
      const right = document.createElement('div'); right.append(label, wrap);
      row.append(col, right);
      panel.append(row);
      this.armorSlotsFor = null;
    } else panel.append(label, wrap);
    this.closeHooks.push(() => { for (const s of grid) if (s) this.giveBack(s); grid.fill(null); });
    // shift-clique no inventário manda para a grade? (não no MC) → mantemos troca hotbar/inventário
  }

  openInventory(inv, mode, allItems) {
    this.inventory = inv;
    if (mode === 'creative') return this.openCreative(inv, allItems);
    this.open('inventory', (panel) => {
      this.armorSlotsFor = (col) => {
        const h = document.createElement('h3'); h.textContent = t('inv.armor'); col.appendChild(h);
        for (let k = 0; k < 4; k++) {
          const el = this.slot(col, {
            get: () => inv.armor[k], set: (v) => { inv.armor[k] = v; inv.changed(); },
            canPlace: (st) => !!(ITEMS[st.id].armor && ITEMS[st.id].armor.slot === k),
            quickMove: () => { const st = inv.armor[k]; if (inv.add(st.id, 1, st.dmg) === 0) { inv.armor[k] = null; inv.changed(); } },
          }, 'armor armor-' + k);
          el.dataset.slot = k;
        }
      };
      this.craftingSection(panel, 2);
      this.playerInventorySection(panel);
    });
  }

  openCraftingTable(inv) {
    this.inventory = inv;
    this.open('crafting', (panel) => { this.craftingSection(panel, 3); this.playerInventorySection(panel); });
  }

  openCreative(inv, allItems) {
    this.inventory = inv;
    this.open('creative', (panel) => {
      panel.classList.add('wide');
      const h = document.createElement('h3'); h.textContent = t('inv.creative');
      const search = document.createElement('input');
      search.id = 'creative-search'; search.placeholder = t('inv.search'); search.className = 'search';
      const pal = document.createElement('div'); pal.className = 'grid g9 palette';
      const fill = () => {
        pal.innerHTML = '';
        const q = search.value.trim().toLowerCase();
        for (const id of allItems) {
          if (q && !ITEMS[id].name.toLowerCase().includes(q) && !ITEMS[id].key.includes(q)) continue;
          const el = this.slot(pal, { creative: true, itemId: id, get: () => ({ id, count: 1 }) });
          this.renderStack(el, { id, count: 1 });
        }
      };
      search.addEventListener('input', fill);
      search.addEventListener('keydown', (e) => e.stopPropagation());
      fill();
      const bar = document.createElement('div'); bar.className = 'grid g9 hotbar-row';
      for (let i = 0; i < 9; i++) this.slot(bar, this.invRef(i));
      const trashRow = document.createElement('div'); trashRow.className = 'trash-row';
      const tl = document.createElement('span'); tl.textContent = t('inv.trash');
      trashRow.appendChild(tl);
      this.slot(trashRow, { trash: true, get: () => null }, 'trash');
      panel.append(h, search, pal, bar, trashRow);
    });
  }

  openChest(inv, state) {
    this.inventory = inv;
    const toChest = (s) => {
      let left = s.count;
      for (let k = 0; k < 27 && left > 0; k++) {
        const t = state.slots[k];
        if (t && t.id === s.id && t.count < maxStack(s.id)) { const n = Math.min(maxStack(s.id) - t.count, left); t.count += n; left -= n; }
      }
      for (let k = 0; k < 27 && left > 0; k++) if (!state.slots[k]) { state.slots[k] = { ...s, count: left }; left = 0; }
      return left;
    };
    this.open('chest', (panel) => {
      const h = document.createElement('h3'); h.textContent = t('inv.chest');
      const g = document.createElement('div'); g.className = 'grid g9';
      for (let i = 0; i < 27; i++) this.slot(g, {
        get: () => state.slots[i], set: (v) => { state.slots[i] = v; },
        quickMove: () => { const s = state.slots[i]; const left = inv.add(s.id, s.count, s.dmg); state.slots[i] = left ? { ...s, count: left } : null; },
      });
      panel.append(h, g);
      this.playerInventorySection(panel, toChest);
    });
  }

  openFurnace(inv, state) {
    this.inventory = inv;
    const toFurnace = (s) => {
      const it = ITEMS[s.id];
      const key = it.smelt ? 'input' : it.fuel ? 'fuel' : null;
      if (!key) return s.count;
      const t = state[key];
      if (!t) { state[key] = { ...s }; return 0; }
      if (t.id !== s.id) return s.count;
      const n = Math.min(maxStack(s.id) - t.count, s.count);
      t.count += n; return s.count - n;
    };
    this.open('furnace', (panel) => {
      const h = document.createElement('h3'); h.textContent = t('inv.furnace');
      const wrap = document.createElement('div'); wrap.className = 'furnace';
      const col = document.createElement('div'); col.className = 'furnace-col';
      const mkRef = (key, canPlace) => ({
        get: () => state[key], set: (v) => { state[key] = v; }, canPlace,
        quickMove: () => { const s = state[key]; const left = inv.add(s.id, s.count, s.dmg); state[key] = left ? { ...s, count: left } : null; },
      });
      this.slot(col, mkRef('input', (s) => !!ITEMS[s.id].smelt));
      const flame = document.createElement('div'); flame.className = 'flame'; flame.innerHTML = '<div></div>';
      col.appendChild(flame);
      this.slot(col, mkRef('fuel', (s) => !!ITEMS[s.id].fuel));
      const prog = document.createElement('div'); prog.className = 'progress'; prog.innerHTML = '<div></div>';
      const out = document.createElement('div');
      this.slot(out, { ...mkRef('output', () => false) }, 'big');
      wrap.append(col, prog, out);
      panel.append(h, wrap);
      this.playerInventorySection(panel, toFurnace);
      this.refreshers.push(() => {
        prog.firstChild.style.width = (state.cook / COOK_TIME * 100) + '%';
        flame.firstChild.style.height = (state.burnMax ? state.burn / state.burnMax * 100 : 0) + '%';
      });
    });
  }

  // ---------- chat ----------
  chatLine(text, kind = '') {
    for (const line of String(text).split('\n')) {
      const d = document.createElement('div');
      d.className = 'chat-line ' + kind; d.textContent = line;
      d.dataset.time = Date.now();
      this.chatLog.appendChild(d);
      const m = document.createElement('div'); m.textContent = line; m.className = kind;
      this.messagesEl.appendChild(m); setTimeout(() => m.remove(), 6000);
    }
    while (this.chatLog.children.length > 60) this.chatLog.firstChild.remove();
    this.chatLog.scrollTop = this.chatLog.scrollHeight;
  }

  setDebug(text) {
    if (text === null) { this.debugEl.hidden = true; return; }
    this.debugEl.hidden = false;
    this.debugEl.textContent = text;
  }
}
