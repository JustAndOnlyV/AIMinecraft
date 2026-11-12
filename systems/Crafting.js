// systems/Crafting.js
// Receitas "shaped" (com formato, ex: picareta) e "shapeless" (sem formato, ex: tronco → tábuas).
// O casamento funciona assim: recortamos a grade para o menor retângulo que contém itens
// e comparamos com o padrão da receita (também testando a versão espelhada).
import { B, WOODS } from '../world/Blocks.js';
import { I, TOOL_MATS, ARMOR_MATS } from './Items.js';

const RECIPES = [];
function shaped(pattern, key, id, count = 1) { RECIPES.push({ type: 'shaped', pattern, key, result: { id, count } }); }
function shapeless(ingredients, id, count = 1) { RECIPES.push({ type: 'shapeless', ingredients, result: { id, count } }); }

// ingredientes podem ser um id ou uma lista de ids aceitos
const PLANKS = WOODS.map((w) => w.planks);
const WOOL = [B.WOOL_WHITE, B.WOOL_RED, B.WOOL_BLUE, B.WOOL_GREEN, B.WOOL_YELLOW];
const COBBLES = [B.COBBLE, B.HOLYSTONE];

for (const W of WOODS) {
  shapeless([W.log], W.planks, 4);
  if (W.stairs) {
    shaped(['P  ', 'PP ', 'PPP'], { P: W.planks }, W.stairs, 4);
    shaped(['PPP'], { P: W.planks }, W.slab, 6);
    shaped(['PSP', 'PSP'], { P: W.planks, S: I.STICK }, W.fence, 3);
    shaped(['PP', 'PP', 'PP'], { P: W.planks }, W.door, 3);
  }
}
shaped(['P', 'P'], { P: PLANKS }, I.STICK, 4);
shaped(['C', 'S'], { C: [I.COAL, I.AMBROSIUM], S: I.STICK }, B.TORCH, 4);
shaped(['PP', 'PP'], { P: PLANKS }, B.CRAFTING_TABLE);
shaped(['CCC', 'C C', 'CCC'], { C: COBBLES }, B.FURNACE);
shaped(['PPP', 'P P', 'PPP'], { P: PLANKS }, B.CHEST);
shaped(['WWW', 'PPP'], { W: WOOL, P: PLANKS }, B.BED);
// pedras
shaped(['C  ', 'CC ', 'CCC'], { C: B.COBBLE }, B.COBBLE_STAIRS, 4);
shaped(['CCC'], { C: B.COBBLE }, B.COBBLE_SLAB, 6);
shaped(['CCC'], { C: B.STONE }, B.STONE_SLAB, 6);
shaped(['SS', 'SS'], { S: B.STONE }, B.STONE_BRICKS, 4);
shaped(['C  ', 'CC ', 'CCC'], { C: B.STONE_BRICKS }, B.STONE_BRICK_STAIRS, 4);
shaped(['CCC'], { C: B.STONE_BRICKS }, B.STONE_BRICK_SLAB, 6);
// quartzo
shaped(['QQ', 'QQ'], { Q: I.QUARTZ }, B.QUARTZ_BLOCK);
shaped(['Q', 'Q'], { Q: B.QUARTZ_SLAB }, B.CHISELED_QUARTZ);
shaped(['Q', 'Q'], { Q: B.QUARTZ_BLOCK }, B.QUARTZ_PILLAR, 2);
shaped(['C  ', 'CC ', 'CCC'], { C: [B.QUARTZ_BLOCK, B.QUARTZ_PILLAR, B.CHISELED_QUARTZ] }, B.QUARTZ_STAIRS, 4);
shaped(['CCC'], { C: [B.QUARTZ_BLOCK, B.QUARTZ_PILLAR, B.CHISELED_QUARTZ] }, B.QUARTZ_SLAB, 6);
// blocos de minério (9 → bloco e volta)
for (const [mat, block] of [[I.IRON_INGOT, B.IRON_BLOCK], [I.GOLD_INGOT, B.GOLD_BLOCK], [I.DIAMOND, B.DIAMOND_BLOCK], [I.EMERALD, B.EMERALD_BLOCK],
  [I.SAPPHIRE, B.SAPPHIRE_BLOCK], [I.PLATINUM_INGOT, B.PLATINUM_BLOCK], [I.LAPIS, B.LAPIS_BLOCK], [I.COAL, B.COAL_BLOCK]]) {
  shaped(['MMM', 'MMM', 'MMM'], { M: mat }, block);
  shapeless([block], mat, 9);
}
shaped(['AA', 'AA'], { A: I.AMETHYST_SHARD }, B.AMETHYST_BLOCK);
shaped(['NNN', 'NNN', 'NNN'], { N: I.GOLD_NUGGET }, I.GOLD_INGOT);
// diversos
shaped(['GG', 'GG'], { G: I.GLOWSTONE_DUST }, B.GLOWSTONE);
shaped(['SS', 'SS'], { S: I.STRING }, B.WOOL_WHITE);
shaped(['SS', 'SS'], { S: B.SNOW }, B.ICE);
shaped(['I I', ' I '], { I: I.IRON_INGOT }, I.BUCKET);
shaped(['WWW'], { W: I.SEEDS }, I.BREAD);
shapeless([I.IRON_INGOT, I.FLINT], I.FLINT_AND_STEEL);
shapeless([B.WOOL_WHITE, B.FLOWER_RED], B.WOOL_RED);
shapeless([B.WOOL_WHITE, B.FLOWER_YELLOW], B.WOOL_YELLOW);
shapeless([B.WOOL_WHITE, B.CACTUS], B.WOOL_GREEN);
shapeless([B.WOOL_WHITE, I.LAPIS], B.WOOL_BLUE);
shapeless([B.WOOL_WHITE, I.SAPPHIRE], B.WOOL_BLUE);
shapeless([I.BONE, I.BONE, I.BONE], I.STICK, 2);

