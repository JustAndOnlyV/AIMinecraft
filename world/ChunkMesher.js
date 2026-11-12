// world/ChunkMesher.js
// Transforma os blocos de um chunk em UMA geometria (por grupo de material).
// Em vez de 1 mesh por bloco (milhares de draw calls = jogo travando), geramos só as faces visíveis
// de todos os blocos num único buffer → 2 draw calls por chunk. Isso é o "mesh merging".
// O módulo é puro (não importa Three.js): devolve typed arrays, fácil de testar e de mover para um Web Worker.
import { BLOCKS, IS_OPAQUE, ATLAS_COLS, TILE, shapeBoxes } from './Blocks.js';
import { CHUNK_SIZE, WORLD_HEIGHT } from './Chunk.js';
import { buildRegion, computeLight, storeChunkLight, MARGIN, R } from '../systems/Lighting.js';
import { BIOMES } from './Biomes.js';

const H = WORLD_HEIGHT, RR = R * R, S = CHUNK_SIZE;
const UV_EPS = 0.0004;
const AO_CURVE = [0.45, 0.65, 0.82, 1.0];
const TINT_K = 1.32;

class GeoBuffer {
  constructor() { this.cap = 4096; this.alloc(); this.v = 0; this.i = 0; }
  alloc() {
    this.pos = new Float32Array(this.cap * 3); this.uv = new Float32Array(this.cap * 2);
    this.tint = new Float32Array(this.cap * 3); this.light = new Float32Array(this.cap * 2);
    this.idx = new Uint32Array(this.cap * 1.5);
  }
  reset() { this.v = 0; this.i = 0; }
  grow() {
    const o = { pos: this.pos, uv: this.uv, tint: this.tint, light: this.light, idx: this.idx };
    this.cap *= 2; this.alloc();
    this.pos.set(o.pos); this.uv.set(o.uv); this.tint.set(o.tint); this.light.set(o.light); this.idx.set(o.idx);
  }
  vert(x, y, z, u, v, r, g, b, ls, lb) {
    if (this.v >= this.cap - 4) this.grow();
    const k = this.v;
    this.pos[k * 3] = x; this.pos[k * 3 + 1] = y; this.pos[k * 3 + 2] = z;
    this.uv[k * 2] = u; this.uv[k * 2 + 1] = v;
    this.tint[k * 3] = r; this.tint[k * 3 + 1] = g; this.tint[k * 3 + 2] = b;
    this.light[k * 2] = ls; this.light[k * 2 + 1] = lb;
    this.v++;
  }
  quad(flip) {
    const b = this.v - 4;
    if (this.i + 6 > this.idx.length) this.grow();
    const I = this.idx;
    if (flip) { I[this.i++] = b + 1; I[this.i++] = b + 2; I[this.i++] = b + 3; I[this.i++] = b + 1; I[this.i++] = b + 3; I[this.i++] = b; }
    else { I[this.i++] = b; I[this.i++] = b + 1; I[this.i++] = b + 2; I[this.i++] = b; I[this.i++] = b + 2; I[this.i++] = b + 3; }
  }
  export() {
    return {
      positions: this.pos.slice(0, this.v * 3), uvs: this.uv.slice(0, this.v * 2),
      tints: this.tint.slice(0, this.v * 3), lights: this.light.slice(0, this.v * 2),
      indices: this.idx.slice(0, this.i), count: this.i,
    };
  }
}

// Faces do cubo: normal, 4 cantos, eixos tangentes (AO), sombreamento fixo por direção
const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], ax: [2, 1], shade: 0.8, key: 'side' },
  { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], ax: [2, 1], shade: 0.8, key: 'side' },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], ax: [0, 2], shade: 1.0, key: 'top' },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], ax: [0, 2], shade: 0.55, key: 'bottom' },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], ax: [0, 1], shade: 0.65, key: 'side' },
  { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], ax: [0, 1], shade: 0.65, key: 'side' },
];
const QUAD_UV = [[0, 0], [1, 0], [1, 1], [0, 1]];
const FACE_FACING = [3, 1, -1, -1, 0, 2]; // face → meta "frontal" (0:+z 1:-x 2:-z 3:+x)

function tileUV(tile) {
  const col = tile % ATLAS_COLS, row = Math.floor(tile / ATLAS_COLS);
  return [col / ATLAS_COLS + UV_EPS, 1 - (row + 1) / ATLAS_COLS + UV_EPS, (col + 1) / ATLAS_COLS - UV_EPS, 1 - row / ATLAS_COLS - UV_EPS];
}
const TILE_UV_CACHE = [];
function tuv(tile) { return TILE_UV_CACHE[tile] || (TILE_UV_CACHE[tile] = tileUV(tile)); }

