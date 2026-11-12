// world/WorldGenerator.js
// Geração procedural determinística: mesma seed + mesma coordenada = mesmo terreno, sempre.
// Isso é o que permite o mundo ser "infinito": não guardamos o mundo, só recalculamos quando o jogador chega perto.
import { SimplexNoise, mulberry32, hash2, hash3 } from './Noise.js';
import { B, BLOCKS } from './Blocks.js';
import * as Trees from './Trees.js';
import { CHUNK_SIZE, WORLD_HEIGHT, SEA_LEVEL, Chunk } from './Chunk.js';
import { BIOME, BIOMES, pickBiome } from './Biomes.js';

const S = CHUNK_SIZE, H = WORLD_HEIGHT;
const MARGIN = 3; // colunas extras ao redor do chunk para árvores que "vazam" de chunks vizinhos
const GRID = 4;   // amostragem grossa do ruído 3D (interpolado depois) → bem mais rápido

function smoothstep(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

export class OverworldGenerator {
  constructor(seed) {
    this.seed = seed | 0;
    this.nCont = new SimplexNoise(seed);
    this.nDetail = new SimplexNoise(seed + 1);
    this.nMount = new SimplexNoise(seed + 2);
    this.nTemp = new SimplexNoise(seed + 3);
    this.nHumid = new SimplexNoise(seed + 4);
    this.nWeird = new SimplexNoise(seed + 5);
    this.nCave1 = new SimplexNoise(seed + 6);
    this.nCave2 = new SimplexNoise(seed + 7);
    this.nRidge = new SimplexNoise(seed + 8);
  }

  // Altura + bioma de uma coluna. É o coração do relevo.
  column(x, z) {
    const cont = this.nCont.fbm2(x / 700, z / 700, 4);
    const detail = this.nDetail.fbm2(x / 90, z / 90, 4);
    const mount = this.nMount.fbm2(x / 400, z / 400, 3);
    const ridge = 1 - Math.abs(this.nRidge.fbm2(x / 160, z / 160, 3));
    const temp = this.nTemp.fbm2(x / 900, z / 900, 3) * 1.4;
    const humid = this.nHumid.fbm2(x / 750, z / 750, 3) * 1.4;
    const weird = this.nWeird.noise2D(x / 220, z / 220);

    const c = Math.max(-1, Math.min(1, cont * 1.8 + 0.25));
    let h;
    if (c < 0) h = SEA_LEVEL + c * 26 + detail * 4;                     // oceano: afunda com c
    else h = SEA_LEVEL + 1 + c * 14 + detail * (4 + c * 8);              // terra: sobe e ganha morros
    const m = smoothstep(0.25, 0.75, mount) * smoothstep(-0.05, 0.25, c);
    h += m * Math.pow(ridge, 2.2) * 62;                                  // cordilheiras
    h = Math.floor(Math.max(6, Math.min(H - 12, h)));
    const biome = pickBiome(temp, humid, c, mount, h, SEA_LEVEL, weird);
    return { h, biome };
  }

  generate(chunk) {
    const ox = chunk.cx * S, oz = chunk.cz * S;
    const W = S + MARGIN * 2;
    const heights = new Int16Array(W * W);
    const biomes = new Uint8Array(W * W);
    for (let lz = 0; lz < W; lz++) for (let lx = 0; lx < W; lx++) {
      const c = this.column(ox + lx - MARGIN, oz + lz - MARGIN);
      heights[lz * W + lx] = c.h; biomes[lz * W + lx] = c.biome;
    }
    const caves = this.caveField(ox, oz, heights, W);

    for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) {
      const mi = (z + MARGIN) * W + (x + MARGIN);
      const h = heights[mi];
      const bi = biomes[mi];
      const bd = BIOMES[bi];
      chunk.biomes[z * S + x] = bi;
      // inclinação: em encostas íngremes de montanha a pedra fica exposta
      const slope = Math.max(
        Math.abs(heights[mi + 1] - heights[mi - 1]),
        Math.abs(heights[mi + W] - heights[mi - W]));
      let top = bd.top, filler = bd.filler;
      if (bi === BIOME.MOUNTAINS) {
        if (h > 98) { top = B.SNOW; filler = B.STONE; }
        else if (slope > 4 || h > 88) { top = B.STONE; filler = B.STONE; }
      }
      if (h < SEA_LEVEL && (top === B.GRASS || top === B.SNOW_GRASS)) {
        top = hash2(this.seed, ox + x, oz + z) < 0.5 ? B.SAND : B.DIRT; filler = B.DIRT;
      }
      const depth = bd.fillerDepth;
      for (let y = 0; y <= h; y++) {
        let id;
        if (y === 0) id = B.BEDROCK;
        else if (y < 4 && hash3(this.seed, ox + x, y, oz + z) < 0.5) id = B.BEDROCK;
        else if (y === h) id = top;
        else if (y > h - depth) id = filler;
        else id = B.STONE;
        // cavernas: não abrem embaixo d'água para não inundar tudo
        if (y > 4 && id !== B.BEDROCK && this.isCave(caves, x, y, z) && !(h <= SEA_LEVEL + 1 && y >= h - 5)) {
          id = y < 11 ? B.LAVA : B.AIR;
        }
        if (id) chunk.blocks[(y * S + z) * S + x] = id;
      }
      // água do mar
      for (let y = h + 1; y <= SEA_LEVEL; y++) {
        const id = (y === SEA_LEVEL && bd.frozenWater) ? B.ICE : B.WATER;
        chunk.blocks[(y * S + z) * S + x] = id;
      }
    }

    this.placeOres(chunk);
    this.decorate(chunk, heights, biomes, W);
  }

  // Ruído 3D amostrado numa grade 4x4x4 e interpolado (trilinear) → cavernas tipo "espaguete".
  caveField(ox, oz, heights, W) {
    const NY = (H >> 2) + 1;
    const field = new Float32Array(5 * 5 * NY);
    for (let gy = 0; gy < NY; gy++) for (let gz = 0; gz < 5; gz++) for (let gx = 0; gx < 5; gx++) {
      const x = ox + gx * GRID, y = gy * GRID, z = oz + gz * GRID;
      const a = this.nCave1.noise3D(x / 48, y / 28, z / 48);
      const b = this.nCave2.noise3D(x / 48, y / 28, z / 48);
      field[(gy * 5 + gz) * 5 + gx] = a * a + b * b;
    }
    this._caveField = field;
    return field;
  }

  isCave(field, x, y, z) {
    const gx = x >> 2, gy = y >> 2, gz = z >> 2;
    const fx = (x & 3) / 4, fy = (y & 3) / 4, fz = (z & 3) / 4;
    const at = (ix, iy, iz) => field[(iy * 5 + iz) * 5 + ix];
    const c00 = at(gx, gy, gz) * (1 - fx) + at(gx + 1, gy, gz) * fx;
    const c10 = at(gx, gy + 1, gz) * (1 - fx) + at(gx + 1, gy + 1, gz) * fx;
    const c01 = at(gx, gy, gz + 1) * (1 - fx) + at(gx + 1, gy, gz + 1) * fx;
    const c11 = at(gx, gy + 1, gz + 1) * (1 - fx) + at(gx + 1, gy + 1, gz + 1) * fx;
    const c0 = c00 * (1 - fy) + c10 * fy, c1 = c01 * (1 - fy) + c11 * fy;
    return (c0 * (1 - fz) + c1 * fz) < 0.012;
  }

  placeOres(chunk) {
    const rand = mulberry32((this.seed ^ Math.imul(chunk.cx, 73856093) ^ Math.imul(chunk.cz, 19349663)) | 0);
    const vein = (ore, count, size, maxY) => {
      for (let v = 0; v < count; v++) {
        let x = Math.floor(rand() * S), y = 2 + Math.floor(rand() * (maxY - 2)), z = Math.floor(rand() * S);
        for (let i = 0; i < size; i++) {
          if (x >= 0 && x < S && z >= 0 && z < S && y > 0 && y < H) {
            const idx = (y * S + z) * S + x;
            if (chunk.blocks[idx] === B.STONE) chunk.blocks[idx] = ore;
          }
          const d = Math.floor(rand() * 6);
          if (d === 0) x++; else if (d === 1) x--; else if (d === 2) y++; else if (d === 3) y--; else if (d === 4) z++; else z--;
        }
      }
    };
    vein(B.COAL_ORE, 18, 9, 96);
    vein(B.IRON_ORE, 10, 6, 60);
    vein(B.LAPIS_ORE, 2, 5, 30);
    vein(B.GOLD_ORE, 3, 6, 32);
    vein(B.DIAMOND_ORE, 1, 6, 16);
    vein(B.SAPPHIRE_ORE, 1, 4, 22);
    vein(B.PLATINUM_ORE, 1, 4, 18);
    vein(B.AMETHYST_ORE, 2, 6, 40);
    if (chunk.biomes[8 * S + 8] === BIOME.MOUNTAINS) vein(B.EMERALD_ORE, 3, 2, 60);
    vein(B.GRAVEL, 4, 14, 70);
  }

  decorate(chunk, heights, biomes, W) {
    const ox = chunk.cx * S, oz = chunk.cz * S;
    // setL em coordenadas de MUNDO (as funções de árvore são compartilhadas com as mudas)
    const setL = (wx, y, wz, id, soft = true) => {
      const x = wx - ox, z = wz - oz;
      if (x < 0 || x >= S || z < 0 || z >= S || y < 0 || y >= H) return;
      const i = (y * S + z) * S + x;
      const cur = chunk.blocks[i];
      if (soft && cur !== B.AIR && !BLOCKS[cur].replaceable && !BLOCKS[cur].leaves) return;
      chunk.blocks[i] = id;
    };
    const getL = (x, y, z) => chunk.blocks[(y * S + z) * S + x];
    const hh = (x, y, z) => hash3(this.seed, x, y, z);

    // Árvores (inclusive as que nascem no chunk vizinho e invadem este)
    for (let lz = 0; lz < W; lz++) for (let lx = 0; lx < W; lx++) {
      const bi = biomes[lz * W + lx];
      const bd = BIOMES[bi];
      if (!bd.tree) continue;
      const wx = ox + lx - MARGIN, wz = oz + lz - MARGIN;
      const r = hash2(this.seed + 99, wx, wz);
      if (r >= bd.treeChance) continue;
      const h = heights[lz * W + lx];
      if (h < SEA_LEVEL) continue;
      const x = lx - MARGIN, z = lz - MARGIN;
      const inChunk = x >= 0 && x < S && z >= 0 && z < S;
      if (inChunk) {
        const ground = getL(x, h, z);
        if (bd.tree === 'cactus' ? ground !== B.SAND : (ground !== B.GRASS && ground !== B.SNOW_GRASS && ground !== B.DIRT)) continue;
      } else if (bi === BIOME.MOUNTAINS && h > 88) continue;
      const t = hash2(this.seed + 7, wx, wz);
      if (bd.tree === 'oak') {
        if (bd.birch && hash2(this.seed + 13, wx, wz) < bd.birch) Trees.birch(setL, hh, wx, h + 1, wz, 5 + Math.floor(t * 2));
        else Trees.oak(setL, hh, wx, h + 1, wz, 4 + Math.floor(t * 3));
      } else if (bd.tree === 'spruce') Trees.spruce(setL, hh, wx, h + 1, wz, 6 + Math.floor(t * 4));
      else if (bd.tree === 'jungle') Trees.jungle(setL, hh, wx, h + 1, wz, 8 + Math.floor(t * 6));
      else if (bd.tree === 'cactus' && inChunk) {
        const n = 1 + Math.floor(t * 3);
        for (let i = 0; i < n; i++) setL(wx, h + 1 + i, wz, B.CACTUS);
      }
    }

    // Plantas pequenas
    for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) {
      const mi = (z + MARGIN) * W + (x + MARGIN);
      const h = heights[mi];
      if (h + 1 >= H) continue;
      const bd = BIOMES[biomes[mi]];
      const ground = getL(x, h, z);
      if (getL(x, h + 1, z) !== B.AIR) continue;
      const r = hash2(this.seed + 31, ox + x, oz + z);
      let acc = 0;
      for (const [id, ch] of bd.plants) {
        acc += ch;
        if (r < acc) {
          const ok = id === B.DEAD_BUSH ? ground === B.SAND : (ground === B.GRASS || ground === B.SNOW_GRASS);
          if (ok) chunk.blocks[((h + 1) * S + z) * S + x] = id;
          break;
        }
      }
    }
  }

  // Ponto de nascimento: procura uma coluna de terra firme perto da origem.
  findSpawn() {
    for (let r = 0; r < 600; r += 8) {
      for (let a = 0; a < 8; a++) {
        const x = Math.round(Math.cos(a * Math.PI / 4) * r), z = Math.round(Math.sin(a * Math.PI / 4) * r);
        const c = this.column(x, z);
        if (c.h > SEA_LEVEL + 1 && c.biome !== BIOME.MOUNTAINS) return { x: x + 0.5, y: c.h + 2, z: z + 0.5 };
      }
    }
    return { x: 0.5, y: 90, z: 0.5 };
  }
}

