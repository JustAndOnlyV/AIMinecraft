// world/Chunk.js
// Um chunk é uma "fatia" 16 x 16 x WORLD_HEIGHT do mundo.
// Guardamos os blocos num Uint8Array (array de bytes): 1 byte por bloco, acesso O(1) e pouca memória.

export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 128;
export const SEA_LEVEL = 48;
const AREA = CHUNK_SIZE * CHUNK_SIZE;
export const CHUNK_VOLUME = AREA * WORLD_HEIGHT;

export function chunkKey(cx, cz) { return cx + ',' + cz; }

export class Chunk {
  constructor(cx, cz) {
    this.cx = cx;
    this.cz = cz;
    this.key = chunkKey(cx, cz);
    this.blocks = new Uint8Array(CHUNK_VOLUME);
    this.meta = new Uint8Array(CHUNK_VOLUME);   // nível de fluido / orientação de escada / eixo do portal
    this.light = new Uint8Array(CHUNK_VOLUME);  // (luzDoCéu << 4) | luzDeBloco, preenchido no rebuild
    this.biomes = new Uint8Array(AREA);         // bioma por coluna (x,z)
    this.entities = new Map();                   // block entities (fornalha, baú) por índice local
    this.modified = false;                       // foi alterado pelo jogador → precisa salvar
    this.dirtySave = false;
    this.meshes = null;                          // { opaque, translucent } (THREE.Mesh)
    this.needsMesh = true;
    this.state = 'ready';
  }

  static index(x, y, z) { return (y * CHUNK_SIZE + z) * CHUNK_SIZE + x; }

  get(x, y, z) {
    if (y < 0 || y >= WORLD_HEIGHT) return 0;
    return this.blocks[(y * CHUNK_SIZE + z) * CHUNK_SIZE + x];
  }

  set(x, y, z, id, meta = 0) {
    if (y < 0 || y >= WORLD_HEIGHT) return;
    const i = (y * CHUNK_SIZE + z) * CHUNK_SIZE + x;
    this.blocks[i] = id;
    this.meta[i] = meta;
  }

  getMeta(x, y, z) {
    if (y < 0 || y >= WORLD_HEIGHT) return 0;
    return this.meta[(y * CHUNK_SIZE + z) * CHUNK_SIZE + x];
  }

  getBiome(x, z) { return this.biomes[z * CHUNK_SIZE + x]; }

  // Altura do bloco sólido mais alto numa coluna (usado no spawn de mobs e do jogador)
  topY(x, z, solidTest) {
    for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
      const id = this.blocks[(y * CHUNK_SIZE + z) * CHUNK_SIZE + x];
      if (id !== 0 && (!solidTest || solidTest(id))) return y;
    }
    return -1;
  }

  // Serialização para o IndexedDB: blocos + meta + block entities.
  serialize() {
    const ents = [];
    for (const [idx, e] of this.entities) ents.push([idx, e]);
    return { blocks: this.blocks, meta: this.meta, biomes: this.biomes, entities: ents };
  }

  load(rec) {
    this.blocks.set(rec.blocks);
    this.meta.set(rec.meta);
    if (rec.biomes) this.biomes.set(rec.biomes);
    this.entities = new Map(rec.entities || []);
    this.modified = true;
  }
}
