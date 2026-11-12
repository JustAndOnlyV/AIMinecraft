// systems/Inventory.js
// Inventário = array de "slots". Cada slot é null ou uma pilha { id, count, dmg }.
// Slots 0-8 são a hotbar (barra de atalhos); 9-35 são o inventário principal.
import { maxStack, ITEMS } from './Items.js';

export function makeStack(id, count = 1, dmg = 0) { return { id, count, dmg }; }
export function cloneStack(s) { return s ? { id: s.id, count: s.count, dmg: s.dmg || 0 } : null; }
export function sameItem(a, b) { return a && b && a.id === b.id && !(ITEMS[a.id] && ITEMS[a.id].durability); }

export class Inventory {
  constructor(size = 36) {
    this.size = size;
    this.slots = new Array(size).fill(null);
    this.armor = [null, null, null, null]; // capacete, peitoral, calças, botas
    this.selected = 0;
    this.listeners = new Set();
  }

  onChange(fn) { this.listeners.add(fn); }
  changed() { for (const fn of this.listeners) fn(this); }

  get held() { return this.slots[this.selected]; }

  // Adiciona itens: primeiro completa pilhas existentes, depois ocupa slots vazios (hotbar primeiro).
  add(id, count = 1, dmg = 0) {
    const max = maxStack(id);
    let left = count;
    if (max > 1) {
      for (let i = 0; i < this.size && left > 0; i++) {
        const s = this.slots[i];
        if (s && s.id === id && s.count < max) {
          const n = Math.min(max - s.count, left);
          s.count += n; left -= n;
        }
      }
    }
    for (let i = 0; i < this.size && left > 0; i++) {
      if (!this.slots[i]) {
        const n = Math.min(max, left);
        this.slots[i] = makeStack(id, n, dmg);
        left -= n;
      }
    }
    if (left !== count) this.changed();
    return left; // o que não coube
  }

  count(id) { return this.slots.reduce((a, s) => a + (s && s.id === id ? s.count : 0), 0); }

  remove(id, count = 1) {
    let left = count;
    for (let i = this.size - 1; i >= 0 && left > 0; i--) {
      const s = this.slots[i];
      if (s && s.id === id) {
        const n = Math.min(s.count, left);
        s.count -= n; left -= n;
        if (s.count <= 0) this.slots[i] = null;
      }
    }
    this.changed();
    return count - left;
  }

  consumeHeld(n = 1) {
    const s = this.held;
    if (!s) return;
    s.count -= n;
    if (s.count <= 0) this.slots[this.selected] = null;
    this.changed();
  }

  // Desgaste de ferramenta; quebra quando chega no limite
  damageHeld(amount = 1) {
    const s = this.held;
    if (!s) return false;
    const it = ITEMS[s.id];
    if (!it || !it.durability) return false;
    s.dmg = (s.dmg || 0) + amount;
    if (s.dmg >= it.durability) { this.slots[this.selected] = null; this.changed(); return true; }
    this.changed();
    return false;
  }

  clear() { this.slots.fill(null); this.armor.fill(null); this.changed(); }

  armorPoints() { return this.armor.reduce((a, s) => a + (s && ITEMS[s.id].armor ? ITEMS[s.id].armor.points : 0), 0); }

  // Cada peça perde durabilidade ao absorver dano; quebra no limite
  damageArmor(n) {
    let broke = false;
    for (let i = 0; i < 4; i++) {
      const s = this.armor[i];
      if (!s) continue;
      s.dmg = (s.dmg || 0) + n;
      if (s.dmg >= ITEMS[s.id].durability) { this.armor[i] = null; broke = true; }
    }
    this.changed();
    return broke;
  }

  serialize() { return { slots: this.slots.map(cloneStack), armor: this.armor.map(cloneStack), selected: this.selected }; }
  load(d) {
    if (!d) return;
    this.armor = (d.armor || [null, null, null, null]).map(cloneStack);
    this.slots = d.slots.map(cloneStack);
    while (this.slots.length < this.size) this.slots.push(null);
    this.selected = d.selected || 0;
    this.changed();
  }
}
