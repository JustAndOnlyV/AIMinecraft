// engine/Camera.js
// Jogador em primeira pessoa: PointerLockControls (trava o mouse e gira a câmera),
// movimento por teclas configuráveis, gravidade, pulo, natação, voo no criativo, dano de queda,
// vida, fome, fogo, armadura e passos (com som).
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { moveBody, touchesBlock, collides } from './Physics.js';
import { B, BLOCKS } from '../world/Blocks.js';
import { DEFAULT_BINDS } from '../systems/Settings.js';

const GRAVITY = 32;
const JUMP_VEL = 8.6;
const WALK = 4.3, SPRINT = 5.6, SNEAK = 1.3, FLY = 10.9, FLY_SPRINT = 21.6;
// fontes de dano que a armadura NÃO reduz
const PIERCING = new Set(['fall', 'starve', 'drown', 'void', 'command']);

export class Player {
  constructor(camera, domElement) {
    this.camera = camera;
    this.controls = new PointerLockControls(camera, domElement);
    this.pos = new THREE.Vector3(0, 80, 0);
    this.vel = new THREE.Vector3();
    this.width = 0.6; this.height = 1.8; this.eye = 1.62;
    this.onGround = false; this.flying = false; this.mode = 'survival';
    this.maxHealth = 20; this.health = 20;
    this.hunger = 20; this.saturation = 5; this.exhaustion = 0;
    this.air = 300; this.maxAir = 300;
    this.fallStartY = null;
    this.inWater = false; this.headInWater = false; this.inLava = false; this.portalBlock = 0;
    this.hurtTimer = 0; this.regenTimer = 0; this.starveTimer = 0; this.lavaTimer = 0; this.drownTimer = 0; this.fireTimer = 0;
    this.burning = 0; // segundos pegando fogo
    this.dead = false;
    this.keys = new Set();
    this.binds = { ...DEFAULT_BINDS };
    this.lastSpace = 0; this.lastForward = 0;
    this.sprinting = false;
    this.bob = 0; this.nextStep = Math.PI;
    this.baseFov = 75; this.bobbing = true;
    this.armor = null;         // função → { points, damage(amount) } fornecida pelo jogo
    this.onDamage = null; this.onDeath = null; this.onStep = null; this.onSplash = null;
    this.spawnPoint = new THREE.Vector3(0, 80, 0);
    this.spawnDim = 'overworld';
    this.bindKeys();
  }

  isDown(action) { return this.keys.has(this.binds[action]); }

