// systems/Furnace.js
// Fornalha como "block entity": um bloco que tem estado próprio salvo junto do chunk.
// A cada tick (20 por segundo): se tem algo fundível e combustível, queima e avança o cozimento.
// Cozinhar 1 item leva 200 ticks (10 s), igual ao Minecraft.
import { ITEMS, maxStack } from './Items.js';

export const COOK_TIME = 200;

export function createFurnaceState() {
  return { type: 'furnace', input: null, fuel: null, output: null, burn: 0, burnMax: 0, cook: 0 };
}

export function createChestState() {
  return { type: 'chest', slots: new Array(27).fill(null) };
}

function canSmelt(st) {
  if (!st.input) return false;
  const res = ITEMS[st.input.id] && ITEMS[st.input.id].smelt;
  if (!res) return false;
  if (!st.output) return true;
  return st.output.id === res && st.output.count < maxStack(res);
}

// Retorna true se o estado mudou (para atualizar a interface aberta)
export function tickFurnace(st) {
  let changed = false;
  if (st.burn > 0) st.burn--;
  if (st.burn <= 0 && canSmelt(st) && st.fuel) {
    const f = ITEMS[st.fuel.id] && ITEMS[st.fuel.id].fuel;
    if (f) {
      st.burn = st.burnMax = f;
      st.fuel.count--;
      if (st.fuel.count <= 0) st.fuel = null;
      changed = true;
    }
  }
  if (st.burn > 0 && canSmelt(st)) {
    st.cook++;
    if (st.cook >= COOK_TIME) {
      st.cook = 0;
      const res = ITEMS[st.input.id].smelt;
      if (st.output) st.output.count++;
      else st.output = { id: res, count: 1, dmg: 0 };
      st.input.count--;
      if (st.input.count <= 0) st.input = null;
    }
    changed = true;
  } else if (st.cook > 0) {
    st.cook = Math.max(0, st.cook - 2);
    changed = true;
  }
  return changed;
}

export function isFurnaceActive(st) { return st.burn > 0; }