const opaqueBuf = new GeoBuffer();
const transBuf = new GeoBuffer();

export function buildChunkMesh(getChunk, chunk, hasSky = true, opts = {}) {
  const smooth = opts.smoothLighting !== false;
  const region = buildRegion(getChunk, chunk.cx, chunk.cz);
  const light = computeLight(region, hasSky);
  storeChunkLight(chunk, light);
  const blocks = region.blocks, meta = region.meta, sky = light.sky, blk = light.blk;
  opaqueBuf.reset(); transBuf.reset();
  const maxY = Math.min(H - 1, region.maxY);

  const rIdx = (x, y, z) => (y * R + z) * R + x;
  const getB = (x, y, z) => (y < 0 || y >= H) ? 0 : blocks[(y * R + z) * R + x];
  const opq = (x, y, z) => (y < 0 || y >= H) ? 0 : IS_OPAQUE[blocks[(y * R + z) * R + x]];
  const neighborOpaque = (x, y, z, f) => {
    const F = FACES[f], ny = y + F.n[1];
    if (ny < 0) return true;
    if (ny >= H) return false;
    return IS_OPAQUE[blocks[rIdx(x + F.n[0], ny, z + F.n[2])]] === 1;
  };

  for (let y = 0; y <= maxY; y++) for (let lz = 0; lz < S; lz++) for (let lx = 0; lx < S; lx++) {
    const x = lx + MARGIN, z = lz + MARGIN;
    const i = rIdx(x, y, z);
    const id = blocks[i];
    if (id === 0) continue;
    const d = BLOCKS[id];
    if (!d) continue;
    const biome = BIOMES[chunk.biomes[lz * S + lx]] || BIOMES[0];
    const buf = d.render === 'translucent' ? transBuf : opaqueBuf;
    const m = meta[i];

    if (d.shape === 'cube') {
      for (let f = 0; f < 6; f++) {
        const F = FACES[f];
        const nx = x + F.n[0], ny = y + F.n[1], nz = z + F.n[2];
        if (ny >= 0 && ny < H) {
          const nid = blocks[rIdx(nx, ny, nz)];
          if (IS_OPAQUE[nid]) continue;
          if (nid === id && d.render !== 'opaque') continue;
        } else if (ny < 0) continue;
        let tile = d[F.key];
        if (d.interact && d.front !== d.side && FACE_FACING[f] === (m & 3)) tile = d.front;
        let tr = F.shade, tg = F.shade, tb = F.shade;
        if ((d.tint === 'grass' && f === 2) || d.tint === 'foliage') {
          const c = d.tint === 'grass' ? biome.grass : biome.foliage;
          tr *= c[0] * TINT_K; tg *= c[1] * TINT_K; tb *= c[2] * TINT_K;
        }
        const uv = tuv(tile);
        const ao = [3, 3, 3, 3];
        const ax0 = F.ax[0], ax1 = F.ax[1];
        const cy0 = Math.min(H - 1, Math.max(0, ny));
        const ni = rIdx(nx, cy0, nz);
        for (let k = 0; k < 4; k++) {
          const c = F.c[k];
          let ls = sky[ni], lb = blk[ni];
          if (smooth) {
            const du = [0, 0, 0], dv = [0, 0, 0];
            du[ax0] = c[ax0] ? 1 : -1; dv[ax1] = c[ax1] ? 1 : -1;
            const s1x = nx + du[0], s1y = ny + du[1], s1z = nz + du[2];
            const s2x = nx + dv[0], s2y = ny + dv[1], s2z = nz + dv[2];
            const cx = nx + du[0] + dv[0], cy = ny + du[1] + dv[1], cz = nz + du[2] + dv[2];
            const s1 = opq(s1x, s1y, s1z), s2 = opq(s2x, s2y, s2z), cc = opq(cx, cy, cz);
            ao[k] = (s1 && s2) ? 0 : 3 - (s1 + s2 + cc);
            // luz suave: média das células abertas ao redor do vértice
            let n = 1;
            if (!s1 && s1y >= 0 && s1y < H) { const j = rIdx(s1x, s1y, s1z); ls += sky[j]; lb += blk[j]; n++; }
            if (!s2 && s2y >= 0 && s2y < H) { const j = rIdx(s2x, s2y, s2z); ls += sky[j]; lb += blk[j]; n++; }
            if (!cc && !(s1 && s2) && cy >= 0 && cy < H) { const j = rIdx(cx, cy, cz); ls += sky[j]; lb += blk[j]; n++; }
            ls /= n; lb /= n;
          }
          const a = AO_CURVE[ao[k]];
          buf.vert(lx + c[0], y + c[1], lz + c[2],
            QUAD_UV[k][0] ? uv[2] : uv[0], QUAD_UV[k][1] ? uv[3] : uv[1],
            tr * a, tg * a, tb * a, ls / 15, lb / 15);
        }
        buf.quad(ao[0] + ao[2] < ao[1] + ao[3]);
      }
      continue;
    }

    // Formas especiais: luz da própria célula (e a de cima, para lajes/escadas que ficam "dentro" da luz)
    const ls = sky[i] / 15, lb = blk[i] / 15;
    const lsUp = y + 1 < H ? sky[i + RR] / 15 : 1, lbUp = y + 1 < H ? blk[i + RR] / 15 : 0;
    const L = [Math.max(ls, lsUp * 0.9), Math.max(lb, lbUp * 0.9)];
    let tint = [1, 1, 1];
    if (d.tint === 'grass') tint = [biome.grass[0] * TINT_K, biome.grass[1] * TINT_K, biome.grass[2] * TINT_K];
    // face só é escondida se encosta na borda do bloco E o vizinho é opaco
    const cullBox = (box) => (f) => {
      const touches = [box[3] >= 1, box[0] <= 0, box[4] >= 1, box[1] <= 0, box[5] >= 1, box[2] <= 0][f];
      return touches && neighborOpaque(x, y, z, f);
    };

    switch (d.shape) {
      case 'cross': addCross(buf, lx, y, lz, d.side, tint, L); break;
      case 'fire': addFire(buf, lx, y, lz, d.side, opq(x, y - 1, z)); break;
      case 'torch': addBox(buf, lx, y, lz, [7 / 16, 0, 7 / 16, 9 / 16, 10 / 16, 9 / 16], d, null, L, tint, null); break;
      case 'slab': case 'stairs':
        for (const box of shapeBoxes(id, m)) addBox(buf, lx, y, lz, box, d, null, L, tint, cullBox(box));
        break;
      case 'door': {
        const tile = (m & 8) ? d.top : d.bottom;
        for (const box of shapeBoxes(id, m)) addBox(buf, lx, y, lz, box, d, tile, L, tint, cullBox(box), false, true);
        break;
      }
      case 'bed': {
        const box = shapeBoxes(id, m)[0];
        addBox(buf, lx, y, lz, box, d, null, L, tint, cullBox(box), false, false, (f) => (f === 2 ? ((m & 8) ? TILE.bed_top_head : d.top) : null));
        break;
      }
      case 'fence': {
        addBox(buf, lx, y, lz, [6 / 16, 0, 6 / 16, 10 / 16, 1, 10 / 16], d, null, L, tint, null);
        const conn = (id2) => (BLOCKS[id2] && BLOCKS[id2].shape === 'fence') || IS_OPAQUE[id2];
        const dirs = [[1, 0, [10 / 16, 1]], [-1, 0, [0, 6 / 16]], [0, 1, [10 / 16, 1]], [0, -1, [0, 6 / 16]]];
        for (const [dx, dz, span] of dirs) {
          if (!conn(getB(x + dx, y, z + dz))) continue;
          for (const [y0, y1] of [[6 / 16, 9 / 16], [12 / 16, 15 / 16]]) {
            const box = dx !== 0 ? [span[0], y0, 7 / 16, span[1], y1, 9 / 16] : [7 / 16, y0, span[0], 9 / 16, y1, span[1]];
            addBox(buf, lx, y, lz, box, d, null, L, tint, null);
          }
        }
        break;
      }
      case 'portal': {
        const box = (m & 1) ? [6 / 16, 0, 0, 10 / 16, 1, 1] : [0, 0, 6 / 16, 1, 1, 10 / 16];
        const same = (f) => { const F = FACES[f]; return getB(x + F.n[0], y + F.n[1], z + F.n[2]) === id; };
        addBox(buf, lx, y, lz, box, d, null, [1, 1], tint, (f) => ((m & 1) ? (f !== 0 && f !== 1) : (f !== 4 && f !== 5)) && same(f));
        break;
      }
      case 'liquid': {
        const above = getB(x, y + 1, z);
        const same = (b2) => b2 === id;
        const level = m & 7;
        const h = same(above) ? 1 : (level === 0 ? 14 / 16 : Math.max(2 / 16, (8 - level) / 9));
        const cull = (f) => {
          const F = FACES[f];
          const nb = getB(x + F.n[0], y + F.n[1], z + F.n[2]);
          if (same(nb)) return true;
          return IS_OPAQUE[nb] === 1;
        };
        addBox(buf, lx, y, lz, [0, 0, 0, 1, h, 1], d, null, [Math.max(ls, lsUp), Math.max(lb, lbUp)], tint, cull, true);
        break;
      }
    }
  }

  return { opaque: opaqueBuf.export(), translucent: transBuf.export() };
}

