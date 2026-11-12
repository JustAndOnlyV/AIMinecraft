// entities/Animal.js
// Mobs passivos: vagam aleatoriamente, param para "pastar" e fogem quando apanham.
import * as THREE from 'three';
import { Mob } from './Mob.js';
import { I } from '../systems/Items.js';
import { B } from '../world/Blocks.js';

export const ANIMAL_TYPES = {
  pig: { width: 0.9, height: 0.9, health: 10, speed: 2.2, drops: [[I.PORKCHOP, 1, 3]] },
  cow: { width: 0.9, height: 1.4, health: 10, speed: 2.0, drops: [[I.BEEF, 1, 3], [I.LEATHER, 0, 2]] },
  sheep: { width: 0.9, height: 1.3, health: 8, speed: 2.1, drops: [[B.WOOL_WHITE, 1, 1], [I.MUTTON, 1, 2]] },
  phyg: { width: 0.9, height: 0.9, health: 10, speed: 2.4, drops: [[I.PORKCHOP, 1, 2], [I.FEATHER, 0, 2]], slowFall: true, model: 'phyg' },
  sheepuff: { width: 0.9, height: 1.4, health: 8, speed: 2.0, drops: [[B.WOOL_WHITE, 1, 3]], slowFall: true, model: 'sheepuff' },
  chicken: { width: 0.4, height: 0.7, health: 4, speed: 2.0, drops: [[I.CHICKEN, 1, 1], [I.FEATHER, 0, 2]], slowFall: true },
};

export class Animal extends Mob {
  constructor(type, x, y, z) {
    super(type, ANIMAL_TYPES[type], x, y, z);
    this.wanderTimer = Math.random() * 3;
    this.panic = 0;
    this.kind = 'passive';
  }

  ai(dt, ctx) {
    const { world } = ctx;
    this.lookTarget = null;
    if (this.panic > 0) {
      this.panic -= dt;
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) { this.pickDirection(true); this.wanderTimer = 0.7; }
      this.speedMul = 1.9;
    } else {
      this.speedMul = 1;
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        if (Math.random() < 0.4) this.moveDir.set(0, 0, 0);
        else this.pickDirection(false);
        this.wanderTimer = 2 + Math.random() * 4;
      }
      // olha para o jogador quando ele chega perto
      if (ctx.player && this.distanceTo(ctx.player.pos) < 5 && this.moveDir.lengthSq() === 0) this.lookTarget = ctx.player.pos;
    }
    if (this.moveDir.lengthSq() > 0 && !this.safeAhead(world, this.moveDir)) {
      this.moveDir.multiplyScalar(-1);
      this.wanderTimer = 1;
    }
    if (this.cfg.slowFall && this.vel.y < -2) this.vel.y = -2; // galinha plana
  }

  pickDirection(away) {
    const a = Math.random() * Math.PI * 2;
    this.moveDir.set(Math.sin(a), 0, Math.cos(a));
    if (away && this.attackerPos) {
      const d = new THREE.Vector3(this.pos.x - this.attackerPos.x, 0, this.pos.z - this.attackerPos.z).normalize();
      this.moveDir.lerp(d, 0.7).normalize();
    }
  }

  onHurt(attacker) {
    this.panic = 5;
    this.attackerPos = attacker ? attacker.pos.clone() : null;
    this.wanderTimer = 0;
  }
}
