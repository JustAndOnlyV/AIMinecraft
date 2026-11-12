// entities/Models.js
// Modelos "blocados" dos mobs, montados com caixas (BoxGeometry). Pernas e braços ficam em pivôs
// (THREE.Group posicionado na articulação) para girarem como no Minecraft ao andar.
import * as THREE from 'three';

const GEO_CACHE = new Map();
function geo(w, h, d) {
  const k = w + 'x' + h + 'x' + d;
  if (!GEO_CACHE.has(k)) GEO_CACHE.set(k, new THREE.BoxGeometry(w, h, d));
  return GEO_CACHE.get(k);
}

class ModelBuilder {
  constructor() { this.group = new THREE.Group(); this.materials = []; this.legs = []; this.arms = []; this.wings = []; this.head = null; }
  mat(color) {
    const m = new THREE.MeshLambertMaterial({ color });
    m.userData.base = new THREE.Color(color);
    this.materials.push(m);
    return m;
  }
  box(parent, w, h, d, color, x, y, z) {
    const mesh = new THREE.Mesh(geo(w, h, d), this.mat(color));
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }
  pivot(parent, x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }
  // perna pendurada no pivô (cresce para baixo)
  leg(x, y, z, w, h, d, color, list = this.legs) {
    const p = this.pivot(this.group, x, y, z);
    this.box(p, w, h, d, color, 0, -h / 2, 0);
    list.push(p);
    return p;
  }
  eyes(head, z, y, sep, color = 0x111111, size = 0.07) {
    this.box(head, size, size, 0.02, color, -sep, y, z);
    this.box(head, size, size, 0.02, color, sep, y, z);
  }
}

