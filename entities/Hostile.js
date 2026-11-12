// entities/Hostile.js
// Mobs neutros e agressivos. Mesma IA base: vagar → detectar o jogador → perseguir → atacar.
// "Neutro" = só persegue depois de provocado (lobo, zumbi-pigman) ou de noite (aranha).
import * as THREE from 'three';
import { Mob } from './Mob.js';
import { I } from '../systems/Items.js';
import { raycastVoxels } from '../engine/Raycast.js';

export const HOSTILE_TYPES = {
  zombie: { width: 0.6, height: 1.9, health: 20, speed: 2.4, damage: 3, range: 24, undead: true, aggressive: true, drops: [[I.ROTTEN_FLESH, 0, 2]] },
  skeleton: { width: 0.6, height: 1.9, health: 20, speed: 2.5, damage: 3, range: 16, undead: true, aggressive: true, ranged: true, drops: [[I.BONE, 0, 2], [I.ARROW, 0, 2]] },
  spider: { width: 1.3, height: 0.9, health: 16, speed: 3.6, damage: 2, range: 16, aggressive: true, dayNeutral: true, climbs: true, jump: 9, drops: [[I.STRING, 0, 2]] },
  pigman: { width: 0.6, height: 1.9, health: 20, speed: 3.0, damage: 5, range: 20, aggressive: false, groupAnger: true, drops: [[I.ROTTEN_FLESH, 0, 1], [I.GOLD_NUGGET, 0, 1]] },
  wolf: { width: 0.6, height: 0.85, health: 8, speed: 3.4, damage: 3, range: 16, aggressive: false, drops: [] },
  fox: { width: 0.6, height: 0.7, health: 10, speed: 3.0, damage: 2, range: 10, aggressive: false, shy: true, drops: [] },
};

export class Hostile extends Mob {
  constructor(type, x, y, z) {
    super(type, HOSTILE_TYPES[type], x, y, z);
    this.kind = this.cfg.aggressive ? 'hostile' : 'neutral';
    this.angry = 0;            // segundos restantes de raiva (neutros)
    this.attackCooldown = 0;
    this.shootCooldown = 1 + Math.random();
    this.wanderTimer = Math.random() * 2;
    this.fleeTimer = 0;
    this.strafe = Math.random() < 0.5 ? 1 : -1;
  }

  wantsToAttack(ctx) {
    const p = ctx.player;
    if (!p || p.dead || p.mode !== 'survival') return false;
    if (this.angry > 0) return true;
    if (!this.cfg.aggressive) return false;
    if (this.cfg.dayNeutral && ctx.daylight > 0.6 && ctx.dimension !== 'nether') return false;
    return true;
  }

  ai(dt, ctx) {
    const { world, player } = ctx;
    this.attackCooldown -= dt;
    if (this.angry > 0) this.angry -= dt;
    this.lookTarget = null;
    this.speedMul = 1;

    // mortos-vivos queimam no sol
    if (this.cfg.undead && ctx.daylight > 0.75 && ctx.dimension === 'overworld') {
      const L = world.getLight(this.pos.x, this.pos.y + this.height - 0.1, this.pos.z);
      if (L.sky >= 15) { this.burnTimer += dt; if (this.burnTimer > 1) { this.burnTimer = 0; this.hurt(1, null); } }
    }

    // raposa: tímida, foge de quem chega perto (a não ser agachado)
    if (this.cfg.shy && player && this.angry <= 0) {
      const d = this.distanceTo(player.pos);
      if (d < 6 && !player.isDown('sneak')) this.fleeTimer = 2;
      if (this.fleeTimer > 0) {
        this.fleeTimer -= dt;
        this.moveDir.set(this.pos.x - player.pos.x, 0, this.pos.z - player.pos.z).normalize();
        this.speedMul = 1.6;
        if (!this.safeAhead(world, this.moveDir)) this.moveDir.set(-this.moveDir.z, 0, this.moveDir.x);
        return;
      }
    }

    const dist = player ? this.distanceTo(player.pos) : Infinity;
    if (this.wantsToAttack(ctx) && dist < this.cfg.range) {
      this.lookTarget = player.pos;
      const to = new THREE.Vector3(player.pos.x - this.pos.x, 0, player.pos.z - this.pos.z);
      const flat = to.length();
      to.normalize();
      if (this.cfg.ranged) {
        // esqueleto: mantém distância e atira se enxergar o jogador
        if (flat > 10) this.moveDir.copy(to);
        else if (flat < 5) this.moveDir.copy(to).multiplyScalar(-1);
        else this.moveDir.set(-to.z * this.strafe, 0, to.x * this.strafe).multiplyScalar(0.5);
        this.shootCooldown -= dt;
        if (this.shootCooldown <= 0 && this.canSee(world, player)) {
          this.shootCooldown = 2 + Math.random();
          ctx.manager.shootArrow(this, player);
        }
      } else {
        this.moveDir.copy(to);
        this.speedMul = 1.25;
        if (player.pos.y > this.pos.y + 0.6 && flat < 2) this.wantJump = true;
        const reach = this.width / 2 + 1.1;
        if (flat < reach && Math.abs(player.pos.y - this.pos.y) < 1.8 && this.attackCooldown <= 0) {
          this.attackCooldown = 1;
          ctx.manager.attackPlayer(this, this.cfg.damage);
        }
      }
      return;
    }

    // vagar
    this.wanderTimer -= dt;
    if (this.wanderTimer <= 0) {
      if (Math.random() < 0.35) this.moveDir.set(0, 0, 0);
      else { const a = Math.random() * Math.PI * 2; this.moveDir.set(Math.sin(a), 0, Math.cos(a)); }
      this.wanderTimer = 2 + Math.random() * 4;
    }
    this.speedMul = 0.6;
    if (this.moveDir.lengthSq() > 0 && !this.safeAhead(world, this.moveDir)) { this.moveDir.multiplyScalar(-1); this.wanderTimer = 1; }
  }

  canSee(world, player) {
    const from = new THREE.Vector3(this.pos.x, this.pos.y + this.height * 0.85, this.pos.z);
    const to = new THREE.Vector3(player.pos.x, player.pos.y + 1.5, player.pos.z);
    const dir = to.clone().sub(from);
    const d = dir.length();
    dir.normalize();
    const hit = raycastVoxels(world, from, dir, d);
    return !hit;
  }

  onHurt(attacker) {
    if (attacker && attacker.isPlayer) {
      this.angry = 30;
      if (this.cfg.groupAnger && this.manager) {
        for (const m of this.manager.mobs) if (m !== this && m.type === this.type && m.distanceTo(this.pos) < 20) m.angry = 30;
      }
    }
  }
}
