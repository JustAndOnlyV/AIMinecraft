// engine/Raycast.js
// "Qual bloco estou mirando?" → algoritmo DDA de voxels (Amanatides & Woo).
// Em vez de testar milhares de pontos ao longo do raio, pulamos exatamente de uma face de bloco para a próxima.
import { isLiquid } from '../world/Blocks.js';

export function raycastVoxels(world, origin, dir, maxDist, { liquids = false } = {}) {
  let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
  const stepX = dir.x > 0 ? 1 : -1, stepY = dir.y > 0 ? 1 : -1, stepZ = dir.z > 0 ? 1 : -1;
  const tDeltaX = Math.abs(1 / dir.x), tDeltaY = Math.abs(1 / dir.y), tDeltaZ = Math.abs(1 / dir.z);
  let tMaxX = dir.x === 0 ? Infinity : (dir.x > 0 ? x + 1 - origin.x : origin.x - x) * tDeltaX;
  let tMaxY = dir.y === 0 ? Infinity : (dir.y > 0 ? y + 1 - origin.y : origin.y - y) * tDeltaY;
  let tMaxZ = dir.z === 0 ? Infinity : (dir.z > 0 ? z + 1 - origin.z : origin.z - z) * tDeltaZ;
  let nx = 0, ny = 0, nz = 0, t = 0;

  while (t <= maxDist) {
    const id = world.getBlock(x, y, z);
    if (id && (liquids ? true : !isLiquid(id))) {
      if (!(liquids && isLiquid(id) && (world.getMeta(x, y, z) & 7) !== 0)) // com balde, só pega fonte
        return { x, y, z, nx, ny, nz, id, dist: t };
    }
    if (tMaxX < tMaxY) {
      if (tMaxX < tMaxZ) { x += stepX; t = tMaxX; tMaxX += tDeltaX; nx = -stepX; ny = 0; nz = 0; }
      else { z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; nx = 0; ny = 0; nz = -stepZ; }
    } else {
      if (tMaxY < tMaxZ) { y += stepY; t = tMaxY; tMaxY += tDeltaY; nx = 0; ny = -stepY; nz = 0; }
      else { z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; nx = 0; ny = 0; nz = -stepZ; }
    }
  }
  return null;
}

// Raio contra caixa (para acertar mobs). Retorna distância ou null.
export function rayAABB(origin, dir, min, max) {
  let tmin = 0, tmax = Infinity;
  for (const a of ['x', 'y', 'z']) {
    if (Math.abs(dir[a]) < 1e-9) { if (origin[a] < min[a] || origin[a] > max[a]) return null; continue; }
    let t1 = (min[a] - origin[a]) / dir[a], t2 = (max[a] - origin[a]) / dir[a];
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  return tmin;
}
