// engine/Textures.js
// Gera o atlas de texturas 100% via código (canvas), sem baixar nenhuma imagem.
// "Atlas" = uma única imagem com todas as texturas lado a lado; cada face usa um recorte (UV) dela.
// Assim todos os blocos compartilham 1 textura e 1 material → menos trocas de estado na GPU.
import * as THREE from 'three';
import { TILE_NAMES, ATLAS_COLS } from '../world/Blocks.js';
import { mulberry32 } from '../world/Noise.js';

const T = 16;

function hex(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

function painter(img, ox, oy, seed) {
  const rand = mulberry32(seed * 7919 + 13);
  const px = (x, y, rgb, a = 255) => {
    if (x < 0 || y < 0 || x >= T || y >= T) return;
    const i = ((oy + y) * T * ATLAS_COLS + (ox + x)) * 4;
    img.data[i] = Math.max(0, Math.min(255, rgb[0])); img.data[i + 1] = Math.max(0, Math.min(255, rgb[1]));
    img.data[i + 2] = Math.max(0, Math.min(255, rgb[2])); img.data[i + 3] = a;
  };
  const vary = (rgb, amt) => { const k = (rand() - 0.5) * 2 * amt; return [rgb[0] + k, rgb[1] + k, rgb[2] + k]; };
  const fill = (color, amt = 18, a = 255) => { const c = hex(color); for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) px(x, y, vary(c, amt), a); };
  const speckle = (color, chance, amt = 10) => { const c = hex(color); for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) if (rand() < chance) px(x, y, vary(c, amt)); };
  const rect = (x0, y0, w, h, color, amt = 8, a = 255) => { const c = hex(color); for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) px(x, y, vary(c, amt), a); };
  const clear = () => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) px(x, y, [0, 0, 0], 0); };
  const pixels = (rows, palette) => { // desenho de item por "pixel art" em string
    clear();
    rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const ch = row[x]; if (palette[ch]) px(x, y, vary(hex(palette[ch]), 6)); } });
  };
  return { px, fill, speckle, rect, clear, pixels, rand, vary };
}

// Pixel art 16x16 para ferramentas (cabeça = material, cabo = graveto)
const PICK = ['', '', '  HHHHHHH', ' H HHHHH H', '      S  ', '     S   ', '    S    ', '   S     ', '  S      ', ' S       '];
const toolArt = {
  pickaxe: ['', ' HHHHHHHHH', 'H   SS   H', '    SS', '    SS', '    SS', '    SS', '    SS', '    SS', '    SS', '    SS', '    SS'].map(r => '   ' + r),
  sword: ['            HH', '           HHH', '          HHH', '         HHH', '        HHH', '       HHH', '      HHH', '  H  HHH', '   HHHH', '   SSH', '  SS  H', ' SS', 'SS'],
  axe: ['', '     HHH', '    HHHHS', '    HHHS', '     HS', '     S', '    S', '   S', '  S', ' S'],
  shovel: ['', '           HH', '          HHHH', '          HHHH', '           HH', '          S', '         S', '        S', '       S', '      S', '     S', '    S'],
};