// Caixa arbitrária. UV recortado proporcional ao tamanho da caixa (laje mostra meia textura etc.).
function addBox(buf, bx, by, bz, box, d, tileOverride, L, tint, cull, fullUV = false, fullSide = false, faceTile = null) {
  const [x0, y0, z0, x1, y1, z1] = box;
  for (let f = 0; f < 6; f++) {
    if (cull && cull(f)) continue;
    const F = FACES[f];
    const tile = (faceTile && faceTile(f)) ?? tileOverride ?? d[F.key];
    const uv = tuv(tile);
    const uw = uv[2] - uv[0], vh = uv[3] - uv[1];
    for (let k = 0; k < 4; k++) {
      const c = F.c[k];
      const px = c[0] ? x1 : x0, py = c[1] ? y1 : y0, pz = c[2] ? z1 : z0;
      let tu, tv;
      if (f <= 1) { tu = f === 0 ? 1 - pz : pz; tv = py; }
      else if (f <= 3) { tu = px; tv = f === 2 ? 1 - pz : pz; }
      else { tu = f === 4 ? px : 1 - px; tv = py; }
      if (fullUV) { tu = QUAD_UV[k][0]; tv = f <= 1 || f >= 4 ? py : QUAD_UV[k][1]; }
      if (fullSide && (f <= 1 || f >= 4)) { // porta: textura inteira nas faces largas
        const wide = (f <= 1) ? (z1 - z0) > 0.5 : (x1 - x0) > 0.5;
        if (wide) tu = QUAD_UV[k][0];
      }
      if (d.shape === 'torch' && f === 2) { tu = 7 / 16 + (px - 7 / 16); tv = 1 - (6 / 16 + (pz - 7 / 16)); }
      buf.vert(bx + px, by + py, bz + pz, uv[0] + tu * uw, uv[1] + tv * vh,
        tint[0] * F.shade, tint[1] * F.shade, tint[2] * F.shade, L[0], L[1]);
    }
    buf.quad(false);
  }
}