// Ferramentas: material x tipo
const TOOL_HEAD = { wood: PLANKS, stone: COBBLES, iron: I.IRON_INGOT, gold: I.GOLD_INGOT, diamond: I.DIAMOND, platinum: I.PLATINUM_INGOT };
for (const T of TOOL_MATS) {
  const key = { M: TOOL_HEAD[T.m], S: I.STICK };
  const [pick, sword, axe, shovel] = T.ids;
  shaped(['MMM', ' S ', ' S '], key, pick);
  shaped(['M', 'M', 'S'], key, sword);
  shaped(['MM', 'MS', ' S'], key, axe);
  shaped(['M', 'S', 'S'], key, shovel);
}
// Armaduras
const ARMOR_MAT = { leather: I.LEATHER, iron: I.IRON_INGOT, gold: I.GOLD_INGOT, diamond: I.DIAMOND, platinum: I.PLATINUM_INGOT };
for (const A of ARMOR_MATS) {
  const key = { M: ARMOR_MAT[A.m] };
  shaped(['MMM', 'M M'], key, A.base);
  shaped(['M M', 'MMM', 'MMM'], key, A.base + 1);
  shaped(['MMM', 'M M', 'M M'], key, A.base + 2);
  shaped(['M M', 'M M'], key, A.base + 3);
}

export function allRecipes() { return RECIPES; }

const accepts = (want, id) => Array.isArray(want) ? want.includes(id) : want === id;

// grid: array de ids (0 = vazio), tamanho w x w (2 ou 3)
export function matchRecipe(grid, w) {
  // recorta para a caixa mínima
  let minX = w, minY = w, maxX = -1, maxY = -1;
  const items = [];
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
    const id = grid[y * w + x];
    if (id) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); items.push(id); }
  }
  if (!items.length) return null;
  const bw = maxX - minX + 1, bh = maxY - minY + 1;
  const at = (x, y) => grid[(y + minY) * w + (x + minX)];

  for (const r of RECIPES) {
    if (r.type === 'shapeless') {
      if (r.ingredients.length !== items.length) continue;
      const pool = items.slice();
      let ok = true;
      for (const ing of r.ingredients) {
        const k = pool.findIndex((id) => accepts(ing, id));
        if (k < 0) { ok = false; break; }
        pool.splice(k, 1);
      }
      if (ok) return r.result;
      continue;
    }
    const ph = r.pattern.length, pw = Math.max(...r.pattern.map((s) => s.length));
    if (ph !== bh || pw !== bw) continue;
    for (const mirror of [false, true]) {
      let ok = true;
      for (let y = 0; y < ph && ok; y++) for (let x = 0; x < pw && ok; x++) {
        const ch = (r.pattern[y][mirror ? pw - 1 - x : x] || ' ');
        const id = at(x, y);
        if (ch === ' ') { if (id) ok = false; }
        else if (!accepts(r.key[ch], id)) ok = false;
      }
      if (ok) return r.result;
    }
  }
  return null;
}