function paint(name, p) {
  const { fill, speckle, rect, px, clear, pixels, rand, vary } = p;
  switch (name) {
    case 'grass_top': fill('#9a9a9a', 22); speckle('#b5b5b5', 0.2); speckle('#7c7c7c', 0.2); break; // cinza → tingido pelo bioma
    case 'dirt': fill('#866043', 16); speckle('#6e4c33', 0.2); speckle('#9b7653', 0.12); break;
    case 'grass_side': fill('#866043', 16); speckle('#6e4c33', 0.2);
      for (let x = 0; x < T; x++) { const d = 3 + Math.floor(rand() * 3); rect(x, 0, 1, d, '#6aa53f', 14); } break;
    case 'grass_snow_side': fill('#866043', 16); speckle('#6e4c33', 0.2);
      for (let x = 0; x < T; x++) { const d = 3 + Math.floor(rand() * 3); rect(x, 0, 1, d, '#f4f8fb', 6); } break;
    case 'stone': fill('#7d7d7d', 14); speckle('#6a6a6a', 0.25); speckle('#8f8f8f', 0.15); break;
    case 'cobblestone': fill('#6f6f6f', 10);
      for (let k = 0; k < 9; k++) { const x = Math.floor(rand() * 13), y = Math.floor(rand() * 13); rect(x, y, 3 + Math.floor(rand() * 3), 3, rand() < 0.5 ? '#8c8c8c' : '#5a5a5a', 10); }
      speckle('#444', 0.08); break;
    case 'stone_bricks': fill('#7a7a7a', 8);
      for (let y = 0; y < T; y += 8) { rect(0, y + 7, 16, 1, '#4f4f4f', 4); }
      rect(7, 0, 1, 7, '#4f4f4f', 4); rect(3, 8, 1, 7, '#4f4f4f', 4); rect(12, 8, 1, 7, '#4f4f4f', 4); break;
    case 'log_side': case 'jungle_log_side': case 'spruce_log_side': {
      const base = { log_side: '#6b5132', jungle_log_side: '#5a4520', spruce_log_side: '#3d2b19' }[name];
      fill(base, 8); for (let x = 0; x < T; x += 2 + Math.floor(rand() * 2)) rect(x, 0, 1, T, '#2f2214', 8);
      if (name === 'jungle_log_side') speckle('#4c6b22', 0.06); break; }
    case 'log_top': case 'jungle_log_top': case 'spruce_log_top':
      fill('#b08a55', 8);
      for (let r = 1; r < 8; r += 2) for (let a = 0; a < 64; a++) px(Math.round(7.5 + Math.cos(a / 10) * r), Math.round(7.5 + Math.sin(a / 10) * r), vary(hex('#8a6a3c'), 6));
      for (let i = 0; i < T; i++) { px(i, 0, hex('#5a4020')); px(i, 15, hex('#5a4020')); px(0, i, hex('#5a4020')); px(15, i, hex('#5a4020')); } break;
    case 'planks': fill('#a8864f', 10);
      for (let y = 3; y < T; y += 4) rect(0, y, 16, 1, '#6e5530', 4);
      for (let y = 0; y < T; y += 4) { const x = (y * 5 + 3) % 16; rect(x, y, 1, 3, '#7d6038', 4); } break;
    case 'leaves': case 'jungle_leaves':
      clear(); for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) if (rand() < 0.82) px(x, y, vary(hex(rand() < 0.5 ? '#9e9e9e' : '#7a7a7a'), 18)); break;
    case 'spruce_leaves':
      clear(); for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) if (rand() < 0.85) px(x, y, vary(hex('#3a5a3a'), 14)); break;
    case 'glass': clear();
      for (let i = 0; i < T; i++) { px(i, 0, hex('#d8eef5')); px(i, 15, hex('#a8c8d5')); px(0, i, hex('#d8eef5')); px(15, i, hex('#a8c8d5')); }
      px(3, 3, hex('#ffffff')); px(4, 4, hex('#ffffff')); px(5, 5, hex('#eaf6fa')); px(10, 3, hex('#ffffff')); px(11, 2, hex('#ffffff')); break;
    case 'sand': fill('#dbd3a0', 10); speckle('#c9bf86', 0.25); break;
    case 'gravel': fill('#857f7c', 16); speckle('#a39c98', 0.2); speckle('#5e5856', 0.2); break;
    case 'water': fill('#2f5ad1', 12, 175); for (let k = 0; k < 10; k++) rect(Math.floor(rand() * 12), Math.floor(rand() * 16), 4, 1, '#4c78e8', 6, 175); break;
    case 'lava': fill('#d8601c', 20); speckle('#f5a623', 0.3); speckle('#a8320c', 0.15); break;
    case 'snow': fill('#f4f8fb', 5); speckle('#dfe8ef', 0.15); break;
    case 'ice': fill('#8fb8f0', 8, 200); for (let k = 0; k < 6; k++) rect(Math.floor(rand() * 14), Math.floor(rand() * 16), 3, 1, '#c3dcfa', 4, 210); break;
    case 'torch': clear(); rect(7, 9, 2, 7, '#6b4b26', 6); rect(7, 6, 2, 3, '#ffd23f', 10); px(7, 6, hex('#fff3a0')); px(8, 7, hex('#ff9b1c')); break;
    case 'glowstone': fill('#c9953f', 12); speckle('#ffe28a', 0.35); speckle('#8a5a1c', 0.12); break;
    case 'wool_white': fill('#e9ecec', 10); speckle('#d0d4d4', 0.25); break;
    case 'wool_red': fill('#a12722', 10); speckle('#7f1d18', 0.25); break;
    case 'wool_blue': fill('#35399d', 10); speckle('#262a78', 0.25); break;
    case 'wool_green': fill('#546d1b', 10); speckle('#3f5214', 0.25); break;
    case 'wool_yellow': fill('#f8c527', 10); speckle('#d9a813', 0.25); break;
    case 'tallgrass': clear(); for (let k = 0; k < 9; k++) { const x = 1 + Math.floor(rand() * 14), h = 6 + Math.floor(rand() * 9); for (let y = 0; y < h; y++) px(x + (y > h - 3 ? (k & 1) : 0), 15 - y, vary(hex('#a8a8a8'), 20)); } break;
    case 'fern': clear(); for (let y = 2; y < 16; y++) { px(8, y, hex('#9a9a9a')); if (y % 2 === 0) { const w = Math.floor((16 - y) / 3) + 2; for (let k = 1; k <= w; k++) { px(8 - k, y - (k >> 1), vary(hex('#a0a0a0'), 15)); px(8 + k, y - (k >> 1), vary(hex('#a0a0a0'), 15)); } } } break;
    case 'dead_bush': clear(); for (let y = 6; y < 16; y++) px(8, y, hex('#7a5a2e')); for (let k = 0; k < 5; k++) { px(8 - k, 9 - k, hex('#8a6a3a')); px(8 + k, 11 - k, hex('#8a6a3a')); px(8 + (k >> 1), 6 - k, hex('#7a5a2e')); } break;
    case 'flower_red': clear(); rect(7, 8, 1, 8, '#3f8a2a', 6); rect(5, 9, 2, 1, '#3f8a2a', 6); rect(5, 3, 5, 4, '#d0201c', 12); rect(6, 2, 3, 1, '#d0201c', 8); px(7, 4, hex('#2a1a0a')); break;
    case 'flower_yellow': clear(); rect(7, 8, 1, 8, '#3f8a2a', 6); rect(8, 11, 2, 1, '#3f8a2a', 6); rect(5, 4, 5, 4, '#f5e01a', 12); rect(6, 3, 3, 1, '#f5e01a', 8); break;
    case 'netherrack': fill('#6f3533', 18); speckle('#8a4440', 0.25); speckle('#4f2321', 0.2); break;
    case 'soul_sand': fill('#4f3b2e', 14); for (let k = 0; k < 4; k++) { const x = 1 + Math.floor(rand() * 11), y = 1 + Math.floor(rand() * 11); rect(x, y, 3, 1, '#2e2018', 4); rect(x + 1, y + 2, 1, 1, '#2e2018', 4); } break;
    case 'obsidian': fill('#14121d', 6); speckle('#3b2a5c', 0.15); speckle('#000000', 0.15); break;
    case 'portal': fill('#7a2bd8', 25, 190); speckle('#c58cff', 0.2); break;
    case 'bedrock': fill('#555', 30); speckle('#222', 0.3); speckle('#888', 0.15); break;
    case 'coal_ore': case 'iron_ore': case 'lapis_ore': case 'nether_quartz': {
      if (name === 'nether_quartz') { fill('#6f3533', 18); speckle('#8a4440', 0.2); } else { fill('#7d7d7d', 14); speckle('#6a6a6a', 0.25); }
      const c = { coal_ore: '#1c1c1c', iron_ore: '#d8af93', lapis_ore: '#1f43a8', nether_quartz: '#ece6dc' }[name];
      for (let k = 0; k < 6; k++) { const x = 1 + Math.floor(rand() * 12), y = 1 + Math.floor(rand() * 12); rect(x, y, 2, 2, c, 12); if (rand() < 0.5) px(x + 2, y + 1, hex(c)); } break; }
    case 'cactus_side': fill('#3d7a22', 10); for (let x = 1; x < T; x += 4) rect(x, 0, 1, T, '#2b5a16', 6); for (let k = 0; k < 8; k++) px(Math.floor(rand() * 16), Math.floor(rand() * 16), hex('#d8e8a8')); rect(0, 0, 1, 16, '#1f4410', 2); rect(15, 0, 1, 16, '#1f4410', 2); break;
    case 'cactus_top': fill('#4b8a2a', 10); rect(1, 1, 14, 14, '#5da036', 8); rect(6, 6, 4, 4, '#3d7a22', 6); break;
    case 'table_top': paint('planks', p); rect(0, 0, 16, 1, '#5a4020'); rect(0, 15, 16, 1, '#5a4020'); rect(0, 0, 1, 16, '#5a4020'); rect(15, 0, 1, 16, '#5a4020'); rect(3, 3, 10, 10, '#b89458', 6); rect(7, 3, 1, 10, '#5a4020'); rect(3, 7, 10, 1, '#5a4020'); break;
    case 'table_side': paint('planks', p); rect(0, 0, 16, 3, '#6b4b26', 6); rect(3, 6, 3, 5, '#9a9a9a', 6); rect(4, 5, 1, 7, '#5a4020'); rect(10, 6, 4, 2, '#8a8a8a', 6); rect(11, 8, 1, 5, '#5a4020'); break;
    case 'furnace_side': case 'furnace_top': fill('#6e6e6e', 10); speckle('#575757', 0.2); if (name === 'furnace_top') rect(2, 2, 12, 12, '#7a7a7a', 8); break;
    case 'furnace_front': fill('#6e6e6e', 10); speckle('#575757', 0.2); rect(3, 8, 10, 6, '#1c1c1c', 4); rect(4, 12, 8, 1, '#3a3a3a', 4); rect(3, 3, 10, 2, '#555', 4); break;
    case 'chest_side': case 'chest_top': fill('#a0712e', 10); rect(0, 0, 16, 1, '#4f3412'); rect(0, 15, 16, 1, '#4f3412'); rect(0, 0, 1, 16, '#4f3412'); rect(15, 0, 1, 16, '#4f3412'); if (name === 'chest_side') rect(0, 5, 16, 1, '#4f3412'); break;
    case 'chest_front': paint('chest_side', p); rect(7, 4, 2, 4, '#c0c0c0', 4); rect(7, 7, 2, 1, '#555', 2); break;
    case 'fence': paint('planks', p); break;

    // ---------- ITENS ----------
    case 'stick': pixels(['', '', '', '            S', '           S', '          S', '         S', '        S', '       S', '      S', '     S', '    S', '   S'], { S: '#6b4b26' }); break;
    case 'coal': pixels(['', '', '', '      CCC', '    CCCCCC', '   CCCCCCCC', '   CCCDCCCC', '   CCCCCCCC', '    CCCCDC', '     CCCC', '      CC'], { C: '#252525', D: '#4a4a4a' }); break;
    case 'iron_ingot': pixels(['', '', '', '', '', '     IIIIII', '    IJJJJJJI', '   IJJJJJJJI', '  IIIIIIIII', '', ''], { I: '#9a9a9a', J: '#e3e3e3' }); break;
    case 'gold_nugget': pixels(['', '', '', '', '', '', '      GG', '     GGGG', '      GG'], { G: '#f5d33a' }); break;
    case 'flint': pixels(['', '', '', '      F', '     FFF', '    FFFFF', '    FFGFF', '   FFFFFF', '    FFFF', '     FF'], { F: '#3a3a3a', G: '#6a6a6a' }); break;
    case 'flint_and_steel': pixels(['', '', '  III', ' I   I', ' I   I', '  I  I', '      I', '', '        FFF', '       FFFFF', '       FFGFF', '        FFF'], { I: '#bfbfbf', F: '#3a3a3a', G: '#6a6a6a' }); break;
    case 'lapis': pixels(['', '', '', '     LL', '    LLLL', '   LLMLLL', '   LLLLLL', '    LLLL', '     LL'], { L: '#2346b8', M: '#6a8ae8' }); break;
    case 'string': pixels(['', '', '  W', '   W', '    W  W', '     WW W', '        W', '       W', '      W', '     W', '    W'], { W: '#efefef' }); break;
    case 'bone': pixels(['', '', '  BB', '  BBB', '   BBB', '     B', '      B', '       B', '        BBB', '         BBB', '          BB'], { B: '#e8e3d0' }); break;
    case 'feather': pixels(['', '           F', '          FF', '         FFF', '        FFF', '       FFF', '      FFF', '     FFF', '    FF', '   F', '  F'], { F: '#f5f5f5' }); break;
    case 'leather': pixels(['', '', '   LLLLLLLL', '  LLLLLLLLLL', '  LLMLLLLLLL', '   LLLLLLLL', '  LLLLLLMLLL', '  LLLLLLLLLL', '   LLLLLLLL'], { L: '#8a4f2a', M: '#a8673a' }); break;
    case 'arrow': pixels(['', '            AA', '           AAA', '          SAA', '         S', '        S', '       S', '      S', '     S', '  F S', '   FF', '  F F'], { A: '#c0c0c0', S: '#6b4b26', F: '#f0f0f0' }); break;
    case 'apple': pixels(['', '', '       S', '      SL', '    RRRRR', '   RRRRRRR', '   RRWRRRR', '   RRRRRRR', '   RRRRRRR', '    RRRRR', '     R R'], { R: '#d0201c', W: '#ff8080', S: '#5a3a1a', L: '#3f8a2a' }); break;
    case 'bread': pixels(['', '', '', '', '    BBBBBBB', '   BCBCBCBCB', '  BBBBBBBBBB', '  BBBBBBBBBB', '   BBBBBBBB'], { B: '#b8863b', C: '#e0b060' }); break;
    case 'wheat_seeds': pixels(['', '', '', '', '', '    S  S', '      S  S', '   S  S', '     S   S', '   S   S'], { S: '#4a8a2a' }); break;
    case 'rotten_flesh': pixels(['', '', '', '    RRRRR', '   RGRRRRR', '   RRRRGRR', '   RRRRRRR', '    RGRRR', '     RRR'], { R: '#8a3a2a', G: '#5a7a2a' }); break;
    case 'glowstone_dust': pixels(['', '', '', '', '     G G', '    GGGGG', '   G GGG G', '    GGGGG', '     G G'], { G: '#f5d33a' }); break;
    case 'bucket': case 'water_bucket': case 'lava_bucket': {
      const fillc = name === 'water_bucket' ? '#2f5ad1' : name === 'lava_bucket' ? '#e0661c' : null;
      pixels(['', '', '', '  IIIIIIIIII', '  IFFFFFFFFI', '  IIIIIIIIII', '   IIIIIIII', '   IIIIIIII', '    IIIIII', '    IIIIII', '     IIII'], { I: '#a8a8a8', F: fillc || '#555555' }); break; }
    case 'porkchop': case 'cooked_porkchop': case 'beef': case 'steak': case 'mutton': case 'cooked_mutton': case 'chicken': case 'cooked_chicken': {
      const cooked = name.startsWith('cooked') || name === 'steak';
      const main = { porkchop: '#f08a8a', cooked_porkchop: '#c88a4a', beef: '#c8302a', steak: '#7a4a2a', mutton: '#d84a3a', cooked_mutton: '#8a5a3a', chicken: '#f5c8a8', cooked_chicken: '#d8a050' }[name];
      if (name.includes('chicken')) pixels(['', '', '', '     MMMM', '    MMMMMM', '   MMMMMMM', '   MMMMMMM', '    MMMMM', '     MMB', '      BB', '       B'], { M: main, B: '#f0e8d8' });
      else pixels(['', '', '', '    MMMMM', '   MMMMMMM', '  MMMMMMMMF', '  MMMMMMMMF', '  MMMMMMMF', '   MMMMMF', '    FFFF'], { M: main, F: cooked ? '#5a3418' : '#f5e0e0' });
      break; }
    default: {
      if (paintExtra(name, p)) break;
      const m = name.match(/^(wood|stone|iron|gold|diamond|platinum)_(pickaxe|sword|axe|shovel)$/);
      if (m) pixels(toolArt[m[2]], { H: MAT_COLOR[m[1]], S: '#6b4b26' });
      else fill('#ff00ff', 0);
    }
  }
}