// ---------------- NETHER ----------------
export class NetherGenerator {
  constructor(seed) {
    this.seed = (seed ^ 0x5eed) | 0;
    this.n = new SimplexNoise(this.seed);
    this.n2 = new SimplexNoise(this.seed + 1);
  }

  generate(chunk) {
    const ox = chunk.cx * S, oz = chunk.cz * S;
    const NY = (H >> 2) + 1;
    const field = new Float32Array(5 * 5 * NY);
    for (let gy = 0; gy < NY; gy++) for (let gz = 0; gz < 5; gz++) for (let gx = 0; gx < 5; gx++) {
      const x = ox + gx * GRID, y = gy * GRID, z = oz + gz * GRID;
      const t = (y - 66) / 58;
      field[(gy * 5 + gz) * 5 + gx] = this.n.fbm3(x / 70, y / 38, z / 70, 3) + t * t * 1.3;
    }
    const sample = (x, y, z) => {
      const gx = x >> 2, gy = y >> 2, gz = z >> 2;
      const fx = (x & 3) / 4, fy = (y & 3) / 4, fz = (z & 3) / 4;
      const at = (ix, iy, iz) => field[(iy * 5 + iz) * 5 + ix];
      const c00 = at(gx, gy, gz) * (1 - fx) + at(gx + 1, gy, gz) * fx;
      const c10 = at(gx, gy + 1, gz) * (1 - fx) + at(gx + 1, gy + 1, gz) * fx;
      const c01 = at(gx, gy, gz + 1) * (1 - fx) + at(gx + 1, gy, gz + 1) * fx;
      const c11 = at(gx, gy + 1, gz + 1) * (1 - fx) + at(gx + 1, gy + 1, gz + 1) * fx;
      const c0 = c00 * (1 - fy) + c10 * fy, c1 = c01 * (1 - fy) + c11 * fy;
      return c0 * (1 - fz) + c1 * fz;
    };
    chunk.biomes.fill(BIOME.NETHER);
    for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) {
      const soul = this.n2.noise2D((ox + x) / 30, (oz + z) / 30) > 0.45;
      for (let y = 0; y < H; y++) {
        let id;
        if (y === 0 || y === H - 1) id = B.BEDROCK;
        else if (y < 4 || y > H - 5) id = hash3(this.seed, ox + x, y, oz + z) < 0.5 ? B.BEDROCK : B.NETHERRACK;
        else id = sample(x, y, z) > 0.18 ? B.NETHERRACK : (y <= 32 ? B.LAVA : B.AIR);
        if (id === B.NETHERRACK && hash3(this.seed + 3, ox + x, y, oz + z) < 0.007) id = B.QUARTZ_ORE;
        chunk.blocks[(y * S + z) * S + x] = id;
      }
      // areia das almas nos pisos
      if (soul) for (let y = 33; y < H - 6; y++) {
        const i = (y * S + z) * S + x;
        if (chunk.blocks[i] === B.NETHERRACK && chunk.blocks[i + S * S] === B.AIR) chunk.blocks[i] = B.SOUL_SAND;
      }
    }
    // pedra luminosa pendurada no teto
    const rand = mulberry32((this.seed ^ Math.imul(chunk.cx, 7919) ^ Math.imul(chunk.cz, 104729)) | 0);
    for (let c = 0; c < 3; c++) {
      const x = Math.floor(rand() * S), z = Math.floor(rand() * S);
      for (let y = H - 6; y > 60; y--) {
        const i = (y * S + z) * S + x;
        if (chunk.blocks[i] === B.AIR && chunk.blocks[i + S * S] === B.NETHERRACK) {
          for (let k = 0; k < 18; k++) {
            const dx = x + Math.floor(rand() * 5) - 2, dz = z + Math.floor(rand() * 5) - 2, dy = y - Math.floor(rand() * 4);
            if (dx < 0 || dx >= S || dz < 0 || dz >= S) continue;
            const j = (dy * S + dz) * S + dx;
            if (chunk.blocks[j] === B.AIR) chunk.blocks[j] = B.GLOWSTONE;
          }
          break;
        }
      }
    }
  }

  findSpawn() { return { x: 0.5, y: 70, z: 0.5 }; }
}

