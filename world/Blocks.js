// world/Blocks.js
// Registro central de blocos. Cada bloco é só um número (ID, 0-255) guardado num Uint8Array do chunk;
// aqui ficam as propriedades que dizem como ele se comporta e como é desenhado.
// Os nomes visíveis vêm do sistema de idiomas (systems/i18n.js) a partir da "key" de cada bloco.

// ---------------- Tiles do atlas (cada nome vira um quadrado 16x16) ----------------
const WOODS4 = ['oak', 'spruce', 'birch', 'jungle'];
export const TILE_NAMES = [
  'grass_top', 'grass_side', 'dirt', 'stone', 'cobblestone', 'log_side', 'log_top', 'planks',
  'leaves', 'glass', 'sand', 'water', 'lava', 'snow', 'grass_snow_side', 'ice',
  'torch', 'glowstone', 'wool_white', 'wool_red', 'wool_blue', 'wool_green', 'wool_yellow', 'tallgrass',
  'flower_red', 'flower_yellow', 'netherrack', 'obsidian', 'portal', 'coal_ore', 'iron_ore', 'bedrock',
  'cactus_side', 'cactus_top', 'table_top', 'table_side', 'furnace_front', 'furnace_side', 'furnace_top', 'chest_front',
  'chest_side', 'chest_top', 'jungle_log_side', 'jungle_log_top', 'jungle_leaves', 'spruce_log_side', 'spruce_log_top', 'spruce_leaves',
  'gravel', 'soul_sand', 'lapis_ore', 'stone_bricks', 'fence', 'nether_quartz', 'dead_bush', 'fern',
  'birch_log_side', 'birch_log_top', 'birch_leaves', 'spruce_planks', 'birch_planks', 'jungle_planks', 'skyroot_planks',
  'skyroot_log_side', 'skyroot_log_top', 'skyroot_leaves', 'golden_leaves',
  ...WOODS4.flatMap((w) => [`door_${w}_top`, `door_${w}_bottom`, `door_${w}_item`]),
  'bed_top_foot', 'bed_top_head', 'bed_side', 'bed_item', 'fire',
  'gold_ore', 'diamond_ore', 'emerald_ore', 'sapphire_ore', 'amethyst_ore', 'platinum_ore', 'zanite_ore', 'ambrosium_ore',
  'iron_block', 'gold_block', 'diamond_block', 'emerald_block', 'sapphire_block', 'amethyst_block', 'platinum_block', 'lapis_block', 'coal_block',
  'quartz_block_top', 'quartz_block_side', 'chiseled_quartz', 'quartz_pillar_side', 'quartz_pillar_top', 'smooth_quartz',
  'aether_grass_top', 'aether_grass_side', 'aether_dirt', 'holystone', 'aercloud', 'blue_aercloud', 'aether_portal',
  'sapling_oak', 'sapling_spruce', 'sapling_birch', 'sapling_jungle', 'sapling_skyroot',
  // ---- itens ----
  'stick', 'coal', 'iron_ingot', 'flint', 'flint_and_steel', 'lapis', 'string', 'bone',
  'porkchop', 'cooked_porkchop', 'beef', 'steak', 'chicken', 'cooked_chicken', 'mutton', 'cooked_mutton',
  'apple', 'rotten_flesh', 'arrow', 'feather', 'leather', 'glowstone_dust', 'bucket', 'water_bucket',
  'lava_bucket', 'bread', 'wheat_seeds', 'gold_nugget',
  'gold_ingot', 'platinum_ingot', 'diamond', 'emerald', 'sapphire', 'amethyst_shard', 'quartz', 'zanite', 'ambrosium',
  ...['wood', 'stone', 'iron', 'gold', 'diamond', 'platinum'].flatMap((m) => ['pickaxe', 'sword', 'axe', 'shovel'].map((t) => `${m}_${t}`)),
  ...['leather', 'iron', 'gold', 'diamond', 'platinum'].flatMap((m) => ['helmet', 'chestplate', 'leggings', 'boots'].map((t) => `${m}_${t}`)),
];
export const TILE = {};
TILE_NAMES.forEach((n, i) => (TILE[n] = i));
export const ATLAS_COLS = 32;