const MAT_COLOR = { wood: '#a8864f', stone: '#8a8a8a', iron: '#e0e0e0', gold: '#f5d33a', diamond: '#5ee8e0', platinum: '#cfe3ee', leather: '#8a4f2a',
  emerald: '#2ed46a', sapphire: '#2f5be0', amethyst: '#a45ee8', lapis: '#2346b8', coal: '#262626', zanite: '#7a3ee0', ambrosium: '#f2e36a' };
const PLANK_COLOR = { spruce: '#7a5a36', birch: '#c8b77a', jungle: '#a0734d', skyroot: '#aeb9b4', oak: '#a8864f' };
const ARMOR_ART = {
  helmet: ['', '', '', '   HHHHHHHHHH', '   HDDDDDDDDH', '   HD      DH', '   HD      DH', '   HH      HH'],
  chestplate: ['', '  HHH    HHH', '  HDHHHHHHDH', '  HDDDDDDDDH', '   HDDDDDDH', '   HDDDDDDH', '   HDDDDDDH', '   HDDDDDDH', '   HHHHHHHH'],
  leggings: ['', '   HHHHHHHH', '   HDDDDDDH', '   HDDHHDDH', '   HDH  HDH', '   HDH  HDH', '   HDH  HDH', '   HDH  HDH', '   HHH  HHH'],
  boots: ['', '', '', '', '', '   HHH  HHH', '   HDH  HDH', '   HDH  HDH', ' HHDDH  HDDHH', ' HHHHH  HHHHH'],
};
function shade(c, k) { const [r, g, b] = hex(c); const f = (v) => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, '0'); return '#' + f(r) + f(g) + f(b); }

