// world/Trees.js
// Formatos de árvore reutilizados pela geração do mundo E pelo crescimento de mudas.
// setL(x, y, z, id, onlyReplaceSoft) é quem grava o bloco: no gerador escreve no chunk, na muda escreve no mundo.
// h(x, y, z) devolve um número [0,1) determinístico, para o formato das copas ser sempre o mesmo naquela posição.
import { B } from './Blocks.js';

export function oak(setL, h, x, y, z, height, log = B.LOG, leaves = B.LEAVES) {
  for (let dy = height - 3; dy <= height; dy++) {
    const r = dy >= height - 1 ? 1 : 2;
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      if (r === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2 && h(x + dx, y + dy, z + dz) < 0.6) continue;
      if (dy === height && Math.abs(dx) + Math.abs(dz) > 1) continue;
      setL(x + dx, y + dy, z + dz, leaves, true);
    }
  }
  for (let i = 0; i < height; i++) setL(x, y + i, z, log, false);
}

export function birch(setL, h, x, y, z, height) { oak(setL, h, x, y, z, height + 1, B.BIRCH_LOG, B.BIRCH_LEAVES); }

export function spruce(setL, h, x, y, z, height) {
  let r = 0;
  for (let dy = height; dy >= 2; dy--) {
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      if (r > 0 && Math.abs(dx) === r && Math.abs(dz) === r) continue;
      setL(x + dx, y + dy, z + dz, B.SPRUCE_LEAVES, true);
    }
    r = r >= 2 ? 1 : r + 1;
    if (dy === height) r = 1;
  }
  setL(x, y + height + 1, z, B.SPRUCE_LEAVES, true);
  for (let i = 0; i < height; i++) setL(x, y + i, z, B.SPRUCE_LOG, false);
}

export function jungle(setL, h, x, y, z, height) {
  for (let dy = height - 3; dy <= height + 1; dy++) {
    const r = dy > height - 1 ? 2 : 3;
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      if (dx * dx + dz * dz > r * r + 1) continue;
      setL(x + dx, y + dy, z + dz, B.JUNGLE_LEAVES, true);
    }
  }
  for (let i = 0; i < height; i++) setL(x, y + i, z, B.JUNGLE_LOG, false);
}

// Raiz-celeste do Aether: copa arredondada; às vezes dourada
export function skyroot(setL, h, x, y, z, height, golden = false) {
  const leaves = golden ? B.GOLDEN_LEAVES : B.SKYROOT_LEAVES;
  const cy = y + height - 1;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
    const d = dx * dx + dy * dy * 1.4 + dz * dz;
    if (d > 5.2 || (d > 4 && h(x + dx, cy + dy, z + dz) < 0.5)) continue;
    setL(x + dx, cy + dy, z + dz, leaves, true);
  }
  for (let i = 0; i < height; i++) setL(x, y + i, z, B.SKYROOT_LOG, false);
}

// Muda → árvore (chamado pelo sistema de natureza)
export const SAPLING_TREES = {
  [B.OAK_SAPLING]: (s, h, x, y, z, r) => oak(s, h, x, y, z, 4 + Math.floor(r * 3)),
  [B.BIRCH_SAPLING]: (s, h, x, y, z, r) => birch(s, h, x, y, z, 5 + Math.floor(r * 2)),
  [B.SPRUCE_SAPLING]: (s, h, x, y, z, r) => spruce(s, h, x, y, z, 6 + Math.floor(r * 4)),
  [B.JUNGLE_SAPLING]: (s, h, x, y, z, r) => jungle(s, h, x, y, z, 7 + Math.floor(r * 5)),
  [B.SKYROOT_SAPLING]: (s, h, x, y, z, r) => skyroot(s, h, x, y, z, 5 + Math.floor(r * 2), r < 0.1),
};