// ---------------- IDs ----------------
// Os IDs 0-48 são os mesmos da versão anterior (mundos salvos continuam válidos).
export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, LOG: 4, PLANKS: 5, LEAVES: 6, GLASS: 7, SAND: 8,
  WATER: 9, LAVA: 10, SNOW_GRASS: 11, ICE: 12, COBBLE: 13, TORCH: 14, GLOWSTONE: 15,
  WOOL_WHITE: 16, WOOL_RED: 17, WOOL_BLUE: 18, WOOL_GREEN: 19, WOOL_YELLOW: 20,
  STAIRS: 21, SLAB: 22, FENCE: 23, TALLGRASS: 24, FLOWER_RED: 25, FLOWER_YELLOW: 26,
  NETHERRACK: 27, OBSIDIAN: 28, PORTAL: 29, COAL_ORE: 30, IRON_ORE: 31, BEDROCK: 32,
  CACTUS: 33, CRAFTING_TABLE: 34, FURNACE: 35, CHEST: 36, JUNGLE_LOG: 37, JUNGLE_LEAVES: 38,
  SPRUCE_LOG: 39, SPRUCE_LEAVES: 40, GRAVEL: 41, SOUL_SAND: 42, LAPIS_ORE: 43, SNOW: 44,
  STONE_BRICKS: 45, QUARTZ_ORE: 46, DEAD_BUSH: 47, FERN: 48,
  BIRCH_LOG: 49, BIRCH_LEAVES: 50, SPRUCE_PLANKS: 51, BIRCH_PLANKS: 52, JUNGLE_PLANKS: 53,
  SPRUCE_STAIRS: 54, BIRCH_STAIRS: 55, JUNGLE_STAIRS: 56, COBBLE_STAIRS: 57, STONE_BRICK_STAIRS: 58, QUARTZ_STAIRS: 59,
  SPRUCE_SLAB: 60, BIRCH_SLAB: 61, JUNGLE_SLAB: 62, COBBLE_SLAB: 63, STONE_SLAB: 64, STONE_BRICK_SLAB: 65, QUARTZ_SLAB: 66,
  SPRUCE_FENCE: 67, BIRCH_FENCE: 68, JUNGLE_FENCE: 69,
  OAK_DOOR: 70, SPRUCE_DOOR: 71, BIRCH_DOOR: 72, JUNGLE_DOOR: 73, BED: 74, FIRE: 75,
  GOLD_ORE: 76, DIAMOND_ORE: 77, EMERALD_ORE: 78, SAPPHIRE_ORE: 79, AMETHYST_ORE: 80, PLATINUM_ORE: 81,
  IRON_BLOCK: 82, GOLD_BLOCK: 83, DIAMOND_BLOCK: 84, EMERALD_BLOCK: 85, SAPPHIRE_BLOCK: 86, AMETHYST_BLOCK: 87, PLATINUM_BLOCK: 88,
  QUARTZ_BLOCK: 89, CHISELED_QUARTZ: 90, QUARTZ_PILLAR: 91, SMOOTH_QUARTZ: 92,
  AETHER_GRASS: 93, AETHER_DIRT: 94, HOLYSTONE: 95, SKYROOT_LOG: 96, SKYROOT_LEAVES: 97, GOLDEN_LEAVES: 98,
  AERCLOUD: 99, BLUE_AERCLOUD: 100, ZANITE_ORE: 101, AMBROSIUM_ORE: 102, AETHER_PORTAL: 103, SKYROOT_PLANKS: 104,
  OAK_SAPLING: 105, SPRUCE_SAPLING: 106, BIRCH_SAPLING: 107, JUNGLE_SAPLING: 108, SKYROOT_SAPLING: 109,
  LAPIS_BLOCK: 110, COAL_BLOCK: 111,
};

// IDs de itens referenciados por blocos (drops). Definidos de verdade em systems/Items.js
const IT = { STICK: 256, COAL: 257, LAPIS: 261, DIAMOND: 298, EMERALD: 299, SAPPHIRE: 300, AMETHYST: 301, QUARTZ: 302, ZANITE: 303, AMBROSIUM: 304 };

