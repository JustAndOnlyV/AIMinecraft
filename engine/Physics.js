// engine/Physics.js
// Colisão AABB (caixa alinhada aos eixos) contra o mundo de blocos.
// Truque clássico: mover um eixo de cada vez (Y, depois X, depois Z). Se colidir num eixo,
// "encosta" na parede e zera a velocidade só naquele eixo → dá para deslizar pelas paredes.
//
// Robustez (correção do bug de atravessar blocos):
//  1) cada consulta usa seu PRÓPRIO buffer de caixas (antes o auto-step sobrescrevia a lista de paredes);
//  2) movimentos grandes são quebrados em subpassos de no máx. 0.4 bloco;
//  3) no fim, se a caixa ainda estiver dentro de algo (porta fechou, bloco caiu...), ela é empurrada para fora
//     pelo menor caminho ("depenetração").
import { collisionBoxes, BLOCKS } from '../world/Blocks.js';

const EPS = 1e-4;
const MAX_STEP = 0.4;

function gatherBoxes(world, minX, minY, minZ, maxX, maxY, maxZ, out) {
  out.length = 0;
  for (let y = Math.floor(minY) - 1; y <= Math.floor(maxY); y++)
    for (let z = Math.floor(minZ); z <= Math.floor(maxZ); z++)
      for (let x = Math.floor(minX); x <= Math.floor(maxX); x++) {
        const id = world.getBlock(x, y, z);
        if (!id) continue;
        const boxes = collisionBoxes(id, world.getMeta(x, y, z));
        if (!boxes) continue;
        for (const b of boxes) out.push([x + b[0], y + b[1], z + b[2], x + b[3], y + b[4], z + b[5]]);
      }
  return out;
}

const bufMove = [], bufStep = [], bufDrop = [], bufCollide = [], bufPush = [];

function moveStep(world, body, dx, dy, dz, stepHeight, res) {
  const hw = body.width / 2, h = body.height, p = body.pos, v = body.vel;
  const boxes = gatherBoxes(world,
    Math.min(p.x - hw, p.x - hw + dx) - 0.5, Math.min(p.y, p.y + dy) - 0.5, Math.min(p.z - hw, p.z - hw + dz) - 0.5,
    Math.max(p.x + hw, p.x + hw + dx) + 0.5, Math.max(p.y + h, p.y + h + dy) + 0.5 + stepHeight, Math.max(p.z + hw, p.z + hw + dz) + 0.5, bufMove);

  const overlapXZ = (b, x, z) => x + hw > b[0] + EPS && x - hw < b[3] - EPS && z + hw > b[2] + EPS && z - hw < b[5] - EPS;
  const overlapYZ = (b, y, z) => y + h > b[1] + EPS && y < b[4] - EPS && z + hw > b[2] + EPS && z - hw < b[5] - EPS;
  const overlapXY = (b, x, y) => x + hw > b[0] + EPS && x - hw < b[3] - EPS && y + h > b[1] + EPS && y < b[4] - EPS;

  // Eixo Y
  for (const b of boxes) {
    if (!overlapXZ(b, p.x, p.z)) continue;
    if (dy < 0 && p.y >= b[4] - 0.01 && p.y + dy < b[4]) { dy = b[4] - p.y; res.onGround = true; }
    else if (dy > 0 && p.y + h <= b[1] + 0.01 && p.y + h + dy > b[1]) { dy = b[1] - (p.y + h); res.hitCeil = true; }
  }
  p.y += dy;
  if (res.onGround || res.hitCeil) v.y = 0;

  const axis = (list, a, d) => {
    if (!d) return 0;
    let hit = false;
    for (const b of list) {
      if (a === 'x') {
        if (!overlapYZ(b, p.y, p.z)) continue;
        if (d > 0 && p.x + hw <= b[0] + 0.01 && p.x + hw + d > b[0]) { d = b[0] - (p.x + hw); hit = true; }
        else if (d < 0 && p.x - hw >= b[3] - 0.01 && p.x - hw + d < b[3]) { d = b[3] - (p.x - hw); hit = true; }
      } else {
        if (!overlapXY(b, p.x, p.y)) continue;
        if (d > 0 && p.z + hw <= b[2] + 0.01 && p.z + hw + d > b[2]) { d = b[2] - (p.z + hw); hit = true; }
        else if (d < 0 && p.z - hw >= b[5] - 0.01 && p.z - hw + d < b[5]) { d = b[5] - (p.z - hw); hit = true; }
      }
    }
    if (a === 'x') p.x += d; else p.z += d;
    return hit;
  };

  const startY = p.y, sx = p.x, sz = p.z;
  let hx = axis(boxes, 'x', dx), hz = axis(boxes, 'z', dz);

  // Auto-step: subir degraus de meio bloco (lajes/escadas) sem pular
  if (stepHeight > 0 && (hx || hz) && (res.onGround || body.wasOnGround)) {
    const save = { x: p.x, y: p.y, z: p.z };
    const firstDist = Math.hypot(p.x - sx, p.z - sz);
    p.x = sx; p.z = sz; p.y = startY + stepHeight;
    if (!collides(world, body)) {
      const sbx = axis(boxes, 'x', dx), sbz = axis(boxes, 'z', dz);
      if (Math.hypot(p.x - sx, p.z - sz) > firstDist + 0.01 && !collides(world, body)) {
        let drop = stepHeight;
        for (const b of gatherBoxes(world, p.x - hw, p.y - stepHeight - 1, p.z - hw, p.x + hw, p.y, p.z + hw, bufDrop)) {
          if (b[0] < p.x + hw - EPS && b[3] > p.x - hw + EPS && b[2] < p.z + hw - EPS && b[5] > p.z - hw + EPS && b[4] <= p.y + EPS) drop = Math.min(drop, p.y - b[4]);
        }
        p.y -= Math.max(0, drop);
        res.onGround = true;
        hx = sbx; hz = sbz;
      } else { p.x = save.x; p.y = save.y; p.z = save.z; }
    } else { p.x = save.x; p.y = save.y; p.z = save.z; }
  }
  if (hx) { v.x = 0; res.hitX = true; }
  if (hz) { v.z = 0; res.hitZ = true; }
}

