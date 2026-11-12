// systems/Lighting.js
// Propagação de luz por BFS (busca em largura), igual à ideia do Minecraft:
//  - Luz do céu (0-15): desce em coluna reta a partir do topo e depois "escorre" para os lados perdendo 1 por bloco.
//  - Luz de bloco (0-15): sai de emissores (tocha=14, glowstone/lava=15) e perde 1 por bloco andado.
// A iluminação de um chunk depende dos vizinhos (uma tocha a 5 blocos do outro lado da borda ilumina aqui),
// por isso calculamos numa "região" = chunk + margem de 14 blocos copiados dos 8 chunks vizinhos.
import { IS_OPAQUE, LIGHT_EMIT, LIGHT_FILTER } from '../world/Blocks.js';
import { CHUNK_SIZE, WORLD_HEIGHT } from '../world/Chunk.js';

export const MARGIN = 14;
export const R = CHUNK_SIZE + MARGIN * 2;     // 44
const H = WORLD_HEIGHT;
const RR = R * R;
const N = RR * H;

// Buffers reaproveitados entre rebuilds (evita alocar ~1MB a cada bloco quebrado)
const regionBlocks = new Uint8Array(N);
const regionMeta = new Uint8Array(N);
const sky = new Uint8Array(N);
const blk = new Uint8Array(N);
const queue = new Int32Array(N);

// Copia os blocos do chunk central + bordas dos 8 vizinhos para o buffer da região.
export function buildRegion(getChunk, cx, cz) {
  regionBlocks.fill(0);
  regionMeta.fill(0);
  let maxY = 0;
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const c = getChunk(cx + dx, cz + dz);
    if (!c) continue;
    const lx0 = dx === -1 ? CHUNK_SIZE - MARGIN : 0;
    const lx1 = dx === 1 ? MARGIN : CHUNK_SIZE;
    const lz0 = dz === -1 ? CHUNK_SIZE - MARGIN : 0;
    const lz1 = dz === 1 ? MARGIN : CHUNK_SIZE;
    const rx0 = (dx + 1) * CHUNK_SIZE - (CHUNK_SIZE - MARGIN) + lx0; // posição na região
    const rz0 = (dz + 1) * CHUNK_SIZE - (CHUNK_SIZE - MARGIN) + lz0;
    const len = lx1 - lx0;
    for (let y = 0; y < H; y++) {
      for (let lz = lz0; lz < lz1; lz++) {
        const src = (y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx0;
        const dst = (y * R + (rz0 + lz - lz0)) * R + rx0;
        regionBlocks.set(c.blocks.subarray(src, src + len), dst);
        regionMeta.set(c.meta.subarray(src, src + len), dst);
      }
    }
  }
  for (let y = H - 1; y >= 0 && !maxY; y--) {
    const base = y * RR;
    for (let i = 0; i < RR; i++) if (regionBlocks[base + i] !== 0) { maxY = y; break; }
  }
  return { blocks: regionBlocks, meta: regionMeta, maxY };
}

function propagate(light, head, tail) {
  const blocks = regionBlocks;
  while (head !== tail) {
    const i = queue[head]; head = (head + 1) % N;
    const v = light[i];
    if (v <= 1) continue;
    const x = i % R, z = ((i / R) | 0) % R, y = (i / RR) | 0;
    // 6 vizinhos
    for (let k = 0; k < 6; k++) {
      let j;
      if (k === 0) { if (x + 1 >= R) continue; j = i + 1; }
      else if (k === 1) { if (x === 0) continue; j = i - 1; }
      else if (k === 2) { if (z + 1 >= R) continue; j = i + R; }
      else if (k === 3) { if (z === 0) continue; j = i - R; }
      else if (k === 4) { if (y + 1 >= H) continue; j = i + RR; }
      else { if (y === 0) continue; j = i - RR; }
      const id = blocks[j];
      if (IS_OPAQUE[id]) continue;
      const nv = v - 1 - LIGHT_FILTER[id];
      if (nv > light[j]) { light[j] = nv; queue[tail] = j; tail = (tail + 1) % N; }
    }
  }
}

// Calcula luz do céu e de blocos na região inteira. Retorna arrays separados (0-15 cada).
export function computeLight(region, hasSky = true) {
  const blocks = region.blocks;
  const top = Math.min(H - 1, region.maxY + 1);
  sky.fill(0); blk.fill(0);
  let head = 0, tail = 0;

  if (hasSky) {
    // 1) colunas: luz 15 desce reta até bater em algo opaco (água/folhas filtram)
    for (let z = 0; z < R; z++) for (let x = 0; x < R; x++) {
      let v = 15;
      for (let y = H - 1; y >= 0; y--) {
        const i = (y * R + z) * R + x;
        const id = blocks[i];
        if (IS_OPAQUE[id]) { v = 0; }
        else { v = Math.max(0, v - LIGHT_FILTER[id]); }
        if (v === 0) break;
        sky[i] = v;
      }
    }
    // 2) sementes da BFS: células iluminadas que têm vizinho horizontal mais escuro
    for (let y = 0; y <= top; y++) for (let z = 0; z < R; z++) for (let x = 0; x < R; x++) {
      const i = (y * R + z) * R + x;
      const v = sky[i];
      if (v < 2) continue;
      if ((x + 1 < R && sky[i + 1] < v - 1 && !IS_OPAQUE[blocks[i + 1]]) ||
          (x > 0 && sky[i - 1] < v - 1 && !IS_OPAQUE[blocks[i - 1]]) ||
          (z + 1 < R && sky[i + R] < v - 1 && !IS_OPAQUE[blocks[i + R]]) ||
          (z > 0 && sky[i - R] < v - 1 && !IS_OPAQUE[blocks[i - R]]) ||
          (y > 0 && sky[i - RR] < v - 1 && !IS_OPAQUE[blocks[i - RR]])) {
        queue[tail++] = i;
      }
    }
    propagate(sky, head, tail);
  }

  // 3) luz de blocos (tochas, glowstone, lava, portal)
  head = 0; tail = 0;
  for (let i = 0, n = (top + 1) * RR; i < n; i++) {
    const e = LIGHT_EMIT[blocks[i]];
    if (e) { blk[i] = e; queue[tail++] = i; }
  }
  propagate(blk, head, tail);
  return { sky, blk };
}

// Copia a luz do miolo da região de volta para o chunk (usado pra iluminar mobs e itens).
export function storeChunkLight(chunk, light) {
  for (let y = 0; y < H; y++) for (let z = 0; z < CHUNK_SIZE; z++) {
    const ri = (y * R + z + MARGIN) * R + MARGIN;
    const ci = (y * CHUNK_SIZE + z) * CHUNK_SIZE;
    for (let x = 0; x < CHUNK_SIZE; x++) chunk.light[ci + x] = (light.sky[ri + x] << 4) | light.blk[ri + x];
  }
}