// shape: cube | cross | torch | slab | stairs | fence | liquid | portal | door | bed | fire
// render: 'opaque' | 'cutout' (pixels 100% transparentes) | 'translucent' (semitransparente)
// sound: material do som de passo/quebra
const defs = [];
function def(id, key, o = {}) {
  const tiles = o.tiles || {};
  const all = tiles.all;
  const shape = o.shape || 'cube';
  const render = o.render || 'opaque';
  defs[id] = {
    id, key,
    tpl: o.tpl || null, mat: o.mat || null,   // nome gerado por template (ex.: "{m} Stairs")
    shape, render,
    solid: o.solid !== undefined ? o.solid : true,
    opaque: o.opaque !== undefined ? o.opaque : shape === 'cube' && render === 'opaque',
    light: o.light || 0,
    filter: o.filter || 0,
    hardness: o.hardness !== undefined ? o.hardness : 1,
    tool: o.tool || null,
    needsTool: !!o.needsTool,
    minTier: o.minTier || 0,
    drop: o.drop !== undefined ? o.drop : id,
    replaceable: !!o.replaceable,
    liquid: o.liquid || null,
    tint: o.tint || null,
    top: tiles.top ?? all, bottom: tiles.bottom ?? all, side: tiles.side ?? all, front: tiles.front ?? tiles.side ?? all,
    interact: o.interact || null,
    needsSupport: !!o.needsSupport,
    sound: o.sound || 'stone',
    flammable: o.flammable || null,  // [chance de pegar fogo, chance de ser consumido]
    full: o.full || null,            // laje dupla vira este bloco
    leaves: !!o.leaves, log: !!o.log, sapling: o.sapling || null,
    cloud: o.cloud || null,
    itemTile: o.itemTile ?? null,
    hidden: !!o.hidden,
  };
}

const WOOD_FLAME = [5, 20], LEAF_FLAME = [30, 60], PLANT_FLAME = [60, 100], WOOL_FLAME = [30, 60];