// Todas as dimensões em blocos (1 = 16 pixels do Minecraft). Frente do modelo = +Z.
const BUILDERS = {
  pig(b) {
    const pink = 0xf0a5a2;
    b.box(b.group, 0.6, 0.5, 0.9, pink, 0, 0.6, 0);
    b.head = b.pivot(b.group, 0, 0.7, 0.45);
    b.box(b.head, 0.5, 0.5, 0.5, pink, 0, 0, 0.2);
    b.box(b.head, 0.25, 0.18, 0.08, 0xe58a88, 0, -0.08, 0.48);
    b.eyes(b.head, 0.46, 0.08, 0.14);
    for (const [x, z] of [[-0.18, 0.3], [0.18, 0.3], [-0.18, -0.3], [0.18, -0.3]]) b.leg(x, 0.35, z, 0.2, 0.35, 0.2, pink);
  },
  cow(b) {
    const brown = 0x4b3626, white = 0xe8e8e8;
    b.box(b.group, 0.7, 0.6, 1.1, brown, 0, 0.95, 0);
    b.box(b.group, 0.72, 0.3, 0.4, white, 0, 1.05, -0.15);
    b.head = b.pivot(b.group, 0, 1.15, 0.55);
    b.box(b.head, 0.5, 0.45, 0.35, brown, 0, 0, 0.15);
    b.box(b.head, 0.3, 0.2, 0.08, 0xc9a99a, 0, -0.12, 0.34);
    b.box(b.head, 0.08, 0.15, 0.08, white, -0.28, 0.2, 0.1);
    b.box(b.head, 0.08, 0.15, 0.08, white, 0.28, 0.2, 0.1);
    b.eyes(b.head, 0.33, 0.07, 0.15);
    for (const [x, z] of [[-0.22, 0.4], [0.22, 0.4], [-0.22, -0.4], [0.22, -0.4]]) b.leg(x, 0.65, z, 0.22, 0.65, 0.22, brown);
  },
  sheep(b) {
    const wool = 0xe9ecec, skin = 0xd9c2a8;
    b.box(b.group, 0.7, 0.6, 1.0, wool, 0, 0.9, 0);
    b.head = b.pivot(b.group, 0, 1.05, 0.5);
    b.box(b.head, 0.4, 0.4, 0.4, skin, 0, 0, 0.18);
    b.box(b.head, 0.46, 0.2, 0.3, wool, 0, 0.16, 0.12);
    b.eyes(b.head, 0.39, 0.0, 0.11);
    for (const [x, z] of [[-0.2, 0.35], [0.2, 0.35], [-0.2, -0.35], [0.2, -0.35]]) b.leg(x, 0.6, z, 0.2, 0.6, 0.2, skin);
  },
  chicken(b) {
    const white = 0xf5f5f5;
    b.box(b.group, 0.38, 0.38, 0.5, white, 0, 0.5, 0);
    b.box(b.group, 0.06, 0.25, 0.35, white, -0.22, 0.52, 0);
    b.box(b.group, 0.06, 0.25, 0.35, white, 0.22, 0.52, 0);
    b.head = b.pivot(b.group, 0, 0.75, 0.22);
    b.box(b.head, 0.25, 0.35, 0.2, white, 0, 0.05, 0.05);
    b.box(b.head, 0.22, 0.1, 0.12, 0xf0b020, 0, 0.05, 0.2);
    b.box(b.head, 0.1, 0.12, 0.06, 0xd02020, 0, -0.08, 0.17);
    b.eyes(b.head, 0.16, 0.12, 0.09, 0x111111, 0.05);
    b.leg(-0.08, 0.32, 0, 0.06, 0.32, 0.06, 0xf0b020);
    b.leg(0.08, 0.32, 0, 0.06, 0.32, 0.06, 0xf0b020);
  },
  phyg(b) {
    BUILDERS.pig(b);
    for (const s of [-1, 1]) {
      const w = b.pivot(b.group, 0.32 * s, 0.75, 0.1);
      b.box(w, 0.5, 0.06, 0.4, 0xffffff, 0.25 * s, 0, 0);
      w.rotation.z = s * 0.4;
      b.wings.push(w);
    }
  },
  sheepuff(b) {
    const wool = 0xd8e6ff, skin = 0xe8dcc8;
    b.box(b.group, 1.0, 0.85, 1.2, wool, 0, 1.0, 0);
    b.head = b.pivot(b.group, 0, 1.1, 0.6);
    b.box(b.head, 0.4, 0.4, 0.4, skin, 0, 0, 0.18);
    b.box(b.head, 0.55, 0.25, 0.35, wool, 0, 0.18, 0.1);
    b.eyes(b.head, 0.39, 0.0, 0.11);
    for (const [x, z] of [[-0.25, 0.4], [0.25, 0.4], [-0.25, -0.4], [0.25, -0.4]]) b.leg(x, 0.6, z, 0.2, 0.6, 0.2, skin);
  },
  wolf(b) {
    const grey = 0xcfcac6;
    b.box(b.group, 0.4, 0.4, 0.9, grey, 0, 0.6, 0);
    b.box(b.group, 0.5, 0.45, 0.4, grey, 0, 0.65, 0.25);
    b.box(b.group, 0.12, 0.12, 0.45, grey, 0, 0.7, -0.6);
    b.head = b.pivot(b.group, 0, 0.75, 0.5);
    b.box(b.head, 0.4, 0.35, 0.3, grey, 0, 0, 0.12);
    b.box(b.head, 0.2, 0.15, 0.2, 0xa8a29e, 0, -0.08, 0.35);
    b.box(b.head, 0.1, 0.12, 0.06, grey, -0.12, 0.22, 0.05);
    b.box(b.head, 0.1, 0.12, 0.06, grey, 0.12, 0.22, 0.05);
    b.eyes(b.head, 0.28, 0.05, 0.1);
    for (const [x, z] of [[-0.12, 0.3], [0.12, 0.3], [-0.12, -0.3], [0.12, -0.3]]) b.leg(x, 0.4, z, 0.13, 0.4, 0.13, grey);
  },
  fox(b) {
    const orange = 0xe37c21, white = 0xf2ece4;
    b.box(b.group, 0.38, 0.32, 0.7, orange, 0, 0.42, 0);
    b.box(b.group, 0.2, 0.2, 0.5, orange, 0, 0.45, -0.55);
    b.box(b.group, 0.2, 0.2, 0.15, white, 0, 0.45, -0.85);
    b.head = b.pivot(b.group, 0, 0.55, 0.35);
    b.box(b.head, 0.4, 0.3, 0.3, orange, 0, 0, 0.12);
    b.box(b.head, 0.18, 0.12, 0.16, white, 0, -0.07, 0.33);
    b.box(b.head, 0.1, 0.12, 0.05, 0x222222, -0.12, 0.2, 0.05);
    b.box(b.head, 0.1, 0.12, 0.05, 0x222222, 0.12, 0.2, 0.05);
    b.eyes(b.head, 0.28, 0.04, 0.1);
    for (const [x, z] of [[-0.1, 0.22], [0.1, 0.22], [-0.1, -0.22], [0.1, -0.22]]) b.leg(x, 0.26, z, 0.1, 0.26, 0.1, 0x3a2a1a);
  },
  humanoid(b, o) {
    const { skin, shirt, pants, thin = false, armsForward = false } = o;
    const aw = thin ? 0.12 : 0.25;
    b.leg(-0.12, 0.75, 0, thin ? 0.12 : 0.25, 0.75, thin ? 0.12 : 0.25, pants);
    b.leg(0.12, 0.75, 0, thin ? 0.12 : 0.25, 0.75, thin ? 0.12 : 0.25, pants);
    b.box(b.group, 0.5, 0.75, 0.25, shirt, 0, 1.125, 0);
    b.head = b.pivot(b.group, 0, 1.5, 0);
    b.box(b.head, 0.5, 0.5, 0.5, skin, 0, 0.25, 0);
    b.eyes(b.head, 0.26, 0.28, 0.12, o.eyes || 0x111111, 0.09);
    for (const x of [-0.375, 0.375]) {
      const p = b.pivot(b.group, x, 1.45, 0);
      b.box(p, aw, 0.75, aw, o.armColor ?? skin, 0, -0.33, 0);
      if (armsForward) p.rotation.x = -Math.PI / 2;
      b.arms.push(p);
    }
  },
  zombie(b) { BUILDERS.humanoid(b, { skin: 0x4f8a3c, shirt: 0x2f9fa8, pants: 0x3a3a8c, armsForward: true }); },
  skeleton(b) { BUILDERS.humanoid(b, { skin: 0xc8c8c8, shirt: 0xbdbdbd, pants: 0xb0b0b0, thin: true }); },
  pigman(b) { BUILDERS.humanoid(b, { skin: 0xe8a0a0, shirt: 0x5a7a3a, pants: 0x7a5a3a, armColor: 0xe8a0a0, armsForward: false }); },
  spider(b) {
    const dark = 0x2b2420;
    b.box(b.group, 0.7, 0.55, 0.8, dark, 0, 0.5, -0.4);
    b.box(b.group, 0.45, 0.4, 0.35, dark, 0, 0.5, 0.15);
    b.head = b.pivot(b.group, 0, 0.5, 0.35);
    b.box(b.head, 0.5, 0.45, 0.4, dark, 0, 0, 0.18);
    b.eyes(b.head, 0.39, 0.06, 0.12, 0xd02020, 0.08);
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
      const p = b.pivot(b.group, 0.22 * s, 0.5, 0.1 - i * 0.18);
      b.box(p, 0.9, 0.08, 0.08, dark, 0.45 * s, 0, 0);
      p.rotation.z = s * 0.45; p.rotation.y = s * (i - 1.5) * 0.25;
      p.userData.side = s; p.userData.i = i;
      b.legs.push(p);
    }
  },
};

