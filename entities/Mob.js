// entities/Mob.js
// Classe base de toda criatura: física (mesma do jogador), vida, dano, knockback e animação.
// As subclasses (Animal, Hostile) só decidem "para onde quero ir" no método ai().
import * as THREE from 'three';
import { createModel, animateModel } from './Models.js';
import { moveBody, touchesBlock } from '../engine/Physics.js';
import { B, BLOCKS } from '../world/Blocks.js';
import { mobName } from '../systems/i18n.js';

const GRAVITY = 32;
let NEXT_ID = 1;

export class Mob {
  constructor(type, cfg, x, y, z) {
    this.id = NEXT_ID++;
    this.type = type;
    this.cfg = cfg;
    this.pos = new THREE.Vector3(x, y, z);
    this.vel = new THREE.Vector3();
    this.width = cfg.width; this.height = cfg.height;
    this.maxHealth = cfg.health; this.health = cfg.health;
    this.speed = cfg.speed;
    this.yaw = Math.random() * Math.PI * 2;
    this.moveDir = new THREE.Vector3();
    this.speedMul = 1;
    this.wantJump = false;
    this.onGround = false;
    this.hurtTime = 0;
    this.dead = false;
    this.deathTime = 0;
    this.removed = false;
    this.walkPhase = 0;
    this.fallStart = null;
    this.burnTimer = 0;
    this.lookTarget = null;
    this.idleTimer = 4 + Math.random() * 10;
    this.fireTimer = 0;
    this.model = createModel(cfg.model || type);
    this.object = this.model.group;
    this.object.position.copy(this.pos);
    this.object.userData.mob = this;
  }

  get name() { return mobName(this.type); }
  sound(kind) { if (this.manager && this.manager.sound) this.manager.sound.mob(this.type, kind, this.pos); }

  get body() { return { pos: this.pos, vel: this.vel, width: this.width, height: this.height, wasOnGround: this.onGround }; }

  aabb() {
    const hw = this.width / 2;
    return {
      min: { x: this.pos.x - hw, y: this.pos.y, z: this.pos.z - hw },
      max: { x: this.pos.x + hw, y: this.pos.y + this.height, z: this.pos.z + hw },
    };
  }

  distanceTo(p) { return Math.hypot(p.x - this.pos.x, p.y - this.pos.y, p.z - this.pos.z); }

  // Subclasses sobrescrevem: definem moveDir / speedMul / wantJump / lookTarget
  ai(dt, ctx) { /* parado */ }