def(B.AIR, 'air', { solid: false, opaque: false, render: 'none', shape: 'none', hardness: 0, drop: null, hidden: true });
def(B.GRASS, 'grass_block', { tiles: { top: TILE.grass_top, bottom: TILE.dirt, side: TILE.grass_side }, tint: 'grass', hardness: 0.6, tool: 'shovel', drop: B.DIRT, sound: 'grass' });
def(B.DIRT, 'dirt', { tiles: { all: TILE.dirt }, hardness: 0.5, tool: 'shovel', sound: 'gravel' });
def(B.STONE, 'stone', { tiles: { all: TILE.stone }, hardness: 1.5, tool: 'pickaxe', needsTool: true, drop: B.COBBLE });
def(B.GLASS, 'glass', { tiles: { all: TILE.glass }, render: 'cutout', opaque: false, hardness: 0.3, drop: null, sound: 'glass' });
def(B.SAND, 'sand', { tiles: { all: TILE.sand }, hardness: 0.5, tool: 'shovel', sound: 'sand' });
def(B.WATER, 'water', { tiles: { all: TILE.water }, shape: 'liquid', render: 'translucent', solid: false, opaque: false, filter: 1, liquid: 'water', hardness: 100, drop: null, replaceable: true, hidden: true });
def(B.LAVA, 'lava', { tiles: { all: TILE.lava }, shape: 'liquid', render: 'opaque', solid: false, opaque: false, light: 15, liquid: 'lava', hardness: 100, drop: null, replaceable: true, hidden: true });
def(B.SNOW_GRASS, 'snowy_grass_block', { tiles: { top: TILE.snow, bottom: TILE.dirt, side: TILE.grass_snow_side }, hardness: 0.6, tool: 'shovel', drop: B.DIRT, sound: 'snow' });
def(B.ICE, 'ice', { tiles: { all: TILE.ice }, render: 'translucent', opaque: false, hardness: 0.5, tool: 'pickaxe', drop: null, sound: 'glass' });
def(B.COBBLE, 'cobblestone', { tiles: { all: TILE.cobblestone }, hardness: 2, tool: 'pickaxe', needsTool: true });
def(B.TORCH, 'torch', { tiles: { all: TILE.torch }, shape: 'torch', render: 'cutout', solid: false, opaque: false, light: 14, hardness: 0, needsSupport: true, sound: 'wood' });
def(B.GLOWSTONE, 'glowstone', { tiles: { all: TILE.glowstone }, light: 15, hardness: 0.3, sound: 'glass' });
const WOOLS = [[B.WOOL_WHITE, 'white'], [B.WOOL_RED, 'red'], [B.WOOL_BLUE, 'blue'], [B.WOOL_GREEN, 'green'], [B.WOOL_YELLOW, 'yellow']];
for (const [id, c] of WOOLS) def(id, c + '_wool', { tpl: 'wool', mat: 'color_' + c, tiles: { all: TILE['wool_' + c] }, hardness: 0.8, sound: 'cloth', flammable: WOOL_FLAME });
def(B.TALLGRASS, 'tall_grass', { tiles: { all: TILE.tallgrass }, shape: 'cross', render: 'cutout', solid: false, opaque: false, tint: 'grass', hardness: 0, drop: null, replaceable: true, needsSupport: true, sound: 'grass', flammable: PLANT_FLAME });
def(B.FLOWER_RED, 'poppy', { tiles: { all: TILE.flower_red }, shape: 'cross', render: 'cutout', solid: false, opaque: false, hardness: 0, needsSupport: true, sound: 'grass', flammable: PLANT_FLAME });
def(B.FLOWER_YELLOW, 'dandelion', { tiles: { all: TILE.flower_yellow }, shape: 'cross', render: 'cutout', solid: false, opaque: false, hardness: 0, needsSupport: true, sound: 'grass', flammable: PLANT_FLAME });
def(B.NETHERRACK, 'netherrack', { tiles: { all: TILE.netherrack }, hardness: 0.4, tool: 'pickaxe', needsTool: true });
def(B.OBSIDIAN, 'obsidian', { tiles: { all: TILE.obsidian }, hardness: 15, tool: 'pickaxe', needsTool: true, minTier: 4 });
def(B.PORTAL, 'nether_portal', { tiles: { all: TILE.portal }, shape: 'portal', render: 'translucent', solid: false, opaque: false, light: 11, hardness: 100, drop: null, sound: 'glass', hidden: true });
def(B.AETHER_PORTAL, 'aether_portal', { tiles: { all: TILE.aether_portal }, shape: 'portal', render: 'translucent', solid: false, opaque: false, light: 11, hardness: 100, drop: null, sound: 'glass', hidden: true });
def(B.BEDROCK, 'bedrock', { tiles: { all: TILE.bedrock }, hardness: -1, drop: null });
def(B.CACTUS, 'cactus', { tiles: { top: TILE.cactus_top, bottom: TILE.cactus_top, side: TILE.cactus_side }, render: 'cutout', opaque: false, hardness: 0.4, needsSupport: true, sound: 'cloth' });
def(B.CRAFTING_TABLE, 'crafting_table', { tiles: { top: TILE.table_top, bottom: TILE.planks, side: TILE.table_side }, hardness: 2.5, tool: 'axe', interact: 'crafting', sound: 'wood', flammable: WOOD_FLAME });
def(B.FURNACE, 'furnace', { tiles: { top: TILE.furnace_top, bottom: TILE.furnace_top, side: TILE.furnace_side, front: TILE.furnace_front }, hardness: 3.5, tool: 'pickaxe', needsTool: true, interact: 'furnace' });
def(B.CHEST, 'chest', { tiles: { top: TILE.chest_top, bottom: TILE.chest_top, side: TILE.chest_side, front: TILE.chest_front }, hardness: 2.5, tool: 'axe', interact: 'chest', sound: 'wood' });
def(B.GRAVEL, 'gravel', { tiles: { all: TILE.gravel }, hardness: 0.6, tool: 'shovel', sound: 'gravel' });
def(B.SOUL_SAND, 'soul_sand', { tiles: { all: TILE.soul_sand }, hardness: 0.5, tool: 'shovel', sound: 'sand' });
def(B.SNOW, 'snow_block', { tiles: { all: TILE.snow }, hardness: 0.2, tool: 'shovel', sound: 'snow' });
def(B.STONE_BRICKS, 'stone_bricks', { tiles: { all: TILE.stone_bricks }, hardness: 1.5, tool: 'pickaxe', needsTool: true });
def(B.DEAD_BUSH, 'dead_bush', { tiles: { all: TILE.dead_bush }, shape: 'cross', render: 'cutout', solid: false, opaque: false, hardness: 0, drop: IT.STICK, replaceable: true, needsSupport: true, sound: 'grass', flammable: PLANT_FLAME });
def(B.FERN, 'fern', { tiles: { all: TILE.fern }, shape: 'cross', render: 'cutout', solid: false, opaque: false, tint: 'grass', hardness: 0, drop: null, replaceable: true, needsSupport: true, sound: 'grass', flammable: PLANT_FLAME });
def(B.FIRE, 'fire', { tiles: { all: TILE.fire }, shape: 'fire', render: 'cutout', solid: false, opaque: false, light: 15, hardness: 0, drop: null, replaceable: true, sound: 'none', hidden: true });

