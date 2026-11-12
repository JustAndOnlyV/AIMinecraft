// systems/Items.js
// Itens: IDs 1-255 são os próprios blocos (o item "Terra" coloca o bloco Terra); 256+ são itens puros.
// Ferramentas e armaduras são geradas por "família" (material x tipo) para não repetir código.
import { BLOCKS, B, TILE, WOODS } from '../world/Blocks.js';
import { itemName } from './i18n.js';

export const I = {
  STICK: 256, COAL: 257, IRON_INGOT: 258, FLINT: 259, FLINT_AND_STEEL: 260, LAPIS: 261, STRING: 262, BONE: 263,
  WOOD_PICKAXE: 264, STONE_PICKAXE: 265, IRON_PICKAXE: 266, WOOD_SWORD: 267, STONE_SWORD: 268, IRON_SWORD: 269,
  WOOD_AXE: 270, STONE_AXE: 271, IRON_AXE: 272, WOOD_SHOVEL: 273, STONE_SHOVEL: 274, IRON_SHOVEL: 275,
  PORKCHOP: 276, COOKED_PORKCHOP: 277, BEEF: 278, STEAK: 279, CHICKEN: 280, COOKED_CHICKEN: 281,
  MUTTON: 282, COOKED_MUTTON: 283, APPLE: 284, ROTTEN_FLESH: 285, ARROW: 286, FEATHER: 287, LEATHER: 288,
  GLOWSTONE_DUST: 289, BUCKET: 290, WATER_BUCKET: 291, LAVA_BUCKET: 292, BREAD: 293, SEEDS: 294, GOLD_NUGGET: 295,
  GOLD_INGOT: 296, PLATINUM_INGOT: 297, DIAMOND: 298, EMERALD: 299, SAPPHIRE: 300, AMETHYST_SHARD: 301, QUARTZ: 302, ZANITE: 303, AMBROSIUM: 304,
};

class Item {
  constructor(o) { Object.assign(this, { maxStack: 64, isBlock: false }, o); }
  get name() { return itemName(this); }
}
export const ITEMS = [];
function item(id, key, tile, o = {}) { ITEMS[id] = new Item(Object.assign({ id, key, tile }, o)); }

// Blocos viram itens automaticamente
for (const d of BLOCKS) {
  if (!d || d.id === B.AIR) continue;
  ITEMS[d.id] = new Item({ id: d.id, key: d.key, tpl: d.tpl, mat: d.mat, tile: d.itemTile ?? d.side ?? d.top, isBlock: true, block: d.id, hidden: d.hidden });
}
for (const W of WOODS) if (W.door) ITEMS[W.door].maxStack = 16;
ITEMS[B.BED].maxStack = 1;

item(I.STICK, 'stick', TILE.stick, { fuel: 100 });
item(I.COAL, 'coal', TILE.coal, { fuel: 1600 });
item(I.IRON_INGOT, 'iron_ingot', TILE.iron_ingot);
item(I.GOLD_INGOT, 'gold_ingot', TILE.gold_ingot);
item(I.PLATINUM_INGOT, 'platinum_ingot', TILE.platinum_ingot);
item(I.DIAMOND, 'diamond', TILE.diamond);
item(I.EMERALD, 'emerald', TILE.emerald);
item(I.SAPPHIRE, 'sapphire', TILE.sapphire);
item(I.AMETHYST_SHARD, 'amethyst_shard', TILE.amethyst_shard);
item(I.QUARTZ, 'quartz', TILE.quartz);
item(I.ZANITE, 'zanite_gemstone', TILE.zanite);
item(I.AMBROSIUM, 'ambrosium_shard', TILE.ambrosium, { fuel: 500, heal: 2, food: 1 });
item(I.FLINT, 'flint', TILE.flint);
item(I.FLINT_AND_STEEL, 'flint_and_steel', TILE.flint_and_steel, { maxStack: 1, durability: 64 });
item(I.LAPIS, 'lapis_lazuli', TILE.lapis);
item(I.STRING, 'string', TILE.string);
item(I.BONE, 'bone', TILE.bone);
item(I.PORKCHOP, 'porkchop', TILE.porkchop, { food: 3, smelt: I.COOKED_PORKCHOP });
item(I.COOKED_PORKCHOP, 'cooked_porkchop', TILE.cooked_porkchop, { food: 8 });
item(I.BEEF, 'beef', TILE.beef, { food: 3, smelt: I.STEAK });
item(I.STEAK, 'steak', TILE.steak, { food: 8 });
item(I.CHICKEN, 'chicken', TILE.chicken, { food: 2, smelt: I.COOKED_CHICKEN });
item(I.COOKED_CHICKEN, 'cooked_chicken', TILE.cooked_chicken, { food: 6 });
item(I.MUTTON, 'mutton', TILE.mutton, { food: 2, smelt: I.COOKED_MUTTON });
item(I.COOKED_MUTTON, 'cooked_mutton', TILE.cooked_mutton, { food: 6 });
item(I.APPLE, 'apple', TILE.apple, { food: 4 });
item(I.ROTTEN_FLESH, 'rotten_flesh', TILE.rotten_flesh, { food: 2 });
item(I.ARROW, 'arrow', TILE.arrow);
item(I.FEATHER, 'feather', TILE.feather);
item(I.LEATHER, 'leather', TILE.leather);
item(I.GLOWSTONE_DUST, 'glowstone_dust', TILE.glowstone_dust);
item(I.BUCKET, 'bucket', TILE.bucket, { maxStack: 16 });
item(I.WATER_BUCKET, 'water_bucket', TILE.water_bucket, { maxStack: 1 });
item(I.LAVA_BUCKET, 'lava_bucket', TILE.lava_bucket, { maxStack: 1, fuel: 20000 });
item(I.BREAD, 'bread', TILE.bread, { food: 5 });
item(I.SEEDS, 'wheat_seeds', TILE.wheat_seeds);
item(I.GOLD_NUGGET, 'gold_nugget', TILE.gold_nugget);