// body: { pos: Vector3 (pés, centro), vel: Vector3, width, height }
export function moveBody(world, body, dt, stepHeight = 0) {
  const res = { onGround: false, hitX: false, hitZ: false, hitCeil: false };
  const v = body.vel;
  const tx = v.x * dt, ty = v.y * dt, tz = v.z * dt;
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(tx), Math.abs(ty), Math.abs(tz)) / MAX_STEP));
  for (let i = 0; i < n; i++) {
    moveStep(world, body, res.hitX ? 0 : tx / n, (res.onGround || res.hitCeil) ? 0 : ty / n, res.hitZ ? 0 : tz / n, stepHeight, res);
  }
  if (collides(world, body)) depenetrate(world, body);
  body.wasOnGround = res.onGround;
  return res;
}

// Empurra a caixa para fora do bloco pelo menor deslocamento (até 4 iterações)
export function depenetrate(world, body) {
  const hw = body.width / 2, h = body.height, p = body.pos;
  for (let it = 0; it < 4; it++) {
    const boxes = gatherBoxes(world, p.x - hw, p.y, p.z - hw, p.x + hw, p.y + h, p.z + hw, bufPush);
    let best = null;
    for (const b of boxes) {
      if (!(p.x + hw > b[0] + EPS && p.x - hw < b[3] - EPS && p.y + h > b[1] + EPS && p.y < b[4] - EPS && p.z + hw > b[2] + EPS && p.z - hw < b[5] - EPS)) continue;
      const opts = [
        ['x', b[3] - (p.x - hw)], ['x', -((p.x + hw) - b[0])],
        ['z', b[5] - (p.z - hw)], ['z', -((p.z + hw) - b[2])],
        ['y', (b[4] - p.y) * 0.8], // subir é preferível a ser jogado para o lado
      ];
      for (const [a, d] of opts) if (!best || Math.abs(d) < Math.abs(best[1])) best = [a, d];
      break;
    }
    if (!best) return;
    const d = best[1] + Math.sign(best[1]) * 0.001;
    if (best[0] === 'x') p.x += d; else if (best[0] === 'z') p.z += d; else p.y += best[1] / 0.8 + 0.001;
  }
}

export function collides(world, body) {
  const hw = body.width / 2, p = body.pos;
  const boxes = gatherBoxes(world, p.x - hw, p.y, p.z - hw, p.x + hw, p.y + body.height, p.z + hw, bufCollide);
  for (const b of boxes) {
    if (p.x + hw > b[0] + EPS && p.x - hw < b[3] - EPS && p.y + body.height > b[1] + EPS && p.y < b[4] - EPS && p.z + hw > b[2] + EPS && p.z - hw < b[5] - EPS) return true;
  }
  return false;
}

// Testa se a caixa do corpo encosta em algum bloco do tipo pedido (água, lava, portal...)
export function touchesBlock(world, body, test, shrink = 0.001) {
  const hw = body.width / 2 - shrink, p = body.pos;
  for (let y = Math.floor(p.y + shrink); y <= Math.floor(p.y + body.height - shrink); y++)
    for (let z = Math.floor(p.z - hw); z <= Math.floor(p.z + hw); z++)
      for (let x = Math.floor(p.x - hw); x <= Math.floor(p.x + hw); x++) {
        const id = world.getBlock(x, y, z);
        if (test(id)) return id;
      }
  return 0;
}

export function blockIsSolidAt(world, x, y, z) {
  const id = world.getBlock(x, y, z);
  return id && BLOCKS[id].solid;
}
