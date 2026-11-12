// entities/EntityManager.js
// Controla tudo que se mexe e não é bloco: mobs, flechas e itens largados no chão.
// Também decide ONDE e QUANDO criaturas nascem (spawn) e some com as que ficaram longe (despawn).
import * as THREE from 'three';
import { Animal, ANIMAL_TYPES } from './Animal.js';
import { Hostile, HOSTILE_TYPES } from './Hostile.js';
import { B, BLOCKS, ATLAS_COLS } from '../world/Blocks.js';
import { ITEMS } from '../systems/Items.js';
import { BIOME } from '../world/Biomes.js';
import { rayAABB } from '../engine/Raycast.js';
import { moveBody } from '../engine/Physics.js';

const CAP_PASSIVE = 12, CAP_HOSTILE = 14, CAP_NETHER = 10;

export class EntityManager {
  constructor(scene, atlasTexture) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'entities';
    scene.add(this.group);
    this.atlasTexture = atlasTexture;
    this.mobs = [];
    this.items = [];
    this.arrows = [];
    this.spawnTimer = 0;
    this.spriteCache = new Map();
    this.onPickup = null;      // (stack) → sobra (número)
    this.onPlayerHurt = null;
  }

  spawn(type, x, y, z) {
    const m = ANIMAL_TYPES[type] ? new Animal(type, x, y, z) : new Hostile(type, x, y, z);
    m.manager = this;
    this.mobs.push(m);
    this.group.add(m.object);
    return m;
  }

  clear() {
    for (const m of this.mobs) m.dispose();
    for (const it of this.items) it.sprite.removeFromParent();
    for (const a of this.arrows) a.mesh.removeFromParent();
    this.mobs = []; this.items = []; this.arrows = [];
  }

  counts() {
    let passive = 0, hostile = 0;
    for (const m of this.mobs) if (m.kind === 'passive') passive++; else hostile++;
    return { passive, hostile };
  }

  // ---------- combate ----------
  attackPlayer(mob, damage) {
    const p = this.ctx.player;
    if (p.damage(damage, 'mob:' + mob.type)) p.knockback(mob.pos.x, mob.pos.z, 5);
  }

  shootArrow(mob, player) {
    const from = new THREE.Vector3(mob.pos.x, mob.pos.y + mob.height * 0.8, mob.pos.z);
    const to = new THREE.Vector3(player.pos.x, player.pos.y + 1.2, player.pos.z);
    const d = to.clone().sub(from);
    const dist = d.length();
    d.normalize();
    const speed = 22;
    const vel = d.multiplyScalar(speed);
    vel.y += dist * 0.045 * 16 / speed * 2; // compensa a gravidade
    vel.x += (Math.random() - 0.5) * 1.2; vel.z += (Math.random() - 0.5) * 1.2;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.6), new THREE.MeshBasicMaterial({ color: 0x8a6a3a }));
    mesh.position.copy(from);
    this.group.add(mesh);
    this.arrows.push({ mesh, pos: from, vel, life: 6, stuck: false, owner: mob });
    if (this.sound) this.sound.play('bow', from);
  }

  // Raio da mira contra as caixas dos mobs (para bater)
  raycastMobs(origin, dir, maxDist) {
    let best = null;
    for (const m of this.mobs) {
      if (m.dead) continue;
      const box = m.aabb();
      const t = rayAABB(origin, dir, box.min, box.max);
      if (t !== null && t <= maxDist && (!best || t < best.dist)) best = { mob: m, dist: t };
    }
    return best;
  }

  // ---------- itens no chão ----------
  spriteMaterial(id) {
    if (this.spriteCache.has(id)) return this.spriteCache.get(id);
    const it = ITEMS[id];
    const tex = this.atlasTexture.clone();
    tex.needsUpdate = true;
    const tile = it.tile;
    tex.repeat.set(1 / ATLAS_COLS, 1 / ATLAS_COLS);
    tex.offset.set((tile % ATLAS_COLS) / ATLAS_COLS, 1 - (Math.floor(tile / ATLAS_COLS) + 1) / ATLAS_COLS);
    const mat = new THREE.SpriteMaterial({ map: tex, alphaTest: 0.5 });
    const bd = it.isBlock ? BLOCKS[it.block] : null;
    if (bd && bd.tint && bd.id !== B.GRASS) mat.color.set(0x6fb04a);
    mat.userData.base = mat.color.clone();
    this.spriteCache.set(id, mat);
    return mat;
  }

  dropItem(stack, pos, vel) {
    if (!stack || stack.count <= 0) return;
    const sprite = new THREE.Sprite(this.spriteMaterial(stack.id));
    sprite.scale.set(0.35, 0.35, 0.35);
    sprite.position.copy(pos);
    this.group.add(sprite);
    this.items.push({
      stack: { ...stack }, sprite, pos: pos.clone(),
      vel: vel ? vel.clone() : new THREE.Vector3((Math.random() - 0.5) * 3, 4, (Math.random() - 0.5) * 3),
      age: 0, pickupDelay: vel ? 1.2 : 0.4, onGround: false,
    });
  }

  // ---------- loop ----------
  update(dt, ctx) {
    ctx.manager = this;
    this.ctx = ctx;
    const { world, player } = ctx;

    for (const m of this.mobs) m.update(dt, ctx);
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const m = this.mobs[i];
      const far = m.distanceTo(player.pos) > (m.kind === 'passive' ? 110 : 72);
      if (m.removed || far) {
        if (m.removed && m.dead) for (const [id, n] of m.drops()) this.dropItem({ id, count: n, dmg: 0 }, m.pos.clone().add(new THREE.Vector3(0, 0.5, 0)));
        m.dispose();
        this.mobs.splice(i, 1);
      }
    }

    // flechas: balística simples
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i];
      a.life -= dt;
      if (!a.stuck) {
        a.vel.y -= 20 * dt;
        const next = a.pos.clone().addScaledVector(a.vel, dt);
        const id = world.getBlock(next.x, next.y, next.z);
        if (id && BLOCKS[id].solid) { a.stuck = true; a.life = Math.min(a.life, 3); }
        else {
          a.pos.copy(next);
          const p = player.pos;
          if (Math.abs(a.pos.x - p.x) < 0.4 && Math.abs(a.pos.z - p.z) < 0.4 && a.pos.y > p.y && a.pos.y < p.y + 1.8) {
            if (player.damage(3, 'arrow')) player.knockback(a.pos.x - a.vel.x, a.pos.z - a.vel.z, 3);
            a.life = 0;
          }
        }
        a.mesh.position.copy(a.pos);
        a.mesh.lookAt(a.pos.clone().add(a.vel));
      }
      if (a.life <= 0) { a.mesh.geometry.dispose(); a.mesh.removeFromParent(); this.arrows.splice(i, 1); }
    }

    // itens: caem, quicam e são coletados perto do jogador
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.age += dt;
      const body = { pos: it.pos, vel: it.vel, width: 0.25, height: 0.25, wasOnGround: it.onGround };
      it.vel.y -= 20 * dt;
      it.vel.x *= Math.pow(0.1, dt); it.vel.z *= Math.pow(0.1, dt);
      if (world.isLoaded(it.pos.x, it.pos.z)) it.onGround = moveBody(world, body, dt).onGround;
      it.sprite.position.set(it.pos.x, it.pos.y + 0.2 + Math.sin(it.age * 3) * 0.06, it.pos.z);
      const L = world.getLight(it.pos.x, it.pos.y + 0.3, it.pos.z);
      const b = Math.max(0.1, Math.pow(0.8, 15 - Math.max(L.sky * ctx.daylight, L.block, ctx.ambient * 15)));
      it.sprite.material.color.copy(it.sprite.material.userData.base).multiplyScalar(b);
      const d = Math.hypot(it.pos.x - player.pos.x, it.pos.y - (player.pos.y + 0.8), it.pos.z - player.pos.z);
      if (it.age > it.pickupDelay && d < 1.6 && !player.dead && this.onPickup) {
        const left = this.onPickup(it.stack);
        if (left <= 0) { it.sprite.removeFromParent(); this.items.splice(i, 1); continue; }
        it.stack.count = left;
      }
      if (it.age > 300 || it.pos.y < -20) { it.sprite.removeFromParent(); this.items.splice(i, 1); }
    }

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) { this.spawnTimer = 1; this.trySpawn(ctx); }
  }

  // ---------- spawn natural ----------
  randomColumn(player, minR, maxR) {
    const a = Math.random() * Math.PI * 2, r = minR + Math.random() * (maxR - minR);
    return { x: Math.floor(player.pos.x + Math.cos(a) * r), z: Math.floor(player.pos.z + Math.sin(a) * r) };
  }

  // /kill: 'monster' | 'passive' | 'all'
  kill(filter) {
    let n = 0;
    for (const m of this.mobs) {
      if (m.dead) continue;
      if (filter === 'all' || (filter === 'passive' && m.kind === 'passive') || (filter === 'monster' && m.kind !== 'passive')) {
        m.health = 0; m.dead = true; n++;
      }
    }
    return n;
  }

  trySpawn(ctx) {
    const { world, player, dimension, daylight } = ctx;
    const c = this.counts();
    if (dimension === 'aether') {
      if (c.passive >= CAP_PASSIVE || Math.random() > 0.35) return;
      const { x, z } = this.randomColumn(player, 20, 50);
      if (!this.ready(world, x, z)) return;
      const y = world.surfaceY(x, z);
      if (world.getBlock(x, y, z) !== B.AETHER_GRASS || !this.canStand(world, x, y + 1, z)) return;
      const type = Math.random() < 0.5 ? 'phyg' : 'sheepuff';
      const n = 1 + Math.floor(Math.random() * 3);
      for (let k = 0; k < n; k++) this.spawn(type, x + 0.5 + k * 0.4, y + 1, z + 0.5);
      return;
    }
    if (dimension === 'nether') {
      if (c.hostile >= CAP_NETHER) return;
      const { x, z } = this.randomColumn(player, 16, 40);
      if (!this.ready(world, x, z)) return;
      for (let y = Math.floor(player.pos.y) + 20; y > Math.max(33, player.pos.y - 25); y--) {
        if (this.canStand(world, x, y, z) && (world.getBlock(x, y - 1, z) === B.NETHERRACK || world.getBlock(x, y - 1, z) === B.SOUL_SAND)) {
          const n = 1 + Math.floor(Math.random() * 3);
          for (let k = 0; k < n; k++) this.spawn('pigman', x + 0.5 + k * 0.3, y, z + 0.5);
          return;
        }
      }
      return;
    }

    // passivos na superfície, de dia, sobre grama
    if (c.passive < CAP_PASSIVE && Math.random() < 0.35) {
      const { x, z } = this.randomColumn(player, 24, 56);
      if (this.ready(world, x, z)) {
        const y = world.surfaceY(x, z);
        const top = world.getBlock(x, y, z);
        if ((top === B.GRASS || top === B.SNOW_GRASS) && this.canStand(world, x, y + 1, z)) {
          const ch = world.chunkAt(x, z);
          const biome = ch.getBiome(x & 15, z & 15);
          let type, n;
          const r = Math.random();
          if ((biome === BIOME.FOREST || biome === BIOME.TUNDRA) && r < 0.15) { type = 'wolf'; n = 2 + Math.floor(Math.random() * 2); }
          else if ((biome === BIOME.TUNDRA || biome === BIOME.FOREST || biome === BIOME.SNOWY_PLAINS) && r < 0.3) { type = 'fox'; n = 1 + Math.floor(Math.random() * 2); }
          else { type = ['pig', 'cow', 'sheep', 'chicken'][Math.floor(Math.random() * 4)]; n = 2 + Math.floor(Math.random() * 3); }
          for (let k = 0; k < n; k++) {
            const ox = x + Math.floor(Math.random() * 5) - 2, oz = z + Math.floor(Math.random() * 5) - 2;
            const oy = world.surfaceY(ox, oz);
            if (this.canStand(world, ox, oy + 1, oz) && BLOCKS[world.getBlock(ox, oy, oz)].solid) this.spawn(type, ox + 0.5, oy + 1, oz + 0.5);
          }
        }
      }
    }

    // hostis: no escuro (noite na superfície ou cavernas)
    if (c.hostile < CAP_HOSTILE && Math.random() < 0.6) {
      const { x, z } = this.randomColumn(player, 20, 44);
      if (!this.ready(world, x, z)) return;
      const surface = Math.random() < 0.6;
      let y;
      if (surface) y = world.surfaceY(x, z) + 1;
      else {
        let yy = Math.floor(player.pos.y + (Math.random() - 0.5) * 30);
        y = null;
        for (let k = 0; k < 16; k++, yy--) if (this.canStand(world, x, yy, z) && BLOCKS[world.getBlock(x, yy - 1, z)].solid) { y = yy; break; }
        if (y === null) return;
      }
      if (!this.canStand(world, x, y, z) || !BLOCKS[world.getBlock(x, y - 1, z)]?.solid) return;
      if (world.getBlock(x, y - 1, z) === B.WATER || world.getBlock(x, y, z) === B.WATER) return;
      const L = world.getLight(x, y, z);
      const effective = Math.max(L.sky * daylight, L.block);
      if (effective > 7) return;
      const types = ['zombie', 'zombie', 'skeleton', 'spider'];
      const type = types[Math.floor(Math.random() * types.length)];
      this.spawn(type, x + 0.5, y, z + 0.5);
    }
  }

  ready(world, x, z) { const c = world.chunkAt(x, z); return !!(c && c.meshes); }

  canStand(world, x, y, z) {
    const a = world.getBlock(x, y, z), b = world.getBlock(x, y + 1, z);
    return (a === B.AIR || BLOCKS[a].replaceable && a !== B.WATER && a !== B.LAVA) && (b === B.AIR || (BLOCKS[b].replaceable && b !== B.WATER && b !== B.LAVA));
  }
}