// ---------- ferramentas (material x tipo) ----------
// tier: 1 madeira/ouro · 2 pedra · 3 ferro · 4 diamante/platina
export const TOOL_MATS = [
  { m: 'wood', word: 'wooden', tier: 1, speed: 2, dur: 60, dmg: 0, ids: [I.WOOD_PICKAXE, I.WOOD_SWORD, I.WOOD_AXE, I.WOOD_SHOVEL] },
  { m: 'stone', word: 'stone', tier: 2, speed: 4, dur: 132, dmg: 1, ids: [I.STONE_PICKAXE, I.STONE_SWORD, I.STONE_AXE, I.STONE_SHOVEL] },
  { m: 'iron', word: 'iron', tier: 3, speed: 6, dur: 251, dmg: 2, ids: [I.IRON_PICKAXE, I.IRON_SWORD, I.IRON_AXE, I.IRON_SHOVEL] },
  { m: 'gold', word: 'golden', tier: 1, speed: 12, dur: 33, dmg: 0, ids: [305, 306, 307, 308] },
  { m: 'diamond', word: 'diamond', tier: 4, speed: 8, dur: 1561, dmg: 3, ids: [309, 310, 311, 312] },
  { m: 'platinum', word: 'platinum', tier: 4, speed: 9, dur: 900, dmg: 3, ids: [313, 314, 315, 316] },
];
const TOOL_TYPES = ['pickaxe', 'sword', 'axe', 'shovel'];
const TOOL_BASE_DMG = { pickaxe: 2, sword: 4, axe: 3, shovel: 1.5 };
for (const T of TOOL_MATS) {
  TOOL_TYPES.forEach((type, k) => {
    const id = T.ids[k];
    item(id, `${T.m === 'wood' ? 'wooden' : T.m === 'gold' ? 'golden' : T.m}_${type}`, TILE[`${T.m}_${type}`], {
      tpl: type, mat: T.word, maxStack: 1, tool: { type, tier: T.tier, speed: T.speed }, damage: TOOL_BASE_DMG[type] + T.dmg, durability: T.dur,
      fuel: T.m === 'wood' ? 200 : undefined,
    });
    if (T.m === 'wood') { I[`WOOD_${type.toUpperCase()}`] = id; }
    I[`${T.m.toUpperCase()}_${type.toUpperCase()}`] = id;
  });
}

// ---------- armaduras ----------
export const ARMOR_SLOTS = ['helmet', 'chestplate', 'leggings', 'boots'];
export const ARMOR_MATS = [
  { m: 'leather', word: 'leather', pts: [1, 3, 2, 1], dur: [55, 80, 75, 65], base: 320 },
  { m: 'iron', word: 'iron', pts: [2, 6, 5, 2], dur: [165, 240, 225, 195], base: 324 },
  { m: 'gold', word: 'golden', pts: [2, 5, 3, 1], dur: [77, 112, 105, 91], base: 328 },
  { m: 'diamond', word: 'diamond', pts: [3, 8, 6, 3], dur: [363, 528, 495, 429], base: 332 },
  { m: 'platinum', word: 'platinum', pts: [3, 7, 6, 3], dur: [260, 380, 350, 300], base: 336 },
];
for (const A of ARMOR_MATS) {
  ARMOR_SLOTS.forEach((slot, k) => {
    const id = A.base + k;
    item(id, `${A.m === 'gold' ? 'golden' : A.m}_${slot}`, TILE[`${A.m}_${slot}`], {
      tpl: slot, mat: A.word, maxStack: 1, armor: { slot: k, points: A.pts[k] }, durability: A.dur[k],
    });
    I[`${A.m.toUpperCase()}_${slot.toUpperCase()}`] = id;
  });
}