// ---------- madeiras ----------
export const WOODS = [
  { w: 'oak', log: B.LOG, leaves: B.LEAVES, planks: B.PLANKS, stairs: B.STAIRS, slab: B.SLAB, fence: B.FENCE, door: B.OAK_DOOR, sapling: B.OAK_SAPLING, ptile: 'planks', lside: 'log_side', ltop: 'log_top', ltile: 'leaves', ltint: 'foliage' },
  { w: 'spruce', log: B.SPRUCE_LOG, leaves: B.SPRUCE_LEAVES, planks: B.SPRUCE_PLANKS, stairs: B.SPRUCE_STAIRS, slab: B.SPRUCE_SLAB, fence: B.SPRUCE_FENCE, door: B.SPRUCE_DOOR, sapling: B.SPRUCE_SAPLING, ptile: 'spruce_planks', lside: 'spruce_log_side', ltop: 'spruce_log_top', ltile: 'spruce_leaves' },
  { w: 'birch', log: B.BIRCH_LOG, leaves: B.BIRCH_LEAVES, planks: B.BIRCH_PLANKS, stairs: B.BIRCH_STAIRS, slab: B.BIRCH_SLAB, fence: B.BIRCH_FENCE, door: B.BIRCH_DOOR, sapling: B.BIRCH_SAPLING, ptile: 'birch_planks', lside: 'birch_log_side', ltop: 'birch_log_top', ltile: 'birch_leaves' },
  { w: 'jungle', log: B.JUNGLE_LOG, leaves: B.JUNGLE_LEAVES, planks: B.JUNGLE_PLANKS, stairs: B.JUNGLE_STAIRS, slab: B.JUNGLE_SLAB, fence: B.JUNGLE_FENCE, door: B.JUNGLE_DOOR, sapling: B.JUNGLE_SAPLING, ptile: 'jungle_planks', lside: 'jungle_log_side', ltop: 'jungle_log_top', ltile: 'jungle_leaves', ltint: 'foliage' },
  { w: 'skyroot', log: B.SKYROOT_LOG, leaves: B.SKYROOT_LEAVES, planks: B.SKYROOT_PLANKS, sapling: B.SKYROOT_SAPLING, ptile: 'skyroot_planks', lside: 'skyroot_log_side', ltop: 'skyroot_log_top', ltile: 'skyroot_leaves' },
];
for (const W of WOODS) {
  const m = W.w;
  def(W.log, m + '_log', { tpl: 'log', mat: m, tiles: { top: TILE[W.ltop], bottom: TILE[W.ltop], side: TILE[W.lside] }, hardness: 2, tool: 'axe', sound: 'wood', flammable: WOOD_FLAME, log: true });
  def(W.leaves, m + '_leaves', { tpl: 'leaves', mat: m, tiles: { all: TILE[W.ltile] }, render: 'cutout', opaque: false, filter: 1, tint: W.ltint || null, hardness: 0.2, drop: null, sound: 'grass', flammable: LEAF_FLAME, leaves: true, sapling: W.sapling });
  def(W.planks, m + '_planks', { tpl: 'planks', mat: m, tiles: { all: TILE[W.ptile] }, hardness: 2, tool: 'axe', sound: 'wood', flammable: WOOD_FLAME });
  def(W.sapling, m + '_sapling', { tpl: 'sapling', mat: m, tiles: { all: TILE['sapling_' + m] }, shape: 'cross', render: 'cutout', solid: false, opaque: false, hardness: 0, needsSupport: true, sound: 'grass', flammable: PLANT_FLAME });
  if (W.stairs) {
    def(W.stairs, m + '_stairs', { tpl: 'stairs', mat: m, tiles: { all: TILE[W.ptile] }, shape: 'stairs', opaque: false, hardness: 2, tool: 'axe', sound: 'wood', flammable: WOOD_FLAME });
    def(W.slab, m + '_slab', { tpl: 'slab', mat: m, tiles: { all: TILE[W.ptile] }, shape: 'slab', opaque: false, hardness: 2, tool: 'axe', sound: 'wood', flammable: WOOD_FLAME, full: W.planks });
    def(W.fence, m + '_fence', { tpl: 'fence', mat: m, tiles: { all: TILE[W.ptile] }, shape: 'fence', opaque: false, hardness: 2, tool: 'axe', sound: 'wood', flammable: WOOD_FLAME });
    def(W.door, m + '_door', { tpl: 'door', mat: m, tiles: { top: TILE[`door_${m}_top`], bottom: TILE[`door_${m}_bottom`], side: TILE[`door_${m}_bottom`] }, shape: 'door', render: 'cutout', opaque: false, hardness: 3, tool: 'axe', sound: 'wood', interact: 'door', itemTile: TILE[`door_${m}_item`], flammable: WOOD_FLAME });
  }
}
// folhas douradas (Aether) — variante decorativa da raiz-celeste
def(B.GOLDEN_LEAVES, 'golden_oak_leaves', { tiles: { all: TILE.golden_leaves }, render: 'cutout', opaque: false, filter: 1, hardness: 0.2, drop: null, sound: 'grass', flammable: LEAF_FLAME, leaves: true, sapling: B.SKYROOT_SAPLING, light: 6 });