function paintPlanks(p, base) {
  const { fill, rect } = p;
  fill(base, 10);
  for (let y = 3; y < T; y += 4) rect(0, y, 16, 1, shade(base, 0.66), 4);
  for (let y = 0; y < T; y += 4) { const x = (y * 5 + 3) % 16; rect(x, y, 1, 3, shade(base, 0.75), 4); }
}
function paintOre(p, base, speck) {
  const { fill, speckle, rect, px, rand } = p;
  fill(base, 14); speckle(shade(base, 0.85), 0.25);
  for (let k = 0; k < 6; k++) { const x = 1 + Math.floor(rand() * 12), y = 1 + Math.floor(rand() * 12); rect(x, y, 2, 2, speck, 12); if (rand() < 0.5) px(x + 2, y + 1, hex(shade(speck, 1.2))); }
}
function paintStorage(p, c) {
  const { fill, rect, speckle } = p;
  fill(c, 6); speckle(shade(c, 1.15), 0.12);
  rect(0, 0, 16, 1, shade(c, 1.3), 2); rect(0, 0, 1, 16, shade(c, 1.3), 2);
  rect(0, 15, 16, 1, shade(c, 0.6), 2); rect(15, 0, 1, 16, shade(c, 0.6), 2);
  rect(3, 3, 10, 10, shade(c, 0.92), 4); rect(4, 4, 3, 1, shade(c, 1.35), 2);
}
function paintGem(p, c) {
  p.pixels(['', '', '', '      LLLL', '     LMMMML', '    LMWMMMML', '    LMMMMMDL', '     LMMMDL', '      LMDL', '       LL'], { L: shade(c, 0.55), M: c, W: '#ffffff', D: shade(c, 0.75) });
}
function paintIngot(p, c) {
  p.pixels(['', '', '', '', '', '     IIIIII', '    IJJJJJJI', '   IJJJJJJJI', '  IIIIIIIII'], { I: shade(c, 0.65), J: c });
}
function paintSapling(p, leaf) {
  const { clear, rect, px, rand, vary } = p;
  clear(); rect(7, 9, 2, 7, '#6b4b26', 6);
  for (let k = 0; k < 40; k++) { const a = rand() * Math.PI * 2, r = rand() * 4.5; px(Math.round(7.5 + Math.cos(a) * r), Math.round(6 + Math.sin(a) * r * 0.8), vary(hex(leaf), 18)); }
}
function paintDoor(p, base, half) {
  const { rect, px } = p;
  paintPlanks(p, base);
  const dark = shade(base, 0.55);
  rect(0, 0, 16, 1, dark, 2); rect(0, 15, 16, 1, dark, 2); rect(0, 0, 2, 16, dark, 2); rect(14, 0, 2, 16, dark, 2);
  if (half === 'top') { // janela: pixels transparentes
    for (let y = 3; y < 9; y++) for (let x = 3; x < 13; x++) if (x !== 7 && x !== 8) px(x, y, [0, 0, 0], 0);
  } else { rect(3, 3, 10, 9, shade(base, 0.85), 4); rect(11, 1, 2, 2, '#c0c0c0', 2); }
}