  update(dt, ctx) {
    const { world } = ctx;
    if (this.dead) {
      this.deathTime += dt;
      this.object.rotation.z = Math.min(Math.PI / 2, this.deathTime * 4);
      animateModel(this.model, 0, 0, true, 1);
      if (this.deathTime > 0.8) this.removed = true;
      return;
    }
    if (!world.isLoaded(this.pos.x, this.pos.z)) return; // chunk ainda não existe: congela
    if (this.hurtTime > 0) this.hurtTime -= dt;

    this.ai(dt, ctx);

    const inWater = touchesBlock(world, this.body, (id) => id === B.WATER);
    const inLava = touchesBlock(world, this.body, (id) => id === B.LAVA);
    if (touchesBlock(world, this.body, (id) => id === B.FIRE)) { this.fireTimer += dt; if (this.fireTimer > 1) { this.fireTimer = 0; this.hurt(1, null); } }
    this.idleTimer -= dt;
    if (this.idleTimer <= 0) { this.idleTimer = 6 + Math.random() * 12; this.sound('idle'); }
    const sp = this.speed * this.speedMul * (inWater ? 0.6 : 1);
    const control = this.onGround ? 10 : 2;
    const f = 1 - Math.exp(-control * dt);
    this.vel.x += (this.moveDir.x * sp - this.vel.x) * f;
    this.vel.z += (this.moveDir.z * sp - this.vel.z) * f;
    if (inWater || inLava) {
      this.vel.y += (2.2 - this.vel.y) * Math.min(1, dt * 3); // boia
      this.fallStart = null;
    } else {
      this.vel.y -= GRAVITY * dt;
      if (this.wantJump && this.onGround) this.vel.y = this.cfg.jump || 8.6;
    }
    this.wantJump = false;

    const res = moveBody(world, this.body, dt, 0);
    // pulo automático ao bater numa parede de 1 bloco
    if ((res.hitX || res.hitZ) && res.onGround && this.moveDir.lengthSq() > 0.01) this.vel.y = this.cfg.jump || 8.6;
    if (this.cfg.climbs && (res.hitX || res.hitZ) && this.moveDir.lengthSq() > 0.01) this.vel.y = 4; // aranha escala paredes

    // dano de queda
    if (!res.onGround && !inWater) this.fallStart = Math.max(this.fallStart ?? this.pos.y, this.pos.y);
    if (res.onGround && this.fallStart !== null) {
      const d = this.fallStart - this.pos.y;
      if (d > 3.5 && !this.cfg.climbs) this.hurt(Math.floor(d - 3), null);
      this.fallStart = null;
    }
    this.onGround = res.onGround;
    if (inLava) { this.burnTimer += dt; if (this.burnTimer > 0.5) { this.burnTimer = 0; this.hurt(4, null); } }
    if (this.pos.y < -30) this.removed = true;

    // rotação suave na direção do movimento (ou do alvo)
    let targetYaw = this.yaw;
    if (this.lookTarget) targetYaw = Math.atan2(this.lookTarget.x - this.pos.x, this.lookTarget.z - this.pos.z);
    else if (this.moveDir.lengthSq() > 0.01) targetYaw = Math.atan2(this.moveDir.x, this.moveDir.z);
    let dy = targetYaw - this.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.yaw += dy * Math.min(1, dt * 8);

    const hs = Math.hypot(this.vel.x, this.vel.z);
    this.walkPhase += hs * dt * 3.2;
    this.object.position.copy(this.pos);
    this.object.rotation.y = this.yaw;
    if (this.model.head && ctx.player && this.lookTarget) {
      const eyeY = this.pos.y + this.height * 0.85;
      const pitch = Math.atan2(eyeY - (ctx.player.pos.y + 1.5), Math.hypot(ctx.player.pos.x - this.pos.x, ctx.player.pos.z - this.pos.z));
      this.model.head.rotation.x = Math.max(-0.6, Math.min(0.6, pitch));
    } else if (this.model.head) this.model.head.rotation.x *= 0.9;

    // brilho segundo a luz do bloco onde está
    const L = world.getLight(this.pos.x, this.pos.y + this.height * 0.5, this.pos.z);
    const lv = Math.max(L.sky * ctx.daylight, L.block, ctx.ambient * 15);
    const bright = Math.max(0.08, Math.pow(0.8, 15 - lv));
    animateModel(this.model, this.walkPhase, Math.min(1, hs / 2), this.hurtTime > 0.25, bright);
  }

  hurt(amount, attacker, knockFrom) {
    if (this.dead || this.hurtTime > 0.3) return false;
    this.health -= amount;
    this.hurtTime = 0.5;
    if (knockFrom) {
      const dx = this.pos.x - knockFrom.x, dz = this.pos.z - knockFrom.z, l = Math.hypot(dx, dz) || 1;
      this.vel.x = dx / l * 7; this.vel.z = dz / l * 7; this.vel.y = 6;
    }
    this.onHurt(attacker);
    if (this.health <= 0) { this.dead = true; this.health = 0; this.sound('death'); }
    else this.sound('hurt');
    return true;
  }

  onHurt(attacker) { /* subclasses */ }

  drops() {
    const out = [];
    for (const [id, min, max] of this.cfg.drops || []) {
      const n = min + Math.floor(Math.random() * (max - min + 1));
      if (n > 0) out.push([id, n]);
    }
    return out;
  }

  // Bloco em que o mob pode pisar sem cair num buraco grande / lava (para não se matar vagando)
  safeAhead(world, dir) {
    const ax = this.pos.x + dir.x * 0.9, az = this.pos.z + dir.z * 0.9;
    for (let d = 0; d < 4; d++) {
      const id = world.getBlock(ax, this.pos.y - 1 - d, az);
      if (id === B.LAVA) return false;
      if (id && BLOCKS[id].solid) return true;
      if (id === B.WATER) return true;
    }
    return false;
  }

  dispose() {
    this.object.removeFromParent();
    for (const m of this.model.materials) m.dispose();
  }
}
