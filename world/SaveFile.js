// world/SaveFile.js
// Exportar/importar o mundo inteiro como UM arquivo (.wcworld).
// Formato: JSON compactado com gzip (CompressionStream, nativo do navegador).
// Os Uint8Array dos chunks viram texto base64 (forma de representar bytes usando só letras/números).

const MAGIC = 'webcraft-world';

function toB64(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromB64(b) {
  const s = atob(b); const u8 = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
  return u8;
}

async function gzip(text) {
  if (typeof CompressionStream === 'undefined') return new Blob([text], { type: 'application/json' });
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Response(stream).blob();
}
async function gunzip(blob) {
  const head = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
  if (head[0] === 0x1f && head[1] === 0x8b && typeof DecompressionStream !== 'undefined') {
    return new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).text();
  }
  return blob.text();
}

export async function exportWorld(storage) {
  const meta = await storage.getMeta('state');
  const records = await storage.allChunks();
  const chunks = records.map(([key, r]) => ({
    key, blocks: toB64(r.blocks), meta: toB64(r.meta), biomes: r.biomes ? toB64(r.biomes) : null, entities: r.entities || [],
  }));
  const json = JSON.stringify({ magic: MAGIC, version: 1, savedAt: new Date().toISOString(), meta, chunks });
  return gzip(json);
}

export async function importWorld(storage, file) {
  const text = await gunzip(file);
  const data = JSON.parse(text);
  if (data.magic !== MAGIC || !data.meta) throw new Error('invalid');
  await storage.clearAll();
  await storage.putRaw(data.chunks.map((c) => [c.key, {
    blocks: fromB64(c.blocks), meta: fromB64(c.meta), biomes: c.biomes ? fromB64(c.biomes) : null, entities: c.entities,
  }]));
  await storage.setMeta('state', data.meta);
  return data.meta;
}

// Entrega o arquivo ao usuário: seletor "Salvar como" quando existe, senão um link de download.
export async function deliverFile(blob, name) {
  if (window.showSaveFilePicker) {
    try {
      const h = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: 'WebCraft world', accept: { 'application/gzip': ['.wcworld'] } }] });
      const w = await h.createWritable(); await w.write(blob); await w.close();
      return true;
    } catch (e) { if (e && e.name === 'AbortError') return false; /* senão tenta o link */ }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return true;
}
