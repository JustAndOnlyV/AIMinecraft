// world/Fluids.js
// Simulação simples de fluxo. Cada bloco de água/lava tem um "nível" na meta: 0 = fonte, 1..7 = correndo.
// A água desce se tiver ar embaixo; se não, espalha para os lados aumentando o nível até sumir.
// Água encostando em lava: fonte de lava vira obsidiana, lava corrente vira pedregulho.
import { B, BLOCKS, isReplaceable } from './Blocks.js';

const MAX_LEVEL = { [B.WATER]: 7, [B.LAVA]: 4 };
const DELAY = { [B.WATER]: 5, [B.LAVA]: 25 }; // em ticks (20 ticks = 1 s)
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export class FluidSim {
  constructor(world) {
    this.world = world;
    this.pending = new Map(); // "x,y,z" → tick em que deve atualizar
    this.tickCount = 0;
    this.lavaLevelMax = world.dimension === 'nether' ? 6 : MAX_LEVEL[B.LAVA];
  }

  schedule(x, y, z, delay) {
    const key = x + ',' + y + ',' + z;
    const due = this.tickCount + delay;
    const cur = this.pending.get(key);
    if (cur === undefined || cur > due) this.pending.set(key, due);
  }

  scheduleAround(x, y, z) {
    const w = this.world;
    const chk = (a, b, c) => { const id = w.getBlock(a, b, c); if (id === B.WATER || id === B.LAVA) this.schedule(a, b, c, DELAY[id]); };
    chk(x, y, z); chk(x + 1, y, z); chk(x - 1, y, z); chk(x, y + 1, z); chk(x, y - 1, z); chk(x, y, z + 1); chk(x, y, z - 1);
  }

  maxLevel(id) { return id === B.LAVA ? this.lavaLevelMax : MAX_LEVEL[id]; }

  tick() {
    this.tickCount++;
    if (!this.pending.size) return;
    const due = [];
    for (const [k, t] of this.pending) if (t <= this.tickCount) { due.push(k); if (due.length > 800) break; }
    for (const k of due) {
      this.pending.delete(k);
      const [x, y, z] = k.split(',').map(Number);
      this.update(x, y, z);
    }
  }

  set(x, y, z, id, meta) { this.world.setBlock(x, y, z, id, meta, { fluid: true, cause: 'fluid', noSupport: false }); }

  update(x, y, z) {
    const w = this.world;
    if (!w.isLoaded(x, z)) return;
    const id = w.getBlock(x, y, z);
    if (id !== B.WATER && id !== B.LAVA) return;
    const other = id === B.WATER ? B.LAVA : B.WATER;
    let level = w.getMeta(x, y, z) & 7;
    const falling = (w.getMeta(x, y, z) & 8) !== 0;

    // Lava em contato com água endurece
    if (id === B.LAVA) {
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0]]) {
        if (w.getBlock(x + dx, y + dy, z + dz) === B.WATER) {
          this.set(x, y, z, level === 0 ? B.OBSIDIAN : B.COBBLE, 0);
          return;
        }
      }
    }

    // Blocos correntes conferem se ainda são alimentados
    if (level !== 0) {
      let fed = w.getBlock(x, y + 1, z) === id;
      let best = 99;
      for (const [dx, dz] of DIRS) {
        if (w.getBlock(x + dx, y, z + dz) === id) {
          const l = w.getMeta(x + dx, y, z + dz) & 7;
          if (l < level) fed = true;
          best = Math.min(best, l);
        }
      }
      if (!fed) {
        const step = id === B.LAVA ? 2 : 1;
        const nl = level + step;
        if (nl > this.maxLevel(id) || best === 99) { this.set(x, y, z, B.AIR, 0); return; }
        this.set(x, y, z, id, nl); level = nl;
      } else if (w.getBlock(x, y + 1, z) === id && !falling) {
        // coluna caindo: mantém nível baixo e marca como "caindo"
        this.set(x, y, z, id, 1 | 8); level = 1;
      }
    }

    // 1) descer
    const below = w.getBlock(x, y - 1, z);
    if (y > 0 && (isReplaceable(below) && below !== id)) {
      if (below === other) { this.set(x, y - 1, z, id === B.WATER ? B.STONE : (level === 0 ? B.OBSIDIAN : B.COBBLE), 0); return; }
      this.set(x, y - 1, z, id, 1 | 8);
      this.schedule(x, y - 1, z, DELAY[id]);
      if (level !== 0) return; // corrente que cai não se espalha
    }
    if (below === id && level !== 0) return;

    // 2) espalhar para os lados
    const step = id === B.LAVA ? 2 : 1;
    const nl = (level === 0 ? 0 : level) + step;
    if (nl > this.maxLevel(id)) return;
    for (const [dx, dz] of DIRS) {
      const nx = x + dx, nz = z + dz;
      if (!w.isLoaded(nx, nz)) continue;
      const n = w.getBlock(nx, y, nz);
      if (n === other) {
        this.set(nx, y, nz, id === B.WATER ? ((w.getMeta(nx, y, nz) & 7) === 0 ? B.OBSIDIAN : B.COBBLE) : B.COBBLE, 0);
        continue;
      }
      if (n === id) {
        const nlev = w.getMeta(nx, y, nz) & 7;
        if (nlev > nl) { this.set(nx, y, nz, id, nl); this.schedule(nx, y, nz, DELAY[id]); }
        continue;
      }
      if (isReplaceable(n) && !BLOCKS[n].liquid) {
        this.set(nx, y, nz, id, nl);
        this.schedule(nx, y, nz, DELAY[id]);
      }
    }
  }
}