export function createModel(type) {
  const b = new ModelBuilder();
  (BUILDERS[type] || BUILDERS.pig)(b);
  b.group.traverse((o) => { o.matrixAutoUpdate = true; });
  return { group: b.group, materials: b.materials, legs: b.legs, arms: b.arms, wings: b.wings, head: b.head, type };
}

// Animação de caminhada: balança pernas (e braços) em fase oposta
export function animateModel(model, walkPhase, walkAmount, hurt, brightness) {
  const a = Math.sin(walkPhase) * 0.8 * walkAmount;
  if (model.type === 'spider') {
    for (const p of model.legs) p.rotation.x = Math.sin(walkPhase + p.userData.i * 1.3 + (p.userData.side > 0 ? Math.PI : 0)) * 0.35 * walkAmount;
  } else {
    model.legs.forEach((p, i) => { p.rotation.x = (i % 2 === (i < 2 ? 0 : 1) ? a : -a); });
    if (model.arms.length && (model.type === 'skeleton' || model.type === 'pigman')) model.arms.forEach((p, i) => { p.rotation.x = (i ? a : -a) * 0.8; });
  }
  model.wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * (0.3 + Math.sin(walkPhase * 3 + performance.now() / 120) * 0.5); });
  for (const m of model.materials) {
    m.color.copy(m.userData.base).multiplyScalar(brightness);
    if (hurt) m.color.lerp(new THREE.Color(1, 0.15, 0.15), 0.6);
  }
}