// Combustível e fundição de blocos
for (const W of WOODS) {
  for (const k of ['log', 'planks', 'stairs', 'fence', 'door', 'sapling']) if (W[k] && ITEMS[W[k]]) ITEMS[W[k]].fuel = k === 'sapling' ? 100 : 300;
  if (W.slab) ITEMS[W.slab].fuel = 150;
  ITEMS[W.log].smelt = I.COAL;
}
ITEMS[B.CRAFTING_TABLE].fuel = 300; ITEMS[B.CHEST].fuel = 300; ITEMS[B.COAL_BLOCK].fuel = 16000;
ITEMS[B.IRON_ORE].smelt = I.IRON_INGOT;
ITEMS[B.GOLD_ORE].smelt = I.GOLD_INGOT;
ITEMS[B.PLATINUM_ORE].smelt = I.PLATINUM_INGOT;
ITEMS[B.SAND].smelt = B.GLASS;
ITEMS[B.COBBLE].smelt = B.STONE;
ITEMS[B.QUARTZ_BLOCK].smelt = B.SMOOTH_QUARTZ;

// Mapa "chave → id" para os comandos (/give diamond_sword)
export const ITEM_BY_KEY = new Map();
for (const it of ITEMS) if (it) ITEM_BY_KEY.set(it.key, it.id);

export function getItem(id) { return ITEMS[id]; }
export function maxStack(id) { return ITEMS[id] ? ITEMS[id].maxStack : 64; }
export function isPlaceable(id) { return !!(ITEMS[id] && ITEMS[id].isBlock); }

// Tempo para quebrar um bloco (segundos) com a ferramenta na mão
export function breakTime(blockId, heldId) {
  const d = BLOCKS[blockId];
  if (!d || d.hardness < 0) return Infinity;
  if (d.hardness === 0) return 0.05;
  const it = ITEMS[heldId];
  const t = it && it.tool;
  const right = t && d.tool && t.type === d.tool;
  const harvest = canHarvest(blockId, heldId);
  let speed = right ? t.speed : 1;
  if (t && t.type === 'sword' && d.leaves) speed = 1.5;
  return Math.max(0.05, d.hardness * (harvest ? 1.5 : 5) / speed);
}

export function canHarvest(blockId, heldId) {
  const d = BLOCKS[blockId];
  if (!d.needsTool) return true;
  const t = ITEMS[heldId] && ITEMS[heldId].tool;
  return !!(t && t.type === d.tool && t.tier >= Math.max(1, d.minTier));
}

// O que cai ao quebrar um bloco: [[id, qtd], ...]
export function blockDrops(blockId, heldId, rand = Math.random, meta = 0) {
  const d = BLOCKS[blockId];
  if (!canHarvest(blockId, heldId)) return [];
  if (d.leaves) {
    const out = [];
    if (rand() < 0.06) out.push([d.sapling, 1]);
    if (blockId === B.LEAVES && rand() < 0.01) out.push([I.APPLE, 1]);
    if (rand() < 0.03) out.push([I.STICK, 1]);
    return out;
  }
  if (d.shape === 'door' && (meta & 8)) return []; // a metade de cima não dropa (a de baixo dropa)
  if (d.shape === 'bed' && (meta & 8)) return [];
  if (blockId === B.GRAVEL) return [[rand() < 0.15 ? I.FLINT : B.GRAVEL, 1]];
  if (blockId === B.TALLGRASS || blockId === B.FERN) return rand() < 0.12 ? [[I.SEEDS, 1]] : [];
  if (blockId === B.GLOWSTONE) return [[I.GLOWSTONE_DUST, 2 + Math.floor(rand() * 3)]];
  if (blockId === B.LAPIS_ORE) return [[I.LAPIS, 4 + Math.floor(rand() * 4)]];
  if (blockId === B.AMETHYST_ORE) return [[I.AMETHYST_SHARD, 2 + Math.floor(rand() * 3)]];
  if (blockId === B.QUARTZ_ORE) return [[I.QUARTZ, 1 + Math.floor(rand() * 2)]];
  if (d.drop === null) return [];
  return [[d.drop, 1]];
}