// Plantas: dois planos em X, desenhados dos dois lados.
function addCross(buf, bx, by, bz, tile, tint, L, inset = 0.15, full = false) {
  const uv = tuv(tile);
  const a = inset, b = 1 - inset;
  const quads = [
    [[a, 0, a], [b, 0, b], [b, 1, b], [a, 1, a]],
    [[b, 0, a], [a, 0, b], [a, 1, b], [b, 1, a]],
  ];
  const sh = full ? 1 : 0.9;
  for (const q of quads) {
    for (const order of [[0, 1, 2, 3], [1, 0, 3, 2]]) {
      for (let k = 0; k < 4; k++) {
        const p = q[order[k]];
        const u = (order[k] === 1 || order[k] === 2) ? uv[2] : uv[0];
        const v = (order[k] >= 2) ? uv[3] : uv[1];
        buf.vert(bx + p[0], by + p[1], bz + p[2], u, v, tint[0] * sh, tint[1] * sh, tint[2] * sh, L[0], L[1]);
      }
      buf.quad(false);
    }
  }
}

// Fogo: cruz + 4 placas inclinadas nas laterais; sempre em brilho máximo
function addFire(buf, bx, by, bz, tile, onSolid) {
  addCross(buf, bx, by, bz, tile, [1, 1, 1], [1, 1], 0.05, true);
  if (!onSolid) return;
  const uv = tuv(tile);
  const sides = [
    [[0, 0, 0.05], [1, 0, 0.05], [1, 1.1, 0.3], [0, 1.1, 0.3]],
    [[1, 0, 0.95], [0, 0, 0.95], [0, 1.1, 0.7], [1, 1.1, 0.7]],
    [[0.05, 0, 1], [0.05, 0, 0], [0.3, 1.1, 0], [0.3, 1.1, 1]],
    [[0.95, 0, 0], [0.95, 0, 1], [0.7, 1.1, 1], [0.7, 1.1, 0]],
  ];
  for (const q of sides) for (const order of [[0, 1, 2, 3], [1, 0, 3, 2]]) {
    for (let k = 0; k < 4; k++) {
      const p = q[order[k]];
      buf.vert(bx + p[0], by + p[1], bz + p[2], (order[k] === 1 || order[k] === 2) ? uv[2] : uv[0], order[k] >= 2 ? uv[3] : uv[1], 1, 1, 1, 1, 1);
    }
    buf.quad(false);
  }
}
