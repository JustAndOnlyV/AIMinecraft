// world/Storage.js
// Persistência local com IndexedDB (banco de dados do navegador, guarda objetos e Uint8Arrays direto).
// Só salvamos chunks que o jogador alterou; o resto é regenerado pela seed — economiza muito espaço.
const DB_NAME = 'webcraft';
const DB_VERSION = 1;

export class Storage {
  constructor() { this.db = null; this.available = typeof indexedDB !== 'undefined'; }

  async open() {
    if (!this.available) return this;
    try {
      this.db = await new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('chunks')) db.createObjectStore('chunks');
          if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('IndexedDB indisponível, jogo roda sem salvar.', e);
      this.available = false;
    }
    return this;
  }

  _tx(store, mode, fn) {
    if (!this.db) return Promise.resolve(null);
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(store, mode);
      const st = tx.objectStore(store);
      let result;
      const r = fn(st);
      if (r) r.onsuccess = () => { result = r.result; };
      tx.oncomplete = () => resolve(result ?? null);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  getMeta(key) { return this._tx('meta', 'readonly', (s) => s.get(key)).catch(() => null); }
  setMeta(key, value) { return this._tx('meta', 'readwrite', (s) => s.put(value, key)).catch((e) => console.warn(e)); }

  chunkKeys(dim) {
    return this._tx('chunks', 'readonly', (s) => s.getAllKeys())
      .then((keys) => new Set((keys || []).filter((k) => k.startsWith(dim + ':')).map((k) => k.slice(dim.length + 1))))
      .catch(() => new Set());
  }

  getChunk(dim, key) { return this._tx('chunks', 'readonly', (s) => s.get(dim + ':' + key)).catch(() => null); }

  // Salva vários chunks numa transação só (bem mais rápido que uma por chunk)
  putChunks(dim, list) {
    if (!this.db || !list.length) return Promise.resolve();
    return new Promise((resolve) => {
      const tx = this.db.transaction('chunks', 'readwrite');
      const st = tx.objectStore('chunks');
      for (const c of list) st.put(c.serialize(), dim + ':' + c.key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => { console.warn(tx.error); resolve(); };
    });
  }

  // Todos os chunks salvos (todas as dimensões): [[chaveCompleta, registro], ...]
  allChunks() {
    if (!this.db) return Promise.resolve([]);
    return new Promise((resolve) => {
      const out = [];
      const req = this.db.transaction('chunks', 'readonly').objectStore('chunks').openCursor();
      req.onsuccess = () => { const c = req.result; if (c) { out.push([c.key, c.value]); c.continue(); } else resolve(out); };
      req.onerror = () => resolve(out);
    });
  }

  putRaw(list) {
    if (!this.db || !list.length) return Promise.resolve();
    return new Promise((resolve) => {
      const tx = this.db.transaction('chunks', 'readwrite');
      const st = tx.objectStore('chunks');
      for (const [k, v] of list) st.put(v, k);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }

  async clearAll() {
    if (!this.db) return;
    await this._tx('chunks', 'readwrite', (s) => s.clear());
    await this._tx('meta', 'readwrite', (s) => s.clear());
  }
}