function paintExtra(name, p) {
  const { fill, speckle, rect, px, clear, pixels, rand, vary } = p;
  let m;
  if ((m = name.match(/^(spruce|birch|jungle|skyroot)_planks$/))) { paintPlanks(p, PLANK_COLOR[m[1]]); return true; }
  if ((m = name.match(/^door_(\w+)_(top|bottom|item)$/))) {
    if (m[2] === 'item') pixels(['', '    DDDDDDD', '    DWWDWWD', '    DWWDWWD', '    DDDDDDD', '    DPPPPPD', '    DPPPPKD', '    DPPPPPD', '    DPPPPPD', '    DDDDDDD'], { D: shade(PLANK_COLOR[m[1]], 0.55), P: PLANK_COLOR[m[1]], W: '#cfe8f0', K: '#c0c0c0' });
    else paintDoor(p, PLANK_COLOR[m[1]], m[2]);
    return true;
  }
  if ((m = name.match(/^sapling_(\w+)$/))) { paintSapling(p, { oak: '#4f8f2a', spruce: '#2f5a33', birch: '#7fae46', jungle: '#38a12a', skyroot: '#8fdcb8' }[m[1]]); return true; }
  if ((m = name.match(/^(gold|diamond|emerald|sapphire|amethyst|platinum)_ore$/))) { paintOre(p, '#7d7d7d', MAT_COLOR[m[1]]); return true; }
  if ((m = name.match(/^(zanite|ambrosium)_ore$/))) { paintOre(p, '#c9c9c9', MAT_COLOR[m[1]]); return true; }
  if ((m = name.match(/^(iron|gold|diamond|emerald|sapphire|amethyst|platinum|lapis|coal)_block$/))) { paintStorage(p, MAT_COLOR[m[1]]); return true; }
  if ((m = name.match(/^(leather|iron|gold|diamond|platinum)_(helmet|chestplate|leggings|boots)$/))) {
    const c = MAT_COLOR[m[1]]; pixels(ARMOR_ART[m[2]], { H: shade(c, 0.6), D: c }); return true;
  }
  switch (name) {
    case 'birch_log_side': fill('#ddd8cc', 6); for (let k = 0; k < 9; k++) rect(Math.floor(rand() * 13), Math.floor(rand() * 16), 2 + Math.floor(rand() * 3), 1, '#2a2a2a', 6); return true;
    case 'birch_log_top': fill('#d6c48a', 8); for (let r = 1; r < 8; r += 2) for (let a = 0; a < 64; a++) px(Math.round(7.5 + Math.cos(a / 10) * r), Math.round(7.5 + Math.sin(a / 10) * r), vary(hex('#b8a46a'), 6)); for (let i = 0; i < T; i++) { px(i, 0, hex('#e8e4da')); px(i, 15, hex('#e8e4da')); px(0, i, hex('#e8e4da')); px(15, i, hex('#e8e4da')); } return true;
    case 'birch_leaves': clear(); for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) if (rand() < 0.82) px(x, y, vary(hex('#74a043'), 16)); return true;
    case 'skyroot_log_side': fill('#8d907a', 8); for (let x = 0; x < T; x += 3) rect(x, 0, 1, T, '#6a6c5a', 6); return true;
    case 'skyroot_log_top': fill('#c8c9b4', 8); for (let r = 2; r < 8; r += 2) for (let a = 0; a < 64; a++) px(Math.round(7.5 + Math.cos(a / 10) * r), Math.round(7.5 + Math.sin(a / 10) * r), vary(hex('#a0a28c'), 6)); return true;
    case 'skyroot_leaves': clear(); for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) if (rand() < 0.8) px(x, y, vary(hex('#9fe3c4'), 16)); return true;
    case 'golden_leaves': clear(); for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) if (rand() < 0.8) px(x, y, vary(hex(rand() < 0.3 ? '#fff0a0' : '#f2c94c'), 16)); return true;
    case 'bed_top_foot': fill('#b02a2a', 8); for (let y = 2; y < T; y += 5) rect(0, y, 16, 1, '#8a1f1f', 4); rect(0, 0, 1, 16, '#6e1818'); rect(15, 0, 1, 16, '#6e1818'); return true;
    case 'bed_top_head': fill('#b02a2a', 8); rect(2, 1, 12, 7, '#eeeeee', 6); rect(2, 8, 12, 1, '#c8c8c8', 4); rect(0, 0, 1, 16, '#6e1818'); rect(15, 0, 1, 16, '#6e1818'); return true;
    case 'bed_side': clear(); rect(0, 7, 16, 4, '#b02a2a', 8); rect(0, 7, 16, 1, '#e0e0e0', 4); rect(0, 11, 16, 2, '#a8864f', 6); rect(0, 13, 2, 3, '#7d6038', 4); rect(14, 13, 2, 3, '#7d6038', 4); return true;
    case 'bed_item': pixels(['', '', '', '', '', '  WWWRRRRRRRR', '  WWWRRRRRRRR', '  PPPPPPPPPPP', '  P         P'], { W: '#eeeeee', R: '#b02a2a', P: '#a8864f' }); return true;
    case 'fire': clear(); for (let x = 0; x < T; x++) { const hgt = 6 + Math.floor(rand() * 9); for (let y = 0; y < hgt; y++) { const k = y / hgt; px(x, 15 - y, hex(k < 0.35 ? '#fff2a0' : k < 0.7 ? '#ffb01c' : '#e8542c'), rand() < 0.9 ? 255 : 0); } } return true;
    case 'quartz_block_top': case 'quartz_block_side': case 'smooth_quartz': fill('#ece6dc', 4); speckle('#ddd6ca', 0.1); if (name !== 'smooth_quartz') { rect(0, 0, 16, 1, '#d2cabd'); rect(0, 15, 16, 1, '#d2cabd'); rect(0, 0, 1, 16, '#d2cabd'); rect(15, 0, 1, 16, '#d2cabd'); } return true;
    case 'chiseled_quartz': fill('#ece6dc', 4); rect(2, 2, 12, 12, '#d8d0c3', 2); rect(4, 4, 8, 8, '#ece6dc', 2); rect(6, 6, 4, 4, '#cfc6b8', 2); return true;
    case 'quartz_pillar_side': fill('#ece6dc', 4); rect(3, 0, 1, 16, '#d2cabd'); rect(12, 0, 1, 16, '#d2cabd'); return true;
    case 'quartz_pillar_top': fill('#ece6dc', 4); rect(2, 2, 12, 12, '#d8d0c3', 2); rect(4, 4, 8, 8, '#ece6dc', 2); return true;
    case 'aether_grass_top': fill('#a8e6c2', 14); speckle('#c4f0d6', 0.2); speckle('#8fd0aa', 0.2); return true;
    case 'aether_dirt': fill('#b8b39a', 12); speckle('#9e9980', 0.25); return true;
    case 'aether_grass_side': fill('#b8b39a', 12); speckle('#9e9980', 0.25); for (let x = 0; x < T; x++) rect(x, 0, 1, 3 + Math.floor(rand() * 3), '#a8e6c2', 10); return true;
    case 'holystone': fill('#c9c9c9', 12); speckle('#b0b0b0', 0.25); speckle('#e2e2e2', 0.12); return true;
    case 'aercloud': fill('#ffffff', 6, 205); return true;
    case 'blue_aercloud': fill('#9ed0ff', 10, 205); return true;
    case 'aether_portal': fill('#4aa3ff', 25, 185); speckle('#c8e8ff', 0.2); return true;
    case 'gold_ingot': paintIngot(p, MAT_COLOR.gold); return true;
    case 'platinum_ingot': paintIngot(p, MAT_COLOR.platinum); return true;
    case 'diamond': case 'emerald': case 'sapphire': paintGem(p, MAT_COLOR[name]); return true;
    case 'zanite': paintGem(p, MAT_COLOR.zanite); return true;
    case 'amethyst_shard': pixels(['', '', '        A', '       AMA', '      AMWA', '      AMMA', '     AMMA', '     AMA', '    AMMA', '    AAA'], { A: '#6a3ab0', M: '#a45ee8', W: '#e8d0ff' }); return true;
    case 'quartz': pixels(['', '', '', '      Q', '     QWQ', '    QQWQQ', '    QQQQQ', '     QQQ', '      Q'], { Q: '#e6ddd0', W: '#ffffff' }); return true;
    case 'ambrosium': pixels(['', '', '', '       A', '      AWA', '     AAAAA', '      AAA', '       A'], { A: '#f2d84a', W: '#fffbe0' }); return true;
  }
  return false;
}

let cachedAtlas = null;

export function createAtlas() {
  if (cachedAtlas) return cachedAtlas;
  const rows = Math.ceil(TILE_NAMES.length / ATLAS_COLS);
  const size = T * ATLAS_COLS;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  TILE_NAMES.forEach((name, i) => {
    const ox = (i % ATLAS_COLS) * T, oy = Math.floor(i / ATLAS_COLS) * T;
    paint(name, painter(img, ox, oy, i + 1));
  });
  ctx.putImageData(img, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.NoColorSpace;
  cachedAtlas = { canvas, texture, dataURL: canvas.toDataURL(), rows, size };
  return cachedAtlas;
}