// ---------- pedras: escadas e lajes ----------
const STONES = [
  { m: 'cobblestone', base: B.COBBLE, stairs: B.COBBLE_STAIRS, slab: B.COBBLE_SLAB, tile: TILE.cobblestone, h: 2 },
  { m: 'stone', base: B.STONE, slab: B.STONE_SLAB, tile: TILE.stone, h: 2 },
  { m: 'stone_brick', base: B.STONE_BRICKS, stairs: B.STONE_BRICK_STAIRS, slab: B.STONE_BRICK_SLAB, tile: TILE.stone_bricks, h: 1.5 },
  { m: 'quartz', base: B.QUARTZ_BLOCK, stairs: B.QUARTZ_STAIRS, slab: B.QUARTZ_SLAB, tile: TILE.quartz_block_side, h: 0.8 },
];
for (const S of STONES) {
  if (S.stairs) def(S.stairs, S.m + '_stairs', { tpl: 'stairs', mat: S.m, tiles: { all: S.tile }, shape: 'stairs', opaque: false, hardness: S.h, tool: 'pickaxe', needsTool: true });
  def(S.slab, S.m + '_slab', { tpl: 'slab', mat: S.m, tiles: { all: S.tile }, shape: 'slab', opaque: false, hardness: S.h, tool: 'pickaxe', needsTool: true, full: S.base });
}

