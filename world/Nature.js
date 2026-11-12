// world/Nature.js
// Comportamentos "vivos" do mundo, no estilo do Minecraft:
//  • Random ticks: a cada tick, alguns blocos aleatórios de cada chunk perto do jogador "acordam"
//    (grama espalha/morre, mudas crescem, lava acende coisas). É barato e dá um ritmo natural.
//  • Ticks agendados: decaimento de folhas depois que o tronco some, e o fogo (queima, espalha, apaga).
import { B, BLOCKS, IS_OPAQUE, isLiquid } from './Blocks.js';
import { CHUNK_SIZE, WORLD_HEIGHT } from './Chunk.js';
import { SAPLING_TREES } from './Trees.js';
import { hash3 } from './Noise.js';

const S = CHUNK_SIZE, H = WORLD_HEIGHT;
const RANDOM_TICKS_PER_CHUNK = 24; // 3 por seção 16x16x16 (como o Minecraft) x 8 seções
const LEAF_RANGE = 6;

const GRASS_OF = { [B.DIRT]: B.GRASS, [B.AETHER_DIRT]: B.AETHER_GRASS };
const DIRT_OF = { [B.GRASS]: B.DIRT, [B.SNOW_GRASS]: B.DIRT, [B.AETHER_GRASS]: B.AETHER_DIRT };

export class Nature {
  constructor(world) {
    this.world = world;
    this.pending = new Map(); // "x,y,z" → { due, kind }
    this.tickCount = 0;
  }

  schedule(x, y, z, delay, kind) {
    const key = x + ',' + y + ',' + z;
    const due = this.tickCount + delay;
    const cur = this.pending.get(key);
    if (!cur || cur.due > due) this.pending.set(key, { due, kind });
  }

  tick(pcx, pcz, radius) {
    this.tickCount++;
    const w = this.world;
    // 1) agendados
    if (this.pending.size) {
      const due = [];
      for (const [k, v] of this.pending) if (v.due <= this.tickCount) { due.push([k, v.kind]); if (due.length > 300) break; }
      for (const [k, kind] of due) {
        this.pending.delete(k);
        const [x, y, z] = k.split(',').map(Number);
        if (!w.isLoaded(x, z)) continue;
        if (kind === 'leaf') this.checkLeaf(x, y, z);
        else if (kind === 'fire') this.tickFire(x, y, z);
      }
    }
    // 2) aleatórios
    for (let dz = -radius; dz <= radius; dz++) for (let dx = -radius; dx <= radius; dx++) {
      const c = w.getChunk(pcx + dx, pcz + dz);
      if (!c || !c.meshes) continue;
      for (let k = 0; k < RANDOM_TICKS_PER_CHUNK; k++) {
        const lx = (Math.random() * S) | 0, lz = (Math.random() * S) | 0, y = (Math.random() * H) | 0;
        const id = c.blocks[(y * S + lz) * S + lx];
        if (!id) continue;
        this.randomTick(c.cx * S + lx, y, c.cz * S + lz, id);
      }
    }
  }

  randomTick(x, y, z, id) {
    const w = this.world;
    const d = BLOCKS[id];
    // grama: morre se coberta, espalha se tem luz
    if (DIRT_OF[id] !== undefined) {
      const above = w.getBlock(x, y + 1, z);
      if (IS_OPAQUE[above] || isLiquid(above)) { w.setBlock(x, y, z, DIRT_OF[id], 0, { cause: 'nature' }); return; }
      const L = w.getLight(x, y + 1, z);
      if (Math.max(L.sky, L.block) < 9) return;
      const tx = x + ((Math.random() * 3) | 0) - 1, ty = y + ((Math.random() * 5) | 0) - 3, tz = z + ((Math.random() * 3) | 0) - 1;
      const target = w.getBlock(tx, ty, tz);
      const into = GRASS_OF[target];
      if (into === undefined) return;
      if ((into === B.AETHER_GRASS) !== (id === B.AETHER_GRASS)) return;
      const ab = w.getBlock(tx, ty + 1, tz);
      if (IS_OPAQUE[ab] || isLiquid(ab)) return;
      const L2 = w.getLight(tx, ty + 1, tz);
      if (Math.max(L2.sky, L2.block) < 4) return;
      const c = w.chunkAt(tx, tz);
      const snowy = c && [3, 4, 9].includes(c.getBiome(tx & 15, tz & 15));
      w.setBlock(tx, ty, tz, into === B.GRASS && snowy ? B.SNOW_GRASS : into, 0, { cause: 'nature' });
      return;
    }
    if (d.leaves) { if (!(w.getMeta(x, y, z) & 1)) this.checkLeaf(x, y, z); return; }
    if (SAPLING_TREES[id]) {
      const L = w.getLight(x, y + 1, z);
      if (Math.max(L.sky, L.block) >= 9 && Math.random() < 1 / 7) this.growTree(x, y, z, id);
      return;
    }
    if (id === B.LAVA && Math.random() < 0.3) {
      const tx = x + ((Math.random() * 3) | 0) - 1, ty = y + 1 + ((Math.random() * 2) | 0), tz = z + ((Math.random() * 3) | 0) - 1;
      if (w.getBlock(tx, ty, tz) === B.AIR && this.flammableNeighbor(tx, ty, tz)) this.ignite(tx, ty, tz);
    }
  }