  bindKeys() {
    window.addEventListener('keydown', (e) => {
      if (!this.controls.isLocked) return;
      const now = performance.now();
      if (e.code === this.binds.jump && !e.repeat) {
        if (this.mode === 'creative' && now - this.lastSpace < 300) { this.flying = !this.flying; this.vel.y = 0; }
        this.lastSpace = now;
      }
      if (e.code === this.binds.forward && !e.repeat) {
        if (now - this.lastForward < 260) this.sprinting = true; // duplo toque para correr
        this.lastForward = now;
      }
      if (e.code === this.binds.sprint && this.isDown('forward')) this.sprinting = true;
      this.keys.add(e.code);
      if (e.code === this.binds.sprint) this.sprinting = this.isDown('forward') || this.sprinting;
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === this.binds.forward) this.sprinting = false;
    });
    window.addEventListener('blur', () => this.keys.clear());
  }

  get body() { return { pos: this.pos, vel: this.vel, width: this.width, height: this.height, wasOnGround: this.onGround }; }

  setMode(mode) {
    this.mode = mode;
    if (mode === 'survival') this.flying = false;
    if (mode === 'creative') { this.health = this.maxHealth; this.hunger = 20; this.burning = 0; }
  }

  teleport(x, y, z) { this.pos.set(x, y, z); this.vel.set(0, 0, 0); this.fallStartY = null; }

  eyePosition(out = new THREE.Vector3()) { return out.set(this.pos.x, this.pos.y + this.eyeHeight(), this.pos.z); }
  eyeHeight() { return this.isDown('sneak') && !this.flying ? this.eye - 0.2 : this.eye; }
  lookDirection(out = new THREE.Vector3()) { return this.camera.getWorldDirection(out); }

  update(dt, world) {
    if (this.dead) return;
    const body = this.body;
    const sneaking = this.isDown('sneak');

    this.inWater = !!touchesBlock(world, body, (id) => id === B.WATER);
    this.inLava = !!touchesBlock(world, body, (id) => id === B.LAVA);
    const inFire = !!touchesBlock(world, body, (id) => id === B.FIRE, 0.05);
    this.portalBlock = touchesBlock(world, body, (id) => id === B.PORTAL || id === B.AETHER_PORTAL, 0.2);
    const cloud = touchesBlock(world, { pos: this.pos, width: this.width, height: 0.4 }, (id) => BLOCKS[id].cloud);
    const eyeY = this.pos.y + this.eyeHeight();
    const wasHeadIn = this.headInWater;
    this.headInWater = world.getBlock(this.pos.x, eyeY, this.pos.z) === B.WATER;
    if (this.inWater && this.vel.y < -6 && this.onSplash) this.onSplash();

    const fwd = new THREE.Vector3();
    this.camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const wish = new THREE.Vector3();
    if (this.isDown('forward')) wish.add(fwd);
    if (this.isDown('back')) wish.sub(fwd);
    if (this.isDown('right')) wish.add(right);
    if (this.isDown('left')) wish.sub(right);
    if (wish.lengthSq() > 0) wish.normalize();
    if (!this.isDown('forward') || sneaking) this.sprinting = false;
    if (this.mode === 'survival' && this.hunger <= 6) this.sprinting = false;

    let speed = this.flying ? (this.sprinting ? FLY_SPRINT : FLY) : sneaking ? SNEAK : this.sprinting ? SPRINT : WALK;
    if (this.inWater && !this.flying) speed *= 0.55;
    if (this.inLava && !this.flying) speed *= 0.35;
    if (world.getBlock(this.pos.x, this.pos.y - 0.1, this.pos.z) === B.SOUL_SAND) speed *= 0.5;

    const control = this.flying ? 10 : this.onGround ? 14 : (this.inWater ? 6 : 2.5);
    const f = 1 - Math.exp(-control * dt);
    this.vel.x += (wish.x * speed - this.vel.x) * f;
    this.vel.z += (wish.z * speed - this.vel.z) * f;

    if (this.flying) {
      let vy = 0;
      if (this.isDown('jump')) vy += speed * 0.8;
      if (sneaking) vy -= speed * 0.8;
      this.vel.y += (vy - this.vel.y) * (1 - Math.exp(-10 * dt));
    } else if (this.inWater || this.inLava) {
      this.vel.y -= GRAVITY * 0.18 * dt;
      if (this.isDown('jump')) this.vel.y = Math.min(this.vel.y + 30 * dt, 3.5);
      this.vel.y *= Math.pow(0.4, dt);
      this.vel.y = Math.max(this.vel.y, -4);
      this.fallStartY = null;
    } else {
      this.vel.y -= GRAVITY * dt;
      this.vel.y = Math.max(this.vel.y, -78);
      if (this.isDown('jump') && this.onGround) {
        this.vel.y = JUMP_VEL;
        if (this.mode === 'survival') this.exhaustion += this.sprinting ? 0.2 : 0.05;
      }
    }
    // nuvens do Aether: a fria segura a queda, a azul arremessa para cima
    if (cloud && !this.flying) {
      if (BLOCKS[cloud].cloud === 'bounce') { this.vel.y = 18; }
      else { this.vel.y = Math.max(this.vel.y, sneaking ? -2 : -0.6); if (this.isDown('jump')) this.vel.y = 3; }
      this.fallStartY = null;
    }

    const oldX = this.pos.x, oldZ = this.pos.z;
    const res = moveBody(world, body, dt, this.onGround && !this.flying ? 0.6 : 0);
    // agachado: não cai da beirada
    if (sneaking && this.onGround && !this.flying && !res.onGround) {
      const test = { pos: this.pos.clone(), width: this.width, height: this.height };
      test.pos.y -= 0.6;
      if (!collides(world, test)) { this.pos.x = oldX; this.pos.z = oldZ; this.pos.y = Math.ceil(this.pos.y - 0.001); this.vel.y = 0; res.onGround = true; }
    }
    if (res.hitX && res.hitZ) this.sprinting = false;

    // dano de queda (a contagem começa no ponto mais alto)
    if (this.flying || this.inWater) this.fallStartY = null;
    else if (!res.onGround && !cloud) this.fallStartY = Math.max(this.fallStartY ?? -Infinity, this.pos.y);
    if (res.onGround && !this.onGround && this.fallStartY !== null) {
      const dist = this.fallStartY - this.pos.y;
      if (dist > 3.5) this.damage(Math.floor(dist - 3), 'fall');
      const under = world.getBlock(this.pos.x, this.pos.y - 0.2, this.pos.z);
      if (dist > 1 && this.onStep) this.onStep(under, true);
    }
    if (res.onGround) this.fallStartY = null;
    if (res.onGround && this.flying && this.mode === 'creative') this.flying = false;
    this.onGround = res.onGround;

    // passos
    const moved = Math.hypot(this.pos.x - oldX, this.pos.z - oldZ);
    if (this.mode === 'survival') this.exhaustion += moved * (this.sprinting ? 0.1 : 0.01);
    if (this.onGround && !this.flying) {
      this.bob += moved * 2.2;
      if (this.bob >= this.nextStep) {
        this.nextStep = this.bob + Math.PI;
        if (!sneaking && this.onStep) this.onStep(world.getBlock(this.pos.x, this.pos.y - 0.2, this.pos.z), false);
      }
    }

    // câmera nos olhos (+ balanço ao andar, se ligado)
    const bobY = this.bobbing && this.onGround && !this.flying ? Math.sin(this.bob) * 0.04 : 0;
    this.camera.position.set(this.pos.x, this.pos.y + this.eyeHeight() + bobY, this.pos.z);
    const targetFov = this.baseFov * (this.sprinting ? 1.13 : 1);
    if (Math.abs(this.camera.fov - targetFov) > 0.1) { this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 8); this.camera.updateProjectionMatrix(); }

    this.updateSurvival(dt, inFire);
    if (wasHeadIn !== this.headInWater && this.onSplash && this.headInWater) this.onSplash();
    if (this.pos.y < -40) this.damage(4, 'void', true);
  }

  updateSurvival(dt, inFire) {
    if (this.hurtTimer > 0) this.hurtTimer -= dt;
    if (this.inWater) this.burning = 0;
    if (this.mode !== 'survival') { this.air = this.maxAir; this.burning = 0; return; }
    while (this.exhaustion >= 4) {
      this.exhaustion -= 4;
      if (this.saturation > 0) this.saturation = Math.max(0, this.saturation - 1);
      else this.hunger = Math.max(0, this.hunger - 1);
    }
    this.regenTimer += dt;
    if (this.hunger >= 18 && this.health < this.maxHealth && this.regenTimer > 4) {
      this.regenTimer = 0; this.health = Math.min(this.maxHealth, this.health + 1); this.exhaustion += 3;
    }
    if (this.hunger === 0) {
      this.starveTimer += dt;
      if (this.starveTimer > 4) { this.starveTimer = 0; if (this.health > 1) this.damage(1, 'starve', true); }
    }
    if (this.headInWater) {
      this.air -= dt * 20;
      if (this.air <= 0) { this.air = 0; this.drownTimer += dt; if (this.drownTimer > 1) { this.drownTimer = 0; this.damage(2, 'drown', true); } }
    } else this.air = Math.min(this.maxAir, this.air + dt * 60);
    if (this.inLava) { this.burning = 8; this.lavaTimer += dt; if (this.lavaTimer > 0.5) { this.lavaTimer = 0; this.damage(4, 'lava', true); } }
    if (inFire) this.burning = Math.max(this.burning, 4);
    if (this.burning > 0) {
      this.burning -= dt;
      this.fireTimer += dt;
      if (this.fireTimer > 1) { this.fireTimer = 0; this.damage(1, 'fire', true); }
    }
  }

  damage(amount, source, ignoreCooldown = false) {
    if (this.mode === 'creative' && source !== 'void' && source !== 'command') return false;
    if (this.dead || amount <= 0) return false;
    if (!ignoreCooldown && this.hurtTimer > 0) return false;
    // armadura: cada ponto reduz 4% (máx. 80%), como no Minecraft
    if (this.armor && !PIERCING.has(source)) {
      const a = this.armor();
      if (a.points > 0) { amount *= 1 - Math.min(20, a.points) / 25; a.damage(Math.max(1, Math.floor(amount / 4))); }
    }
    this.health = Math.max(0, this.health - amount);
    this.health = Math.round(this.health * 10) / 10;
    this.hurtTimer = 0.5;
    this.exhaustion += 0.1;
    if (this.onDamage) this.onDamage(amount, source);
    if (this.health <= 0) { this.dead = true; if (this.onDeath) this.onDeath(source); }
    return true;
  }

  knockback(fromX, fromZ, strength = 6) {
    const dx = this.pos.x - fromX, dz = this.pos.z - fromZ, l = Math.hypot(dx, dz) || 1;
    this.vel.x += dx / l * strength; this.vel.z += dz / l * strength; this.vel.y = Math.max(this.vel.y, 5);
  }

  eat(food) {
    this.hunger = Math.min(20, this.hunger + food);
    this.saturation = Math.min(this.hunger, this.saturation + food * 0.6);
  }

  respawn() {
    this.dead = false; this.health = this.maxHealth; this.hunger = 20; this.saturation = 5; this.air = this.maxAir; this.burning = 0;
    this.teleport(this.spawnPoint.x, this.spawnPoint.y, this.spawnPoint.z);
  }

  serialize() {
    return {
      pos: [this.pos.x, this.pos.y, this.pos.z], yaw: this.getYaw(), pitch: this.getPitch(),
      health: this.health, hunger: this.hunger, saturation: this.saturation, mode: this.mode, flying: this.flying,
      spawn: [this.spawnPoint.x, this.spawnPoint.y, this.spawnPoint.z],
    };
  }
  load(d) {
    if (!d) return;
    this.teleport(d.pos[0], d.pos[1], d.pos[2]);
    this.health = d.health ?? 20; this.hunger = d.hunger ?? 20; this.saturation = d.saturation ?? 5;
    this.setMode(d.mode || 'survival'); this.flying = !!d.flying;
    if (d.spawn) this.spawnPoint.set(...d.spawn);
    this.camera.rotation.set(d.pitch || 0, d.yaw || 0, 0, 'YXZ');
  }
  getYaw() { return new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ').y; }
  getPitch() { return new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ').x; }
}
