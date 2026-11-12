// world/World.js
// Gerencia o conjunto de chunks de UMA dimensão: carrega/gera conforme o jogador anda, descarrega os distantes,
// reconstrói malhas só quando um bloco muda, e salva as alterações no IndexedDB.
import * as THREE from 'three';
import { Chunk, chunkKey, CHUNK_SIZE, WORLD_HEIGHT } from './Chunk.js';
import { createGenerator } from './WorldGenerator.js';
import { buildChunkMesh } from './ChunkMesher.js';
import { BLOCKS, B, IS_OPAQUE, LIGHT_EMIT, isLiquid } from './Blocks.js';
import { FluidSim } from './Fluids.js';
import { Nature } from './Nature.js';

const S = CHUNK_SIZE, H = WORLD_HEIGHT;

export class World {
  constructor({ dimension, seed, storage, materials, renderDistance = 6 }) {
    this.dimension = dimension;
    this.hasSky = dimension !== 'nether';
    this.seed = seed;
    this.storage = storage;
    this.materials = materials;
    this.generator = createGenerator(seed, dimension);
    this.chunks = new Map();
    this.loading = new Set();
    this.savedKeys = new Set();
    this.group = new THREE.Group();
    this.group.name = 'world-' + dimension;
    this.renderDistance = renderDistance;
    this.rebuildUrgent = new Set();
    this.fluids = new FluidSim(this);
    this.nature = new Nature(this);
    this.meshOptions = { smoothLighting: true };
    this.onBlockChange = null;   // callback (x,y,z,old,new) → usado pelo jogo (drops, etc.)
    this.stats = { generated: 0, meshed: 0, lastMeshMs: 0 };
  }

  async init() {
    if (this.storage) this.savedKeys = await this.storage.chunkKeys(this.dimension);
  }

  // ---------- acesso a blocos (coordenadas de mundo) ----------
  getChunk(cx, cz) { return this.chunks.get(chunkKey(cx, cz)); }
  chunkAt(x, z) { return this.chunks.get(chunkKey(Math.floor(x / S), Math.floor(z / S))); }

  getBlock(x, y, z) {
    if (y < 0 || y >= H) return 0;
    x = Math.floor(x); z = Math.floor(z); y = Math.floor(y);
    const c = this.chunks.get(chunkKey(Math.floor(x / S), Math.floor(z / S)));
    if (!c) return y < 1 ? B.BEDROCK : 0;
    return c.blocks[(y * S + (z & 15)) * S + (x & 15)];
  }

  getMeta(x, y, z) {
    if (y < 0 || y >= H) return 0;
    x = Math.floor(x); z = Math.floor(z); y = Math.floor(y);
    const c = this.chunks.get(chunkKey(Math.floor(x / S), Math.floor(z / S)));
    return c ? c.meta[(y * S + (z & 15)) * S + (x & 15)] : 0;
  }

  isLoaded(x, z) { return this.chunks.has(chunkKey(Math.floor(x / S), Math.floor(z / S))); }

  // Luz combinada no ponto: { sky: 0-15, block: 0-15 }
  getLight(x, y, z) {
    y = Math.floor(y);
    if (y >= H) return { sky: this.hasSky ? 15 : 0, block: 0 };
    if (y < 0) return { sky: 0, block: 0 };
    x = Math.floor(x); z = Math.floor(z);
    const c = this.chunks.get(chunkKey(Math.floor(x / S), Math.floor(z / S)));
    if (!c) return { sky: this.hasSky ? 15 : 0, block: 0 };
    const v = c.light[(y * S + (z & 15)) * S + (x & 15)];
    return { sky: v >> 4, block: v & 15 };
  }

  setBlock(x, y, z, id, meta = 0, opts = {}) {
    if (y < 0 || y >= H) return false;
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    const cx = Math.floor(x / S), cz = Math.floor(z / S);
    const c = this.chunks.get(chunkKey(cx, cz));
    if (!c) return false;
    const lx = x & 15, lz = z & 15;
    const i = (y * S + lz) * S + lx;
    const old = c.blocks[i];
    const oldMeta = c.meta[i];
    if (old === id && oldMeta === meta) return false;
    c.blocks[i] = id; c.meta[i] = meta;
    c.modified = true; c.dirtySave = true;
    if (old !== id) c.entities.delete(i);

    // Quais malhas precisam ser refeitas? Sempre a do próprio chunk (urgente).
    this.markRebuild(c, true);
    const lightChange = IS_OPAQUE[old] !== IS_OPAQUE[id] || LIGHT_EMIT[old] !== LIGHT_EMIT[id] || isLiquid(old) !== isLiquid(id);
    if (lightChange && !opts.fluid) {
      // luz alcança até 14 blocos: vizinhos dentro desse raio também mudam
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        if ((dx === -1 && lx > 14) || (dx === 1 && lx < 1) || (dz === -1 && lz > 14) || (dz === 1 && lz < 1)) continue;
        const n = this.chunks.get(chunkKey(cx + dx, cz + dz));
        if (n) this.markRebuild(n, false);
      }
    } else {
      // só a borda imediata (faces visíveis/AO do vizinho)
      if (lx === 0) this.markRebuildAt(cx - 1, cz, !!opts.fluid);
      if (lx === 15) this.markRebuildAt(cx + 1, cz, !!opts.fluid);
      if (lz === 0) this.markRebuildAt(cx, cz - 1, !!opts.fluid);
      if (lz === 15) this.markRebuildAt(cx, cz + 1, !!opts.fluid);
    }