// ---------- minérios e blocos de minério ----------
def(B.COAL_ORE, 'coal_ore', { tpl: 'ore', mat: 'coal', tiles: { all: TILE.coal_ore }, hardness: 3, tool: 'pickaxe', needsTool: true, drop: IT.COAL });
def(B.IRON_ORE, 'iron_ore', { tpl: 'ore', mat: 'iron', tiles: { all: TILE.iron_ore }, hardness: 3, tool: 'pickaxe', needsTool: true, minTier: 2 });
def(B.LAPIS_ORE, 'lapis_ore', { tpl: 'ore', mat: 'lapis', tiles: { all: TILE.lapis_ore }, hardness: 3, tool: 'pickaxe', needsTool: true, minTier: 2, drop: IT.LAPIS });
def(B.GOLD_ORE, 'gold_ore', { tpl: 'ore', mat: 'gold', tiles: { all: TILE.gold_ore }, hardness: 3, tool: 'pickaxe', needsTool: true, minTier: 3 });
def(B.DIAMOND_ORE, 'diamond_ore', { tpl: 'ore', mat: 'diamond', tiles: { all: TILE.diamond_ore }, hardness: 3, tool: 'pickaxe', needsTool: true, minTier: 3, drop: IT.DIAMOND });
def(B.EMERALD_ORE, 'emerald_ore', { tpl: 'ore', mat: 'emerald', tiles: { all: TILE.emerald_ore }, hardness: 3, tool: 'pickaxe', needsTool: true, minTier: 3, drop: IT.EMERALD });
def(B.SAPPHIRE_ORE, 'sapphire_ore', { tpl: 'ore', mat: 'sapphire', tiles: { all: TILE.sapphire_ore }, hardness: 3, tool: 'pickaxe', needsTool: true, minTier: 3, drop: IT.SAPPHIRE });
def(B.AMETHYST_ORE, 'amethyst_ore', { tpl: 'ore', mat: 'amethyst', tiles: { all: TILE.amethyst_ore }, hardness: 2, tool: 'pickaxe', needsTool: true, minTier: 2, drop: IT.AMETHYST, light: 4, sound: 'glass' });
def(B.PLATINUM_ORE, 'platinum_ore', { tpl: 'ore', mat: 'platinum', tiles: { all: TILE.platinum_ore }, hardness: 4, tool: 'pickaxe', needsTool: true, minTier: 3 });
def(B.QUARTZ_ORE, 'nether_quartz_ore', { tpl: 'ore', mat: 'quartz', tiles: { all: TILE.nether_quartz }, hardness: 3, tool: 'pickaxe', needsTool: true, drop: IT.QUARTZ });
def(B.ZANITE_ORE, 'zanite_ore', { tpl: 'ore', mat: 'zanite', tiles: { all: TILE.zanite_ore }, hardness: 3, tool: 'pickaxe', needsTool: true, minTier: 2, drop: IT.ZANITE });
def(B.AMBROSIUM_ORE, 'ambrosium_ore', { tpl: 'ore', mat: 'ambrosium', tiles: { all: TILE.ambrosium_ore }, hardness: 3, tool: 'pickaxe', needsTool: true, drop: IT.AMBROSIUM });
const STORAGE = [[B.IRON_BLOCK, 'iron'], [B.GOLD_BLOCK, 'gold'], [B.DIAMOND_BLOCK, 'diamond'], [B.EMERALD_BLOCK, 'emerald'], [B.SAPPHIRE_BLOCK, 'sapphire'], [B.AMETHYST_BLOCK, 'amethyst'], [B.PLATINUM_BLOCK, 'platinum'], [B.LAPIS_BLOCK, 'lapis'], [B.COAL_BLOCK, 'coal']];
for (const [id, m] of STORAGE) def(id, m + '_block', { tpl: 'block', mat: m, tiles: { all: TILE[m + '_block'] }, hardness: 5, tool: 'pickaxe', needsTool: true, minTier: 2, sound: m === 'amethyst' ? 'glass' : 'metal', light: m === 'amethyst' ? 7 : 0 });

// ---------- quartzo ----------
def(B.QUARTZ_BLOCK, 'quartz_block', { tiles: { top: TILE.quartz_block_top, bottom: TILE.quartz_block_top, side: TILE.quartz_block_side }, hardness: 0.8, tool: 'pickaxe', needsTool: true });
def(B.CHISELED_QUARTZ, 'chiseled_quartz_block', { tiles: { top: TILE.quartz_block_top, bottom: TILE.quartz_block_top, side: TILE.chiseled_quartz }, hardness: 0.8, tool: 'pickaxe', needsTool: true });
def(B.QUARTZ_PILLAR, 'quartz_pillar', { tiles: { top: TILE.quartz_pillar_top, bottom: TILE.quartz_pillar_top, side: TILE.quartz_pillar_side }, hardness: 0.8, tool: 'pickaxe', needsTool: true });
def(B.SMOOTH_QUARTZ, 'smooth_quartz', { tiles: { all: TILE.smooth_quartz }, hardness: 2, tool: 'pickaxe', needsTool: true });

// ---------- móveis ----------
def(B.BED, 'bed', { tiles: { top: TILE.bed_top_foot, bottom: TILE.planks, side: TILE.bed_side }, shape: 'bed', opaque: false, hardness: 0.2, sound: 'cloth', interact: 'bed', itemTile: TILE.bed_item, flammable: WOOL_FLAME });

