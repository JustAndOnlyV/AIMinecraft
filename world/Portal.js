// world/Portal.js
// Portais entre dimensões. Os dois tipos usam a mesma lógica, só mudam a moldura e o bloco de portal:
//  • Nether: moldura de obsidiana, acesa com isqueiro. Escala 1:8 (1 bloco no Nether = 8 no Overworld).
//  • Aether: moldura de glowstone, ativada com balde de água. Escala 1:1.
// Meta do bloco de portal: 0 = moldura no plano X (fina em Z), 1 = plano Z (fina em X).
import { B } from './Blocks.js';

export const PORTALS = {
  nether: { frame: B.OBSIDIAN, block: B.PORTAL, links: { overworld: 'nether', nether: 'overworld' }, scale: { overworld: 1 / 8, nether: 8 } },
  aether: { frame: B.GLOWSTONE, block: B.AETHER_PORTAL, links: { overworld: 'aether', aether: 'overworld' }, scale: { overworld: 1, aether: 1 } },
};
export function portalTypeOf(blockId) { return blockId === B.PORTAL ? 'nether' : blockId === B.AETHER_PORTAL ? 'aether' : null; }

const MAX = 21;

// Tenta abrir um portal cujo interior contém (x,y,z). Retorna true se abriu.
export function tryIgnitePortal(world, x, y, z, type = 'nether') {
  const P = PORTALS[type];
  for (const axis of [0, 1]) {
    const frame = findFrame(world, x, y, z, axis, P.frame);
    if (frame) {
      const { x0, y0, z0, w, h } = frame;
      for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) {
        const px = axis === 0 ? x0 + i : x0, pz = axis === 0 ? z0 : z0 + i;
        world.setBlock(px, y0 + j, pz, P.block, axis, { noSupport: true, cause: 'portal' });
      }
      return true;
    }
  }
  return false;
}

function findFrame(world, x, y, z, axis, frameId) {
  const dx = axis === 0 ? 1 : 0, dz = axis === 0 ? 0 : 1;
  const isAir = (a, b, c) => { const id = world.getBlock(a, b, c); return id === B.AIR || id === B.FIRE; };
  const isF = (a, b, c) => world.getBlock(a, b, c) === frameId;
  if (!isAir(x, y, z)) return null;
  let by = y, n = 0;
  while (isAir(x, by - 1, z) && n++ < MAX) by--;
  if (!isF(x, by - 1, z)) return null;
  let sx = x, sz = z; n = 0;
  while (isAir(sx - dx, by, sz - dz) && n++ < MAX) { sx -= dx; sz -= dz; }
  if (!isF(sx - dx, by, sz - dz)) return null;
  let w = 0;
  while (isAir(sx + dx * w, by, sz + dz * w) && w < MAX) w++;
  if (!isF(sx + dx * w, by, sz + dz * w) || w < 2) return null;
  let h = 0;
  while (isAir(sx, by + h, sz) && h < MAX) h++;
  if (h < 3) return null;
  for (let i = 0; i < w; i++) {
    if (!isF(sx + dx * i, by - 1, sz + dz * i) || !isF(sx + dx * i, by + h, sz + dz * i)) return null;
    for (let j = 0; j < h; j++) if (!isAir(sx + dx * i, by + j, sz + dz * i)) return null;
  }
  for (let j = 0; j < h; j++) if (!isF(sx - dx, by + j, sz - dz) || !isF(sx + dx * w, by + j, sz + dz * w)) return null;
  return { x0: sx, y0: by, z0: sz, w, h };
}

// Quando um bloco da moldura quebra, o portal some (preenchimento por inundação)
export function breakPortalAt(world, x, y, z, portalId) {
  const stack = [[x, y, z]];
  const seen = new Set();
  let count = 0;
  while (stack.length && count < 500) {
    const [a, b, c] = stack.pop();
    const k = a + ',' + b + ',' + c;
    if (seen.has(k)) continue;
    seen.add(k);
    if (world.getBlock(a, b, c) !== portalId) continue;
    world.setBlock(a, b, c, B.AIR, 0, { cause: 'portal' });
    count++;
    stack.push([a + 1, b, c], [a - 1, b, c], [a, b + 1, c], [a, b - 1, c], [a, b, c + 1], [a, b, c - 1]);
  }
}

// Encontra um portal existente perto do destino ou constrói um novo. Retorna onde o jogador aparece.
export function findOrCreatePortal(world, tx, tz, type = 'nether') {
  const P = PORTALS[type];
  tx = Math.floor(tx); tz = Math.floor(tz);
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) world.ensureChunkSync(Math.floor(tx / 16) + dx, Math.floor(tz / 16) + dz);
  let best = null, bestD = Infinity;
  for (let x = tx - 16; x <= tx + 16; x++) for (let z = tz - 16; z <= tz + 16; z++) for (let y = 5; y < 124; y++) {
    if (world.getBlock(x, y, z) === P.block && world.getBlock(x, y - 1, z) !== P.block) {
      const d = (x - tx) ** 2 + (z - tz) ** 2;
      if (d < bestD) { bestD = d; best = { x: x + 0.5, y, z: z + 0.5 }; }
    }
  }
  if (best) return best;

  let y0 = -1;
  if (world.dimension === 'nether') {
    for (let y = 34; y < 110 && y0 < 0; y++) {
      const g = world.getBlock(tx, y - 1, tz);
      if (g !== B.AIR && g !== B.LAVA && world.getBlock(tx, y, tz) === B.AIR && world.getBlock(tx, y + 1, tz) === B.AIR && world.getBlock(tx, y + 2, tz) === B.AIR) y0 = y;
    }
    if (y0 < 0) y0 = 64;
  } else if (world.dimension === 'aether') {
    const s = world.surfaceY(tx, tz);
    y0 = s > 30 ? s + 1 : 80; // sem ilha embaixo: plataforma flutuante
  } else {
    y0 = Math.max(world.surfaceY(tx, tz) + 1, 50);
  }

  const platform = world.dimension === 'aether' ? B.HOLYSTONE : P.frame;
  for (let dx = -2; dx <= 3; dx++) for (let dz = -2; dz <= 2; dz++) {
    world.setBlock(tx + dx, y0 - 1, tz + dz, platform, 0, { silent: true });
    for (let dy = 0; dy <= 4; dy++) world.setBlock(tx + dx, y0 + dy, tz + dz, B.AIR, 0, { silent: true, noSupport: true });
  }
  for (let i = -1; i <= 2; i++) {
    world.setBlock(tx + i, y0 - 1, tz, P.frame, 0, { silent: true });
    world.setBlock(tx + i, y0 + 3, tz, P.frame, 0, { silent: true });
  }
  for (let j = 0; j < 3; j++) {
    world.setBlock(tx - 1, y0 + j, tz, P.frame, 0, { silent: true });
    world.setBlock(tx + 2, y0 + j, tz, P.frame, 0, { silent: true });
    world.setBlock(tx, y0 + j, tz, P.block, 0, { silent: true, noSupport: true });
    world.setBlock(tx + 1, y0 + j, tz, P.block, 0, { silent: true, noSupport: true });
  }
  return { x: tx + 0.5, y: y0, z: tz + 1.5 }; // aparece ao lado do portal, não dentro (evita ida-e-volta)
}