// ---------------- AETHER ----------------
// Ilhas flutuantes: ruído 3D + uma "faixa" de altura preferida + máscara 2D que espalha as ilhas.
export class AetherGenerator {
  constructor(seed) {
    this.seed = (seed ^ 0xae7e) | 0;
    this.n = new SimplexNoise(this.seed);
    this.mask = new SimplexNoise(this.seed + 1);
    this.cloud = new SimplexNoise(this.seed + 2);
  }

  density(x, y, z) {
    const m = this.mask.fbm2(x / 260, z / 260, 3);
    const band = (y - 72) / 26;
    return this.n.fbm3(x / 70, y / 34, z / 70, 3) * 0.9 + m * 0.75 - band * band * 0.9 - 0.12;
  }

  generate(chunk) {
    const ox = chunk.cx * S, oz = chunk.cz * S;
    const NY = (H >> 2) + 1;
    const field = new Float32Array(5 * 5 * NY);
    for (let gy = 0; gy < NY; gy++) for (let gz = 0; gz < 5; gz++) for (let gx = 0; gx < 5; gx++)
      field[(gy * 5 + gz) * 5 + gx] = (gy * 4 < 30 || gy * 4 > 118) ? -1 : this.density(ox + gx * GRID, gy * GRID, oz + gz * GRID);
    const sample = (x, y, z) => {
      const gx = x >> 2, gy = y >> 2, gz = z >> 2;
      const fx = (x & 3) / 4, fy = (y & 3) / 4, fz = (z & 3) / 4;
      const at = (ix, iy, iz) => field[(iy * 5 + iz) * 5 + ix];
      const c00 = at(gx, gy, gz) * (1 - fx) + at(gx + 1, gy, gz) * fx;
      const c10 = at(gx, gy + 1, gz) * (1 - fx) + at(gx + 1, gy + 1, gz) * fx;
      const c01 = at(gx, gy, gz + 1) * (1 - fx) + at(gx + 1, gy, gz + 1) * fx;
      const c11 = at(gx, gy + 1, gz + 1) * (1 - fx) + at(gx + 1, gy + 1, gz + 1) * fx;
      const c0 = c00 * (1 - fy) + c10 * fy, c1 = c01 * (1 - fy) + c11 * fy;
      return c0 * (1 - fz) + c1 * fz;
    };
    chunk.biomes.fill(BIOME.AETHER);
    const B_ = chunk.blocks;
    for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) {
      let depth = 0;
      for (let y = H - 2; y >= 1; y--) {
        const i = (y * S + z) * S + x;
        if (sample(x, y, z) > 0) {
          let id = depth === 0 ? B.AETHER_GRASS : depth < 3 ? B.AETHER_DIRT : B.HOLYSTONE;
          if (id === B.HOLYSTONE) {
            const r = hash3(this.seed, ox + x, y, oz + z);
            if (r < 0.012) id = B.AMBROSIUM_ORE; else if (r < 0.02) id = B.ZANITE_ORE;
          }
          B_[i] = id; depth++;
        } else {
          depth = 0;
          // nuvens: camadas achatadas no ar
          const c = this.cloud.noise3D((ox + x) / 40, y / 6, (oz + z) / 40);
          if (y > 40 && y < 110 && c > 0.7) B_[i] = c > 0.86 && hash3(this.seed + 5, ox + x, y, oz + z) < 0.5 ? B.BLUE_AERCLOUD : B.AERCLOUD;
        }
      }
    }
    // árvores de raiz-celeste
    const hh = (x, y, z) => hash3(this.seed, x, y, z);
    const setL = (wx, y, wz, id, soft = true) => {
      const x = wx - ox, z = wz - oz;
      if (x < 0 || x >= S || z < 0 || z >= S || y < 0 || y >= H) return;
      const i = (y * S + z) * S + x;
      if (soft && B_[i] !== B.AIR && !BLOCKS[B_[i]].leaves && !BLOCKS[B_[i]].cloud) return;
      B_[i] = id;
    };
    for (let wz = oz - 3; wz < oz + S + 3; wz++) for (let wx = ox - 3; wx < ox + S + 3; wx++) {
      if (hash2(this.seed + 9, wx, wz) > 0.018) continue;
      // acha o topo da ilha nesta coluna (calculando pelo campo de densidade, funciona fora do chunk também)
      let top = -1;
      for (let y = 110; y > 32; y--) if (this.density(wx, y, wz) > 0) { top = y; break; }
      if (top < 0 || this.density(wx, top - 1, wz) <= 0) continue;
      const t = hash2(this.seed + 4, wx, wz);
      Trees.skyroot(setL, hh, wx, top + 1, wz, 5 + Math.floor(t * 2), t < 0.12);
    }
  }

  findSpawn() {
    for (let r = 0; r < 400; r += 6) for (let a = 0; a < 8; a++) {
      const x = Math.round(Math.cos(a * Math.PI / 4) * r), z = Math.round(Math.sin(a * Math.PI / 4) * r);
      for (let y = 110; y > 35; y--) if (this.density(x, y, z) > 0 && this.density(x, y - 2, z) > 0) return { x: x + 0.5, y: y + 2, z: z + 0.5 };
    }
    return { x: 0.5, y: 80, z: 0.5 };
  }
}

export function createGenerator(seed, dimension) {
  if (dimension === 'nether') return new NetherGenerator(seed);
  if (dimension === 'aether') return new AetherGenerator(seed);
  return new OverworldGenerator(seed);
}

// Utilitário de teste/depuração: gera um chunk isolado
export function generateChunk(gen, cx, cz) { const c = new Chunk(cx, cz); gen.generate(c); return c; }