// ---------- Aether ----------
def(B.AETHER_GRASS, 'aether_grass', { tiles: { top: TILE.aether_grass_top, bottom: TILE.aether_dirt, side: TILE.aether_grass_side }, hardness: 0.6, tool: 'shovel', drop: B.AETHER_DIRT, sound: 'grass' });
def(B.AETHER_DIRT, 'aether_dirt', { tiles: { all: TILE.aether_dirt }, hardness: 0.5, tool: 'shovel', sound: 'gravel' });
def(B.HOLYSTONE, 'holystone', { tiles: { all: TILE.holystone }, hardness: 1.5, tool: 'pickaxe', needsTool: true });
def(B.AERCLOUD, 'cold_aercloud', { tiles: { all: TILE.aercloud }, render: 'translucent', solid: false, opaque: false, hardness: 0.2, sound: 'cloth', cloud: 'slow' });
def(B.BLUE_AERCLOUD, 'blue_aercloud', { tiles: { all: TILE.blue_aercloud }, render: 'translucent', solid: false, opaque: false, hardness: 0.2, sound: 'cloth', cloud: 'bounce' });

export const BLOCKS = defs;
export const BLOCK_COUNT = defs.length;

// Tabelas rápidas (typed arrays) para os loops quentes do mesher e da iluminação.
export const IS_OPAQUE = new Uint8Array(256);
export const IS_SOLID = new Uint8Array(256);
export const LIGHT_EMIT = new Uint8Array(256);
export const LIGHT_FILTER = new Uint8Array(256);
export const IS_CUBE_RENDER = new Uint8Array(256);
for (const d of defs) {
  if (!d) continue;
  IS_OPAQUE[d.id] = d.opaque ? 1 : 0;
  IS_SOLID[d.id] = d.solid ? 1 : 0;
  LIGHT_EMIT[d.id] = d.light;
  LIGHT_FILTER[d.id] = d.filter;
  IS_CUBE_RENDER[d.id] = d.shape === 'cube' ? 1 : 0;
}

export function isLiquid(id) { return id === B.WATER || id === B.LAVA; }
export function isReplaceable(id) { return id === B.AIR || (defs[id] && defs[id].replaceable); }
export function isPortal(id) { return id === B.PORTAL || id === B.AETHER_PORTAL; }

// lado → caixa de painel fino (0:+z 1:-x 2:-z 3:+x)
const PANEL = [[0, 0, 13 / 16, 1, 1, 1], [0, 0, 0, 3 / 16, 1, 1], [0, 0, 0, 1, 1, 3 / 16], [13 / 16, 0, 0, 1, 1, 1]];
const STAIR_TOP = [[0, 0.5, 0.5, 1, 1, 1], [0, 0.5, 0, 0.5, 1, 1], [0, 0.5, 0, 1, 1, 0.5], [0.5, 0.5, 0, 1, 1, 1]];

// Caixas visuais/colisão (coordenadas locais 0..1) das formas "parciais" — usadas pelo mesher E pela física.
export function shapeBoxes(id, meta) {
  const d = defs[id];
  switch (d.shape) {
    case 'slab': return (meta & 1) ? [[0, 0.5, 0, 1, 1, 1]] : [[0, 0, 0, 1, 0.5, 1]];
    case 'stairs': {
      const boxes = [[0, 0, 0, 1, 0.5, 1], STAIR_TOP[meta & 3]];
      if (meta & 4) return boxes.map((b) => [b[0], 1 - b[4], b[2], b[3], 1 - b[1], b[5]]); // de cabeça para baixo
      return boxes;
    }
    case 'door': {
      const near = ((meta & 3) + 2) % 4;
      return [PANEL[(meta & 4) ? (near + 1) % 4 : near]];
    }
    case 'bed': return [[0, 0, 0, 1, 9 / 16, 1]];
    default: return null;
  }
}

export function collisionBoxes(id, meta) {
  const d = defs[id];
  if (!d || !d.solid) return null;
  switch (d.shape) {
    case 'slab': case 'stairs': case 'door': case 'bed': return shapeBoxes(id, meta);
    case 'fence': return [[0.375, 0, 0.375, 0.625, 1.5, 0.625]];
    case 'cube':
      if (id === B.CACTUS) return [[0.0625, 0, 0.0625, 0.9375, 1, 0.9375]];
      return [[0, 0, 0, 1, 1, 1]];
    default: return null;
  }
}