    // Fluidos ao redor reagem
    this.fluids.scheduleAround(x, y, z);

    // Plantas/tochas sem apoio quebram
    if (!opts.noSupport) {
      const above = this.getBlock(x, y + 1, z);
      if (above && BLOCKS[above].needsSupport && (id === B.AIR || isLiquid(id))) {
        if (above !== B.CACTUS || id === B.AIR) {
          this.setBlock(x, y + 1, z, B.AIR, 0);
          if (this.onBlockChange) this.onBlockChange(x, y + 1, z, above, B.AIR, 'support');
        }
      }
    }
    if (BLOCKS[old].log && old !== id) this.nature.onLogRemoved(x, y, z);
    if (this.onBlockChange && !opts.silent) this.onBlockChange(x, y, z, old, id, opts.cause || 'set', opts, oldMeta);
    return true;
  }

  // Muda só o "meta" sem refazer malha (ex.: idade do fogo, que não muda o visual)
  setMetaRaw(x, y, z, m) {
    const c = this.chunkAt(x, z);
    if (!c || y < 0 || y >= H) return;
    c.meta[(Math.floor(y) * S + (Math.floor(z) & 15)) * S + (Math.floor(x) & 15)] = m;
  }

  remeshAll() { for (const c of this.chunks.values()) if (c.meshes) c.needsMesh = true; }

  markRebuildAt(cx, cz, urgent) { const n = this.chunks.get(chunkKey(cx, cz)); if (n) this.markRebuild(n, urgent); }
  markRebuild(c, urgent) {
    c.needsMesh = true;
    if (urgent) this.rebuildUrgent.add(c.key);
  }

  // ---------- block entities (fornalha / baú) ----------
  getBlockEntity(x, y, z) {
    const c = this.chunkAt(x, z);
    if (!c) return null;
    return c.entities.get((Math.floor(y) * S + (Math.floor(z) & 15)) * S + (Math.floor(x) & 15)) || null;
  }
  setBlockEntity(x, y, z, data) {
    const c = this.chunkAt(x, z);
    if (!c) return;
    c.entities.set((Math.floor(y) * S + (Math.floor(z) & 15)) * S + (Math.floor(x) & 15), data);
    c.modified = true; c.dirtySave = true;
  }
  *allBlockEntities() {
    for (const c of this.chunks.values()) for (const [i, e] of c.entities) {
      const x = c.cx * S + (i % S), z = c.cz * S + (Math.floor(i / S) % S), y = Math.floor(i / (S * S));
      yield { x, y, z, e, chunk: c };
    }
  }

  // ---------- carregamento ----------
  ensureChunkSync(cx, cz) {
    const key = chunkKey(cx, cz);
    let c = this.chunks.get(key);
    if (c) return c;
    c = new Chunk(cx, cz);
    this.generator.generate(c);
    this.chunks.set(key, c);
    this.stats.generated++;
    return c;
  }

  requestChunk(cx, cz) {
    const key = chunkKey(cx, cz);
    if (this.chunks.has(key) || this.loading.has(key)) return false;
    if (this.savedKeys.has(key) && this.storage) {
      this.loading.add(key);
      this.storage.getChunk(this.dimension, key).then((rec) => {
        this.loading.delete(key);
        if (this.chunks.has(key)) return;
        const c = new Chunk(cx, cz);
        if (rec) c.load(rec); else this.generator.generate(c);
        this.chunks.set(key, c);
        this.markNeighborsForMesh(cx, cz);
      });
      return true;
    }
    this.ensureChunkSync(cx, cz);
    this.markNeighborsForMesh(cx, cz);
    return true;
  }

  markNeighborsForMesh(cx, cz) {
    // um vizinho recém-chegado muda bordas/luz dos chunks já desenhados ao lado
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const n = this.chunks.get(chunkKey(cx + dx, cz + dz));
      if (n && n.meshes) n.needsMesh = true;
    }
  }

  hasAllNeighbors(cx, cz) {
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++)
      if (!this.chunks.has(chunkKey(cx + dx, cz + dz))) return false;
    return true;
  }

  // Chamado todo frame: gera/carrega/meshea dentro de um orçamento de tempo para não travar o jogo.
  update(px, pz, budgetMs = 8) {
    const t0 = performance.now();
    const pcx = Math.floor(px / S), pcz = Math.floor(pz / S);
    const rd = this.renderDistance;

    // 1) rebuilds urgentes (bloco quebrado/colocado) primeiro
    for (const key of this.rebuildUrgent) {
      const c = this.chunks.get(key);
      this.rebuildUrgent.delete(key);
      if (c && c.needsMesh && this.hasAllNeighbors(c.cx, c.cz)) this.buildMesh(c);
      if (performance.now() - t0 > budgetMs) return;
    }

    // 2) gerar chunks faltando (raio rd+1 para que o raio rd tenha vizinhos), do mais perto ao mais longe
    const want = [];
    for (let dz = -rd - 1; dz <= rd + 1; dz++) for (let dx = -rd - 1; dx <= rd + 1; dx++) {
      const d = dx * dx + dz * dz;
      if (d > (rd + 1.5) * (rd + 1.5)) continue;
      want.push([d, pcx + dx, pcz + dz]);
    }
    want.sort((a, b) => a[0] - b[0]);
    let generated = 0;
    for (const [, cx, cz] of want) {
      if (this.chunks.has(chunkKey(cx, cz))) continue;
      if (this.requestChunk(cx, cz)) generated++;
      if (generated >= 4 || performance.now() - t0 > budgetMs * 0.5) break;
    }

    // 3) malhas: chunks dentro do raio que precisam e têm todos os vizinhos
    for (const [d, cx, cz] of want) {
      if (d > (rd + 0.5) * (rd + 0.5)) continue;
      const c = this.chunks.get(chunkKey(cx, cz));
      if (!c || !c.needsMesh || !this.hasAllNeighbors(cx, cz)) continue;
      this.buildMesh(c);
      if (performance.now() - t0 > budgetMs) break;
    }

    // 4) descarregar os distantes (salvando os modificados)
    const unloadR = rd + 3;
    const toSave = [];
    for (const [key, c] of this.chunks) {
      if (Math.abs(c.cx - pcx) > unloadR || Math.abs(c.cz - pcz) > unloadR) {
        this.disposeMesh(c);
        if (c.modified) { toSave.push(c); this.savedKeys.add(key); }
        this.chunks.delete(key);
      }
    }
    if (toSave.length && this.storage) this.storage.putChunks(this.dimension, toSave);
  }

  buildMesh(c) {
    const t = performance.now();
    const data = buildChunkMesh((x, z) => this.getChunk(x, z), c, this.hasSky, this.meshOptions);
    c.needsMesh = false;
    if (!c.meshes) c.meshes = {};
    this.applyGeometry(c, 'opaque', data.opaque, this.materials.opaque);
    this.applyGeometry(c, 'translucent', data.translucent, this.materials.translucent);
    this.stats.meshed++;
    this.stats.lastMeshMs = performance.now() - t;
  }

  applyGeometry(c, name, d, material) {
    let mesh = c.meshes[name];
    if (!d.count) {
      if (mesh) { this.group.remove(mesh); mesh.geometry.dispose(); c.meshes[name] = null; }
      return;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(d.positions, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(d.uvs, 2));
    g.setAttribute('tint', new THREE.BufferAttribute(d.tints, 3));
    g.setAttribute('light', new THREE.BufferAttribute(d.lights, 2));
    g.setIndex(new THREE.BufferAttribute(d.indices, 1));
    g.boundingBox = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(S, H, S));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(S / 2, H / 2, S / 2), Math.sqrt(S * S * 2 + H * H) / 2);
    if (mesh) { mesh.geometry.dispose(); mesh.geometry = g; }
    else {
      mesh = new THREE.Mesh(g, material);
      mesh.position.set(c.cx * S, 0, c.cz * S);
      mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      if (name === 'translucent') mesh.renderOrder = 1;
      this.group.add(mesh);
      c.meshes[name] = mesh;
    }
  }

  disposeMesh(c) {
    if (!c.meshes) return;
    for (const k of ['opaque', 'translucent']) {
      const m = c.meshes[k];
      if (m) { this.group.remove(m); m.geometry.dispose(); }
    }
    c.meshes = null;
    c.needsMesh = true;
  }

  async save() {
    if (!this.storage) return;
    const list = [];
    for (const c of this.chunks.values()) if (c.dirtySave) { list.push(c); c.dirtySave = false; this.savedKeys.add(c.key); }
    await this.storage.putChunks(this.dimension, list);
    return list.length;
  }

  // Bloco sólido mais alto na coluna (para spawn de mobs / jogador)
  surfaceY(x, z) {
    const c = this.chunkAt(x, z);
    if (!c) return -1;
    return c.topY(Math.floor(x) & 15, Math.floor(z) & 15, (id) => BLOCKS[id].solid || isLiquid(id));
  }

  dispose() {
    for (const c of this.chunks.values()) this.disposeMesh(c);
    this.chunks.clear();
  }
}