  // ---------- árvores ----------
  growTree(x, y, z, sapling) {
    const w = this.world;
    const soil = w.getBlock(x, y - 1, z);
    if (![B.GRASS, B.DIRT, B.SNOW_GRASS, B.AETHER_GRASS, B.AETHER_DIRT].includes(soil)) return false;
    for (let dy = 1; dy < 5; dy++) { const a = w.getBlock(x, y + dy, z); if (a && !BLOCKS[a].replaceable && !BLOCKS[a].leaves) return false; }
    const setL = (wx, wy, wz, id, soft) => {
      const cur = w.getBlock(wx, wy, wz);
      const free = cur === B.AIR || BLOCKS[cur].replaceable || BLOCKS[cur].leaves || (wx === x && wy === y && wz === z);
      if (!free || (soft && cur !== B.AIR && !BLOCKS[cur].replaceable)) return;
      w.setBlock(wx, wy, wz, id, 0, { cause: 'nature', noSupport: true });
    };
    w.setBlock(x, y, z, B.AIR, 0, { cause: 'nature', silent: true, noSupport: true });
    SAPLING_TREES[sapling](setL, (a, b, c) => hash3(1337, a, b, c), x, y, z, Math.random());
    return true;
  }

  // ---------- folhas ----------
  onLogRemoved(x, y, z) {
    const w = this.world;
    const r = 5;
    for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const id = w.getBlock(x + dx, y + dy, z + dz);
      if (BLOCKS[id] && BLOCKS[id].leaves && !(w.getMeta(x + dx, y + dy, z + dz) & 1)) this.schedule(x + dx, y + dy, z + dz, 10 + ((Math.random() * 120) | 0), 'leaf');
    }
  }

  // Busca em largura (BFS) pelas folhas conectadas: se nenhuma encostar num tronco em até 6 passos, a folha cai.
  checkLeaf(x, y, z) {
    const w = this.world;
    const id = w.getBlock(x, y, z);
    if (!BLOCKS[id] || !BLOCKS[id].leaves || (w.getMeta(x, y, z) & 1)) return;
    const seen = new Set([x + ',' + y + ',' + z]);
    let frontier = [[x, y, z]];
    for (let dist = 0; dist <= LEAF_RANGE && frontier.length; dist++) {
      const next = [];
      for (const [a, b, c] of frontier) {
        for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
          const nx = a + dx, ny = b + dy, nz = c + dz;
          const k = nx + ',' + ny + ',' + nz;
          if (seen.has(k)) continue;
          seen.add(k);
          const nid = w.getBlock(nx, ny, nz);
          if (!nid) continue;
          if (BLOCKS[nid].log) return; // encontrou tronco → continua viva
          if (BLOCKS[nid].leaves) next.push([nx, ny, nz]);
        }
      }
      frontier = next;
    }
    w.setBlock(x, y, z, B.AIR, 0, { cause: 'decay', dropOf: id });
  }

  // ---------- fogo ----------
  flammableNeighbor(x, y, z) {
    const w = this.world;
    let best = 0;
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const f = BLOCKS[w.getBlock(x + dx, y + dy, z + dz)].flammable;
      if (f && f[0] > best) best = f[0];
    }
    return best;
  }

  ignite(x, y, z, age = 0) {
    const w = this.world;
    const cur = w.getBlock(x, y, z);
    if (cur !== B.AIR && !(BLOCKS[cur].replaceable && !isLiquid(cur))) return false;
    const below = w.getBlock(x, y - 1, z);
    if (!(BLOCKS[below].solid) && !this.flammableNeighbor(x, y, z)) return false;
    w.setBlock(x, y, z, B.FIRE, age, { cause: 'fire' });
    this.schedule(x, y, z, 30 + ((Math.random() * 10) | 0), 'fire');
    return true;
  }

  tickFire(x, y, z) {
    const w = this.world;
    if (w.getBlock(x, y, z) !== B.FIRE) return;
    const below = w.getBlock(x, y - 1, z);
    const eternal = below === B.NETHERRACK;
    const fuel = this.flammableNeighbor(x, y, z);
    if (!BLOCKS[below].solid && !fuel) { w.setBlock(x, y, z, B.AIR, 0, { cause: 'fire' }); return; }
    let age = w.getMeta(x, y, z);
    if (!eternal) {
      if (age < 15 && Math.random() < 0.5) { age++; w.setMetaRaw(x, y, z, age); }
      if ((!fuel && age > 3 && !BLOCKS[below].flammable) || (age >= 15 && Math.random() < 0.25)) { w.setBlock(x, y, z, B.AIR, 0, { cause: 'fire' }); return; }
    }
    // consome vizinhos inflamáveis
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const nx = x + dx, ny = y + dy, nz = z + dz;
      const nid = w.getBlock(nx, ny, nz);
      const f = BLOCKS[nid].flammable;
      if (!f || Math.random() * 300 >= f[1]) continue;
      if (Math.random() < 0.5 && age < 12) {
        w.setBlock(nx, ny, nz, B.FIRE, Math.min(15, age + 2), { cause: 'burn' });
        this.schedule(nx, ny, nz, 30 + ((Math.random() * 10) | 0), 'fire');
      } else w.setBlock(nx, ny, nz, B.AIR, 0, { cause: 'burn' });
    }
    // espalha pelo ar próximo de coisas inflamáveis
    for (let dy = -1; dy <= 2; dy++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy && !dz) continue;
      const nx = x + dx, ny = y + dy, nz = z + dz;
      if (w.getBlock(nx, ny, nz) !== B.AIR) continue;
      const enc = this.flammableNeighbor(nx, ny, nz);
      if (enc && Math.random() * 100 * (dy > 1 ? 2 : 1) < enc * 0.5) this.ignite(nx, ny, nz, Math.min(15, age + 3));
    }
    this.schedule(x, y, z, 30 + ((Math.random() * 10) | 0), 'fire');
  }
}
