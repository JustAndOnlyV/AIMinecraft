// main.js
// Ponto de entrada: cria os sistemas, controla os estados do jogo (menu → carregando → jogando ↔ pausa/telas/chat/morte)
// e roda o loop. Dois "relógios": o frame (física e desenho, ~60x/s) e o tick fixo de 20x/s (fluidos, fogo,
// natureza, fornalhas, fome, spawn, hora do dia) — igual ao Minecraft, que roda a lógica a 20 TPS.
import * as THREE from 'three';
import { Renderer, DAY_LENGTH } from './engine/Renderer.js';
import { Player } from './engine/Camera.js';
import { raycastVoxels } from './engine/Raycast.js';
import { World } from './world/World.js';
import { Storage } from './world/Storage.js';
import { B, BLOCKS, isReplaceable, isLiquid, collisionBoxes } from './world/Blocks.js';
import { BIOMES } from './world/Biomes.js';
import { CHUNK_SIZE } from './world/Chunk.js';
import { seedFromString } from './world/Noise.js';
import { PORTALS, portalTypeOf, tryIgnitePortal, breakPortalAt, findOrCreatePortal } from './world/Portal.js';
import { exportWorld, importWorld, deliverFile } from './world/SaveFile.js';
import { Inventory } from './systems/Inventory.js';
import { ITEMS, I, breakTime, blockDrops } from './systems/Items.js';
import { UI } from './systems/UI.js';
import { createFurnaceState, createChestState, tickFurnace } from './systems/Furnace.js';
import { Settings, keyLabel } from './systems/Settings.js';
import { Sound } from './systems/Sound.js';
import { Commands } from './systems/Commands.js';
import { OptionsMenu } from './systems/OptionsMenu.js';
import { t, setLanguage, applyDOM, mobName, biomeName } from './systems/i18n.js';
import { EntityManager } from './entities/EntityManager.js';

const TICK = 1 / 20;
const $ = (s) => document.querySelector(s);
const DIR = [[0, 1], [-1, 0], [0, -1], [1, 0]]; // meta de direção → (dx, dz): 0:+z 1:-x 2:-z 3:+x

class Game {
  constructor() {
    this.settings = new Settings();
    setLanguage(this.settings.get('lang'));
    this.state = 'menu';
    this.renderer = new Renderer($('#game'));
    this.storage = new Storage();
    this.sound = new Sound(this.settings);
    this.ui = new UI($('#hud-root'), this.renderer.atlas.dataURL);
    this.inventory = new Inventory();
    this.ui.inventory = this.inventory;
    this.player = new Player(this.renderer.camera, document.body);
    this.entities = new EntityManager(this.renderer.scene, this.renderer.atlas.texture);
    this.entities.sound = this.sound;
    this.commands = new Commands(this);
    this.options = new OptionsMenu($('#options'), this.settings, this.sound);
    this.worlds = {};
    this.world = null;
    this.dimension = 'overworld';
    this.time = 1000;
    this.tickAcc = 0;
    this.saveTimer = 0;
    this.breaking = null;
    this.mouse = { left: false, right: false };
    this.useCooldown = 0; this.attackCooldown = 0; this.digSoundTimer = 0;
    this.portalTimer = 0; this.portalLock = false;
    this.showDebug = false;
    this.fps = 0; this.frames = 0; this.fpsTime = 0;
    this.allItems = ITEMS.filter((it) => it && !it.hidden).map((it) => it.id);
    this.tmpV = new THREE.Vector3(); this.tmpD = new THREE.Vector3();
    this.chatHistory = []; this.chatHistoryPos = 0;

    this.inventory.onChange(() => this.ui.updateHotbar(this.inventory));
    this.ui.onClose = () => this.resumeFromScreen();
    this.ui.dropToWorld = (stack) => this.dropFromPlayer(stack);
    this.entities.onPickup = (stack) => {
      const left = this.inventory.add(stack.id, stack.count, stack.dmg);
      if (left < stack.count) this.sound.play('pop');
      return left;
    };
    const p = this.player;
    p.armor = () => ({ points: this.inventory.armorPoints(), damage: (n) => this.inventory.damageArmor(n) });
    p.onDamage = () => { this.ui.flashDamage(); this.sound.play('hurt'); };
    p.onDeath = (src) => this.onDeath(src);
    p.onStep = (id, landing) => { if (id) this.sound.block(landing ? 'place' : 'step', BLOCKS[id].sound, p.pos); };
    p.onSplash = () => this.sound.play('splash', p.pos);

    this.settings.onChange((k) => this.applySetting(k));
    for (const k of ['fov', 'sensitivity', 'brightness', 'renderScale', 'clouds', 'bobbing', 'binds', 'volume']) this.applySetting(k);
    applyDOM();
    this.buildControlsHelp();

    this.bindMenu();
    this.bindInput();
    this.last = performance.now();
    requestAnimationFrame((ts) => this.loop(ts));
  }

  // ------------------------------------------------------------------ OPÇÕES
  applySetting(k) {
    const S = this.settings, p = this.player;
    switch (k) {
      case 'fov': p.baseFov = S.get('fov'); break;
      case 'sensitivity': p.controls.pointerSpeed = S.get('sensitivity'); break;
      case 'brightness': this.renderer.setBrightness(S.get('brightness')); break;
      case 'renderScale': this.renderer.setRenderScale(S.get('renderScale')); break;
      case 'clouds': this.renderer.cloudsEnabled = S.get('clouds'); break;
      case 'bobbing': p.bobbing = S.get('bobbing'); break;
      case 'binds': p.binds = S.get('binds'); this.buildControlsHelp(); break;
      case 'volume': this.sound.updateVolume(); break;
      case 'renderDistance':
        this.renderer.setRenderDistance(S.get('renderDistance'));
        for (const w of Object.values(this.worlds)) w.renderDistance = S.get('renderDistance');
        break;
      case 'smoothLighting':
        for (const w of Object.values(this.worlds)) { w.meshOptions.smoothLighting = S.get('smoothLighting'); w.remeshAll(); }
        break;
      case 'lang':
        setLanguage(S.get('lang')); applyDOM(); this.buildControlsHelp(); this.ui.updateHotbar(this.inventory); this.ui._lastHUD = '';
        break;
    }
  }

  buildControlsHelp() {
    const b = this.settings.get('binds');
    const rows = [
      [`${keyLabel(b.forward)} ${keyLabel(b.left)} ${keyLabel(b.back)} ${keyLabel(b.right)}`, t('ctl.move')],
      [keyLabel(b.jump), t('key.jump')], [keyLabel(b.sneak), t('key.sneak')], [keyLabel(b.sprint), t('key.sprint')],
      [t('ctl.mouseL'), t('ctl.mouseLd')], [t('ctl.mouseR'), t('ctl.mouseRd')], [t('ctl.wheel'), t('ctl.wheeld')],
      [keyLabel(b.inventory), t('key.inventory')], [keyLabel(b.drop), t('key.drop')], [`${keyLabel(b.chat)} / ${keyLabel(b.command)}`, `${t('key.chat')} / ${t('key.command')}`],
      [keyLabel(b.toggleMode), t('key.toggleMode')], [keyLabel(b.debug), t('key.debug')], [t('ctl.esc'), t('ctl.escd')],
    ];
    const dl = $('#controls-list');
    dl.innerHTML = '';
    for (const [k, v] of rows) { const dt = document.createElement('dt'); dt.textContent = k; const dd = document.createElement('dd'); dd.textContent = v; dl.append(dt, dd); }
  }

  // ------------------------------------------------------------------ MENU / ESTADOS
  async bindMenu() {
    await this.storage.open();
    const saved = await this.storage.getMeta('state');
    const cont = $('#btn-continue');
    if (saved) {
      cont.hidden = false;
      cont.querySelector('.sub').textContent = `seed ${saved.seedText ?? saved.seed}`;
    }
    $('#btn-new').addEventListener('click', async () => {
      const seedText = $('#seed').value.trim() || String(Math.floor(Math.random() * 1e9));
      const mode = document.querySelector('input[name=mode]:checked').value;
      await this.storage.clearAll();
      this.startWorld({ seed: seedFromString(seedText), seedText, mode, fresh: true });
    });
    cont.addEventListener('click', async () => this.startWorld(await this.storage.getMeta('state')));
    $('#btn-import').addEventListener('click', () => $('#import-file').click());
    $('#import-file').addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try { const meta = await importWorld(this.storage, f); this.ui.message(t('msg.imported')); this.startWorld(meta); }
      catch (err) { console.warn(err); this.ui.message(t('msg.importFail')); }
      e.target.value = '';
    });
    for (const id of ['#btn-options', '#btn-pause-options']) $(id).addEventListener('click', () => { this.prevOverlay = this.state === 'paused' ? '#pause' : '#menu'; this.showOverlay(null); this.options.open(); });
    this.options.onClose = () => this.showOverlay(this.prevOverlay || '#menu');
    $('#btn-resume').addEventListener('click', () => this.lock());
    $('#btn-export').addEventListener('click', () => this.exportToFile());
    $('#btn-save-quit').addEventListener('click', async () => { await this.saveAll(); location.reload(); });
    $('#btn-respawn').addEventListener('click', () => this.respawn());
    $('#click-to-play').addEventListener('click', () => this.lock());
    this.player.controls.addEventListener('unlock', () => this.onUnlock());
    this.player.controls.addEventListener('lock', () => this.onLock());
    document.addEventListener('pointerlockerror', () => { if (this.state === 'playing' || this.state === 'ready') this.showOverlay('#click-to-play'); });
  }

  showOverlay(sel) {
    for (const s of ['#menu', '#pause', '#death', '#loading', '#click-to-play']) $(s).hidden = s !== sel;
  }

  async startWorld(meta) {
    this.state = 'loading';
    $('#loading-text').textContent = t('loading.world');
    this.showOverlay('#loading');
    this.seed = meta.seed; this.seedText = meta.seedText ?? String(meta.seed);
    this.time = meta.time ?? 1000;
    this.renderer.setRenderDistance(this.settings.get('renderDistance'));
    await this.switchWorld(meta.dimension || 'overworld');
    if (meta.fresh) {
      const sp = this.world.generator.findSpawn();
      this.world.ensureChunkSync(Math.floor(sp.x / 16), Math.floor(sp.z / 16));
      const y = this.world.surfaceY(sp.x, sp.z) + 1;
      this.player.spawnPoint.set(sp.x, y, sp.z);
      this.player.teleport(sp.x, y, sp.z);
      this.player.setMode(meta.mode);
      this.inventory.clear();
      if (meta.mode === 'creative') {
        [B.GRASS, B.STONE_BRICKS, B.OAK_DOOR, B.GLASS, B.TORCH, B.GLOWSTONE, B.OBSIDIAN, I.FLINT_AND_STEEL, I.WATER_BUCKET].forEach((id, i) => { this.inventory.slots[i] = { id, count: ITEMS[id].maxStack, dmg: 0 }; });
        this.inventory.changed();
      }
      this.ui.message(t('msg.welcome'), 6000);
    } else {
      this.player.load(meta.player);
      this.inventory.load(meta.inventory);
    }
    this.ui.updateHotbar(this.inventory);
  }

  async switchWorld(dim) {
    if (this.world) { await this.world.save(); this.renderer.scene.remove(this.world.group); }
    this.entities.clear();
    this.dimension = dim;
    if (!this.worlds[dim]) {
      const w = new World({ dimension: dim, seed: this.seed, storage: this.storage, materials: this.renderer.materials, renderDistance: this.settings.get('renderDistance') });
      w.meshOptions.smoothLighting = this.settings.get('smoothLighting');
      await w.init();
      w.onBlockChange = (...a) => this.onBlockChange(w, ...a);
      this.worlds[dim] = w;
    }
    this.world = this.worlds[dim];
    this.renderer.scene.add(this.world.group);
  }

  loadingDone() {
    const p = this.player.pos;
    const cx = Math.floor(p.x / 16), cz = Math.floor(p.z / 16);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const c = this.world.getChunk(cx + dx, cz + dz);
      if (!c || !c.meshes) return false;
    }
    return true;
  }

  lock() { try { const r = this.player.controls.lock(); if (r && r.catch) r.catch(() => this.showOverlay('#click-to-play')); } catch (e) { this.showOverlay('#click-to-play'); } }

  onLock() {
    if (['paused', 'ready', 'playing'].includes(this.state)) { this.state = 'playing'; this.showOverlay(null); }
  }

  onUnlock() {
    this.mouse.left = this.mouse.right = false;
    this.player.keys.clear();
    if (this.state === 'playing' && !this.ui.isOpen()) {
      this.state = 'paused';
      this.showOverlay('#pause');
      this.saveAll();
    }
  }

  openScreen(fn) {
    this.state = 'screen';
    this.breaking = null;
    fn();
    this.player.controls.unlock();
  }

  resumeFromScreen() {
    if (this.state !== 'screen') return;
    this.state = 'playing';
    this.lock();
  }

  deathText(source) {
    if (source && source.startsWith('mob:')) return t('death.mob', { mob: mobName(source.slice(4)) });
    return t('death.' + source);
  }

  onDeath(source) {
    this.state = 'dead';
    $('#death-cause').textContent = t('death.cause', { c: this.deathText(source) });
    for (const s of [...this.inventory.slots, ...this.inventory.armor]) if (s) this.entities.dropItem(s, this.player.pos.clone().add(new THREE.Vector3(0, 1, 0)));
    this.inventory.clear();
    this.player.controls.unlock();
    this.showOverlay('#death');
  }

  async respawn() {
    if (this.dimension !== 'overworld') await this.switchWorld('overworld');
    this.player.respawn();
    this.world.ensureChunkSync(Math.floor(this.player.pos.x / 16), Math.floor(this.player.pos.z / 16));
    this.state = 'loading';
    $('#loading-text').textContent = t('loading.world');
    this.showOverlay('#loading');
  }

  async saveAll() {
    if (!this.world) return;
    for (const w of Object.values(this.worlds)) await w.save();
    await this.storage.setMeta('state', {
      version: 2, seed: this.seed, seedText: this.seedText, time: this.time, dimension: this.dimension,
      player: this.player.serialize(), inventory: this.inventory.serialize(),
    });
  }

  async exportToFile() {
    try {
      await this.saveAll();
      const blob = await exportWorld(this.storage);
      const name = `webcraft-${String(this.seedText).replace(/[^\w-]+/g, '_')}.wcworld`;
      if (await deliverFile(blob, name)) this.ui.message(t('msg.exported', { f: name }));
    } catch (e) { console.warn(e); this.ui.message(t('msg.exportFail')); }
  }

  // ------------------------------------------------------------------ CHAT / COMANDOS
  openChat(prefill = '') {
    this.state = 'chat';
    this.ui.chatEl.hidden = false;
    this.ui.messagesEl.hidden = true;
    const inp = this.ui.chatInput;
    inp.value = prefill; inp.placeholder = t('chat.placeholder');
    this.player.controls.unlock();
    setTimeout(() => { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }, 0);
    this.updateSuggestions();
  }

  closeChat() {
    this.ui.chatEl.hidden = true;
    this.ui.messagesEl.hidden = false;
    this.ui.chatInput.blur();
    this.state = 'playing';
    this.lock();
  }

  updateSuggestions() {
    const v = this.ui.chatInput.value;
    const list = v.startsWith('/') ? this.commands.complete(v) : [];
    this.suggestions = list;
    this.ui.chatSuggest.innerHTML = '';
    for (const s of list.slice(0, 8)) { const d = document.createElement('div'); d.textContent = s; this.ui.chatSuggest.appendChild(d); }
  }

  submitChat() {
    const text = this.ui.chatInput.value.trim();
    if (text) {
      this.chatHistory.push(text); this.chatHistoryPos = this.chatHistory.length;
      if (text.startsWith('/')) {
        this.ui.chatLine(text, 'cmd');
        const r = this.commands.run(text);
        if (r.ok) this.ui.chatLine(r.ok, 'ok'); else this.ui.chatLine(r.err, 'err');
      } else this.ui.chatLine('<Steve> ' + text);
    }
    this.closeChat();
  }

  // ------------------------------------------------------------------ ENTRADA
  bindInput() {
    const inp = this.ui.chatInput;
    inp.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); this.submitChat(); }
      else if (e.key === 'Escape') { e.preventDefault(); this.closeChat(); }
      else if (e.key === 'Tab') { e.preventDefault(); if (this.suggestions && this.suggestions.length) { inp.value = this.suggestions[0] + (this.suggestions.length === 1 ? ' ' : ''); this.updateSuggestions(); } }
      else if (e.key === 'ArrowUp' && this.chatHistory.length) { e.preventDefault(); this.chatHistoryPos = Math.max(0, this.chatHistoryPos - 1); inp.value = this.chatHistory[this.chatHistoryPos]; }
      else if (e.key === 'ArrowDown' && this.chatHistory.length) { e.preventDefault(); this.chatHistoryPos = Math.min(this.chatHistory.length, this.chatHistoryPos + 1); inp.value = this.chatHistory[this.chatHistoryPos] || ''; }
    });
    inp.addEventListener('input', () => this.updateSuggestions());

    window.addEventListener('mousedown', (e) => {
      if (this.state !== 'playing' || !this.player.controls.isLocked) return;
      if (e.button === 0) { this.mouse.left = true; this.attack(); }
      if (e.button === 2) { this.mouse.right = true; this.use(); this.useCooldown = 0.25; }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) { this.mouse.left = false; this.breaking = null; }
      if (e.button === 2) this.mouse.right = false;
    });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('wheel', (e) => {
      if (this.state !== 'playing') return;
      this.inventory.selected = (this.inventory.selected + Math.sign(e.deltaY) + 9) % 9;
      this.inventory.changed();
      this.ui.showItemName(this.inventory);
    }, { passive: true });
    window.addEventListener('keydown', (e) => {
      const b = this.settings.get('binds');
      if (this.options.isOpen()) { if (e.code === 'Escape') this.options.close(); return; }
      if (e.code === b.debug) { e.preventDefault(); this.showDebug = !this.showDebug; if (!this.showDebug) this.ui.setDebug(null); return; }
      if (this.state === 'screen' && (e.code === b.inventory || e.code === 'Escape')) { e.preventDefault(); this.ui.close(); return; }
      if (this.state !== 'playing') return;
      if (e.code.startsWith('Digit')) {
        const n = parseInt(e.code.slice(5), 10);
        if (n >= 1 && n <= 9) { this.inventory.selected = n - 1; this.inventory.changed(); this.ui.showItemName(this.inventory); }
      }
      if (e.code === b.inventory) { e.preventDefault(); this.openScreen(() => this.ui.openInventory(this.inventory, this.player.mode, this.allItems)); }
      else if (e.code === b.drop) this.dropHeld(e.ctrlKey);
      else if (e.code === b.chat) { e.preventDefault(); this.openChat(''); }
      else if (e.code === b.command) { e.preventDefault(); this.openChat('/'); }
      else if (e.code === b.toggleMode) {
        const m = this.player.mode === 'creative' ? 'survival' : 'creative';
        this.player.setMode(m);
        this.ui.message(t(m === 'creative' ? 'msg.creative' : 'msg.survival'));
      } else if (e.code === b.fly && this.player.mode === 'creative') { this.player.flying = !this.player.flying; this.player.vel.y = 0; }
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.saveAll(); });
    window.addEventListener('beforeunload', () => { this.saveAll(); });
  }

  // ------------------------------------------------------------------ INTERAÇÃO
  reach() { return this.player.mode === 'creative' ? 6 : 4.5; }

  target(liquids = false) {
    const o = this.player.eyePosition(this.tmpV);
    const d = this.player.lookDirection(this.tmpD);
    const hit = raycastVoxels(this.world, o, d, this.reach(), { liquids });
    if (hit) hit.point = o.clone().addScaledVector(d, hit.dist);
    return hit;
  }

  attack() {
    const o = this.player.eyePosition(new THREE.Vector3());
    const d = this.player.lookDirection(new THREE.Vector3());
    const blockHit = this.target();
    const mobHit = this.entities.raycastMobs(o, d, this.player.mode === 'creative' ? 5 : 3.5);
    if (mobHit && (!blockHit || mobHit.dist < blockHit.dist)) {
      if (this.attackCooldown > 0) return;
      this.attackCooldown = 0.35;
      const held = this.inventory.held;
      const it = held && ITEMS[held.id];
      let dmg = it && it.damage ? it.damage : 1;
      if (this.player.vel.y < -1 && !this.player.onGround) dmg *= 1.5; // golpe crítico caindo
      this.sound.play('attack');
      if (mobHit.mob.hurt(dmg, { isPlayer: true, pos: this.player.pos }, this.player.pos) && this.player.mode === 'survival') {
        this.player.exhaustion += 0.1;
        if (it && it.durability && it.tool) this.inventory.damageHeld(it.tool.type === 'sword' ? 1 : 2);
      }
      return;
    }
    if (blockHit && blockHit.id === B.FIRE) { this.world.setBlock(blockHit.x, blockHit.y, blockHit.z, B.AIR, 0, { cause: 'player' }); return; }
    if (blockHit && this.player.mode === 'creative') { this.breakBlock(blockHit); this.creativeBreakDelay = 0.25; }
  }

  breakBlock(hit) {
    const { x, y, z, id } = hit;
    const w = this.world;
    const d = BLOCKS[id];
    if (id === B.BEDROCK && this.player.mode !== 'creative') return;
    const meta = w.getMeta(x, y, z);
    const ent = w.getBlockEntity(x, y, z);
    w.setBlock(x, y, z, B.AIR, 0, { cause: 'player' });
    this.sound.block('break', d.sound, { x: x + 0.5, y: y + 0.5, z: z + 0.5 });
    if (this.player.mode === 'survival') {
      const held = this.inventory.held ? this.inventory.held.id : 0;
      const center = new THREE.Vector3(x + 0.5, y + 0.4, z + 0.5);
      const dropMeta = (d.shape === 'door' || d.shape === 'bed') ? 0 : meta; // a cama/porta sempre dropa 1
      for (const [did, n] of blockDrops(id, held, Math.random, dropMeta)) this.entities.dropItem({ id: did, count: n, dmg: 0 }, center);
      if (ent) this.dropContainer(ent, center);
      const it = ITEMS[held];
      if (it && it.durability && it.tool && d.hardness > 0) this.inventory.damageHeld(it.tool.type === 'sword' ? 2 : 1);
      this.player.exhaustion += 0.005;
    }
  }

  dropContainer(ent, at) {
    const stacks = ent.type === 'chest' ? ent.slots : [ent.input, ent.fuel, ent.output];
    for (const s of stacks) if (s) this.entities.dropItem(s, at);
  }

  partnerOf(id, x, y, z, meta) {
    const d = BLOCKS[id];
    if (d.shape === 'door') return [x, (meta & 8) ? y - 1 : y + 1, z];
    if (d.shape === 'bed') { const [dx, dz] = DIR[meta & 3]; const s = (meta & 8) ? -1 : 1; return [x + dx * s, y, z + dz * s]; }
    return null;
  }

  onBlockChange(world, x, y, z, oldId, newId, cause, opts = {}, oldMeta = 0) {
    // moldura quebrada apaga o portal
    for (const P of Object.values(PORTALS)) {
      if (oldId === P.frame && newId !== P.frame) {
        for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]])
          if (world.getBlock(x + dx, y + dy, z + dz) === P.block) breakPortalAt(world, x + dx, y + dy, z + dz, P.block);
      }
    }
    // porta e cama ocupam 2 blocos: quebrar um quebra o outro
    const od = BLOCKS[oldId];
    if ((od.shape === 'door' || od.shape === 'bed') && newId !== oldId && cause !== 'partner') {
      const pp = this.partnerOf(oldId, x, y, z, oldMeta);
      if (pp && world.getBlock(...pp) === oldId) world.setBlock(...pp, B.AIR, 0, { cause: 'partner' });
    }
    if (world !== this.world) return;
    const at = new THREE.Vector3(x + 0.5, y + 0.4, z + 0.5);
    if (this.player.mode === 'survival') {
      if (cause === 'support') for (const [did, n] of blockDrops(oldId, 0)) this.entities.dropItem({ id: did, count: n, dmg: 0 }, at);
      if (cause === 'decay') for (const [did, n] of blockDrops(opts.dropOf ?? oldId, 0)) this.entities.dropItem({ id: did, count: n, dmg: 0 }, at);
    }
    if (newId === B.FIRE && oldId !== B.FIRE && Math.random() < 0.5) this.sound.play('fire', at);
  }

  facingMeta() {
    const d = this.player.lookDirection(new THREE.Vector3());
    if (Math.abs(d.z) > Math.abs(d.x)) return d.z > 0 ? 0 : 2;
    return d.x < 0 ? 1 : 3;
  }

  isNight() { return this.time > 12500 && this.time < 23500; }

  sleep(hit) {
    const p = this.player;
    if (this.dimension === 'nether') { this.ui.message(t('msg.bedExplode')); this.explode(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, 4); return; }
    p.spawnPoint.set(hit.x + 0.5, hit.y + 1, hit.z + 0.5);
    if (!this.isNight()) { this.ui.message(t('msg.spawnSet') + ' — ' + t('msg.sleepDay')); return; }
    if (this.entities.mobs.some((m) => m.kind === 'hostile' && !m.dead && m.distanceTo(p.pos) < 8)) { this.ui.message(t('msg.sleepMonsters')); return; }
    this.ui.sleepEl.classList.add('on');
    this.state = 'sleeping';
    setTimeout(() => {
      this.time = 0; // amanhecer
      this.ui.sleepEl.classList.remove('on');
      this.state = 'playing';
      this.ui.message(t('msg.goodMorning') + ' ' + t('msg.spawnSet'));
    }, 1600);
  }

  explode(x, y, z, power) {
    const w = this.world;
    const r = Math.ceil(power);
    for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy + dz * dz > power * power * (0.7 + Math.random() * 0.3)) continue;
      const id = w.getBlock(x + dx, y + dy, z + dz);
      if (!id || id === B.BEDROCK || id === B.OBSIDIAN || BLOCKS[id].hardness < 0) continue;
      w.setBlock(x + dx, y + dy, z + dz, B.AIR, 0, { cause: 'explosion' });
      if (Math.random() < 0.08) w.nature.ignite(x + dx, y + dy, z + dz);
    }
    this.sound.play('explode', { x, y, z });
    const hurt = (pos, fn) => { const d = Math.hypot(pos.x - x, pos.y - y, pos.z - z); if (d < power * 2) fn((1 - d / (power * 2)) * 18, d); };
    hurt(this.player.pos, (dmg) => { this.player.damage(Math.round(dmg), 'explosion', true); this.player.knockback(x, z, dmg); });
    for (const m of this.entities.mobs) hurt(m.pos, (dmg) => m.hurt(dmg, null, { x, z }));
  }

  use() {
    const w = this.world;
    const held = this.inventory.held;
    const it = held ? ITEMS[held.id] : null;
    const survival = this.player.mode === 'survival';
    const sneaking = this.player.isDown('sneak');

    // balde vazio pega líquido
    if (held && held.id === I.BUCKET) {
      const h = this.target(true);
      if (h && isLiquid(h.id)) {
        w.setBlock(h.x, h.y, h.z, B.AIR, 0, { cause: 'player' });
        const full = h.id === B.WATER ? I.WATER_BUCKET : I.LAVA_BUCKET;
        this.sound.play('bucket', this.player.pos);
        if (survival) { this.inventory.consumeHeld(1); if (this.inventory.add(full, 1) > 0) this.dropFromPlayer({ id: full, count: 1, dmg: 0 }); }
        else this.inventory.add(full, 1);
      }
      return;
    }

    const hit = this.target();

    // blocos interativos (bancada, fornalha, baú, porta, cama)
    if (hit && BLOCKS[hit.id].interact && !sneaking) {
      const kind = BLOCKS[hit.id].interact;
      if (kind === 'crafting') return this.openScreen(() => this.ui.openCraftingTable(this.inventory));
      if (kind === 'door') {
        const m = w.getMeta(hit.x, hit.y, hit.z);
        const by = (m & 8) ? hit.y - 1 : hit.y;
        const bm = w.getMeta(hit.x, by, hit.z) ^ 4;
        w.setBlock(hit.x, by, hit.z, hit.id, bm, { cause: 'door', silent: true });
        w.setBlock(hit.x, by + 1, hit.z, hit.id, bm | 8, { cause: 'door', silent: true });
        this.sound.play('door', { x: hit.x + 0.5, y: by + 1, z: hit.z + 0.5 });
        return;
      }
      if (kind === 'bed') return this.sleep(hit);
      let ent = w.getBlockEntity(hit.x, hit.y, hit.z);
      if (!ent) { ent = kind === 'furnace' ? createFurnaceState() : createChestState(); w.setBlockEntity(hit.x, hit.y, hit.z, ent); }
      const chunk = w.chunkAt(hit.x, hit.z);
      this.openScreen(() => {
        if (kind === 'furnace') { this.ui.openFurnace(this.inventory, ent); this.openFurnaceState = ent; }
        else this.ui.openChest(this.inventory, ent);
        this.ui.closeHooks.push(() => { chunk.dirtySave = true; chunk.modified = true; this.openFurnaceState = null; });
      });
      return;
    }

    // vestir armadura direto da mão
    if (it && it.armor) {
      const k = it.armor.slot;
      const prev = this.inventory.armor[k];
      this.inventory.armor[k] = { ...held, count: 1 };
      this.inventory.slots[this.inventory.selected] = prev;
      this.inventory.changed();
      this.sound.block('place', 'metal', null);
      return;
    }

    // comer
    if (it && it.food && (this.player.hunger < 20 || this.player.mode === 'creative' || it.heal)) {
      this.player.eat(it.food);
      if (it.heal) this.player.health = Math.min(this.player.maxHealth, this.player.health + it.heal);
      if (survival) this.inventory.consumeHeld(1);
      this.sound.play('eat');
      setTimeout(() => this.sound.play('burp'), 450);
      return;
    }

    if (!hit || !held) return;
    let px = hit.x + hit.nx, py = hit.y + hit.ny, pz = hit.z + hit.nz;
    if (isReplaceable(hit.id) && !isLiquid(hit.id)) { px = hit.x; py = hit.y; pz = hit.z; }
    const fracY = hit.point ? hit.point.y - hit.y : 0;
    const upperHalf = hit.ny === -1 || (hit.ny === 0 && fracY > 0.5);

    // isqueiro: abre portal do Nether ou acende fogo
    if (held.id === I.FLINT_AND_STEEL) {
      if (w.getBlock(px, py, pz) !== B.AIR) return;
      this.sound.play('ignite', { x: px, y: py, z: pz });
      if (PORTALS.nether.links[this.dimension] && tryIgnitePortal(w, px, py, pz, 'nether')) { this.ui.message(t('msg.portalOpen')); this.sound.play('portal', this.player.pos); }
      else w.nature.ignite(px, py, pz);
      if (survival) this.inventory.damageHeld(1);
      return;
    }

    // baldes cheios (água dentro de moldura de glowstone abre o Aether)
    if (held.id === I.WATER_BUCKET || held.id === I.LAVA_BUCKET) {
      const cur = w.getBlock(px, py, pz);
      if (!isReplaceable(cur)) return;
      const liquid = held.id === I.WATER_BUCKET ? B.WATER : B.LAVA;
      let used = true;
      if (liquid === B.WATER && PORTALS.aether.links[this.dimension] && tryIgnitePortal(w, px, py, pz, 'aether')) { this.ui.message(t('msg.portalOpen')); this.sound.play('portal', this.player.pos); }
      else if (liquid === B.WATER && this.dimension === 'nether') { this.ui.message(t('msg.waterNether'), 1500); this.sound.play('fire', this.player.pos); }
      else { w.setBlock(px, py, pz, liquid, 0, { cause: 'player' }); this.sound.play('bucket', this.player.pos); }
      if (survival && used) { this.inventory.slots[this.inventory.selected] = { id: I.BUCKET, count: 1, dmg: 0 }; this.inventory.changed(); }
      return;
    }

    if (!it.isBlock) return;
    const bid = it.block;
    const bd = BLOCKS[bid];

    // laje sobre laje igual → bloco inteiro
    if (bd.shape === 'slab') {
      const tm = w.getMeta(hit.x, hit.y, hit.z);
      if (hit.id === bid && ((hit.ny === 1 && !(tm & 1)) || (hit.ny === -1 && (tm & 1)))) {
        w.setBlock(hit.x, hit.y, hit.z, bd.full, 0, { cause: 'player' });
        this.afterPlace(bd, hit.x, hit.y, hit.z, survival);
        return;
      }
      if (w.getBlock(px, py, pz) === bid) {
        w.setBlock(px, py, pz, bd.full, 0, { cause: 'player' });
        this.afterPlace(bd, px, py, pz, survival);
        return;
      }
    }

    const cur = w.getBlock(px, py, pz);
    if (!isReplaceable(cur) || py < 0 || py >= 127) return;
    if (bd.needsSupport) {
      const below = w.getBlock(px, py - 1, pz);
      if (!below || !BLOCKS[below].solid || BLOCKS[below].shape !== 'cube') return;
      if (bd.shape === 'cross' && !(BLOCKS[below].sound === 'grass' || below === B.DIRT || below === B.AETHER_DIRT || (bid === B.DEAD_BUSH && below === B.SAND))) return;
      if (bid === B.CACTUS && below !== B.SAND && below !== B.CACTUS) return;
    }
    let meta = 0;
    const f = this.facingMeta();
    if (bd.shape === 'stairs') meta = f | (upperHalf ? 4 : 0);
    if (bd.shape === 'slab') meta = upperHalf ? 1 : 0;
    if (bd.interact === 'furnace' || bd.interact === 'chest') meta = (f + 2) % 4;
    if (bd.leaves) meta = 1; // colocada pelo jogador: não decai
    // porta e cama precisam de 2 espaços
    let second = null;
    if (bd.shape === 'door') {
      if (!isReplaceable(w.getBlock(px, py + 1, pz)) || !BLOCKS[w.getBlock(px, py - 1, pz)].solid) return;
      meta = f; second = [px, py + 1, pz, f | 8];
    }
    if (bd.shape === 'bed') {
      const [dx, dz] = DIR[f];
      if (!isReplaceable(w.getBlock(px + dx, py, pz + dz)) || !BLOCKS[w.getBlock(px, py - 1, pz)].solid || !BLOCKS[w.getBlock(px + dx, py - 1, pz + dz)].solid) return;
      meta = f; second = [px + dx, py, pz + dz, f | 8];
    }
    if (!this.spaceFree(bid, meta, px, py, pz) || (second && !this.spaceFree(bid, second[3], second[0], second[1], second[2]))) return;
    w.setBlock(px, py, pz, bid, meta, { cause: 'player' });
    if (second) w.setBlock(second[0], second[1], second[2], bid, second[3], { cause: 'player' });
    if (bd.interact === 'furnace') w.setBlockEntity(px, py, pz, createFurnaceState());
    if (bd.interact === 'chest') w.setBlockEntity(px, py, pz, createChestState());
    this.afterPlace(bd, px, py, pz, survival);
  }

  afterPlace(bd, x, y, z, survival) {
    this.sound.block('place', bd.sound, { x: x + 0.5, y: y + 0.5, z: z + 0.5 });
    if (survival) this.inventory.consumeHeld(1);
  }

  // não colocar sólido dentro do jogador ou de um mob
  spaceFree(bid, meta, px, py, pz) {
    const boxes = collisionBoxes(bid, meta);
    if (!boxes) return true;
    const hw = this.player.width / 2, p = this.player.pos;
    for (const b of boxes) {
      const hits = (min, max) => px + b[0] < max.x && px + b[3] > min.x && py + b[1] < max.y && py + b[4] > min.y && pz + b[2] < max.z && pz + b[5] > min.z;
      if (hits({ x: p.x - hw, y: p.y, z: p.z - hw }, { x: p.x + hw, y: p.y + this.player.height, z: p.z + hw })) return false;
      for (const m of this.entities.mobs) { const a = m.aabb(); if (!m.dead && hits(a.min, a.max)) return false; }
    }
    return true;
  }

  dropHeld(all) {
    const s = this.inventory.held;
    if (!s) return;
    const n = all ? s.count : 1;
    this.dropFromPlayer({ id: s.id, count: n, dmg: s.dmg });
    this.inventory.consumeHeld(n);
  }

  dropFromPlayer(stack) {
    const d = this.player.lookDirection(new THREE.Vector3());
    const at = this.player.eyePosition(new THREE.Vector3()).addScaledVector(d, 0.6);
    at.y -= 0.3;
    this.entities.dropItem(stack, at, d.multiplyScalar(5).add(new THREE.Vector3(0, 2, 0)));
  }

  // ------------------------------------------------------------------ DIMENSÕES
  async travel(type) {
    const P = PORTALS[type];
    const to = P.links[this.dimension];
    if (!to) { this.ui.message(t('msg.wrongDim')); this.portalLock = true; return; }
    const k = P.scale[this.dimension];
    await this.changeDimension(to, async () => {
      const pos = findOrCreatePortal(this.world, this.player.pos.x * k, this.player.pos.z * k, type);
      this.player.teleport(pos.x, pos.y, pos.z);
    });
    this.portalLock = true;
  }

  async changeDimension(to, place) {
    this.state = 'loading';
    this.showOverlay('#loading');
    $('#loading-text').textContent = t('loading.' + to);
    this.sound.play('travel');
    await this.switchWorld(to);
    await place();
    this.portalTimer = 0;
  }

  async fallFromAether() {
    const x = this.player.pos.x, z = this.player.pos.z;
    await this.changeDimension('overworld', async () => {
      this.world.ensureChunkSync(Math.floor(x / 16), Math.floor(z / 16));
      this.player.teleport(x, this.world.surfaceY(x, z) + 1.2, z);
    });
    this.ui.message(t('msg.fellFromAether'));
  }

  // ------------------------------------------------------------------ LOOP
  loop(now) {
    requestAnimationFrame((ts) => this.loop(ts));
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.frames++;
    if (now - this.fpsTime > 1000) { this.fps = this.frames; this.frames = 0; this.fpsTime = now; }

    if (!this.world || this.state === 'menu') { this.renderer.render(); return; }
    const p = this.player;

    if (this.state === 'loading') {
      this.world.update(p.pos.x, p.pos.z, 40);
      this.camSync();
      const rd = this.settings.get('renderDistance');
      $('#loading-bar').style.width = Math.min(100, this.world.chunks.size / ((rd * 2 + 3) ** 2 * 0.8) * 100) + '%';
      if (this.loadingDone()) {
        while (p.pos.y < 126 && (BLOCKS[this.world.getBlock(p.pos.x, p.pos.y, p.pos.z)].solid || BLOCKS[this.world.getBlock(p.pos.x, p.pos.y + 1, p.pos.z)].solid)) p.pos.y += 1;
        this.state = 'ready';
        if (this.player.controls.isLocked) { this.state = 'playing'; this.showOverlay(null); } else this.showOverlay('#click-to-play');
      }
      this.renderer.updateSky(this.time, this.dimension);
      this.renderer.render();
      return;
    }

    const running = ['playing', 'screen', 'chat', 'sleeping'].includes(this.state);
    if (running) {
      const c = this.world.chunkAt(p.pos.x, p.pos.z);
      if (c && c.meshes) p.update(dt, this.world); else this.camSync();
      this.tickAcc += dt;
      while (this.tickAcc >= TICK) { this.tickAcc -= TICK; this.gameTick(); }
      this.attackCooldown -= dt;
      if (this.state === 'playing') this.updateInteraction(dt);
      this.updatePortal(dt);
      if (this.dimension === 'aether' && p.pos.y < -8 && !p.dead) this.fallFromAether();
    } else this.camSync();

    this.world.update(p.pos.x, p.pos.z, 8);
    const daylight = this.renderer.updateSky(this.time, this.dimension, p.headInWater);
    if (this.state !== 'paused' && this.state !== 'dead') {
      this.entities.update(dt, { world: this.world, player: p, daylight, ambient: this.dimension === 'nether' ? 0.55 : 0, dimension: this.dimension });
    }
    const dir = p.lookDirection(this.tmpD);
    this.sound.setListener(p.pos, dir.x, dir.z);
    this.ui.updateBars(p);
    this.ui.portalEl.style.opacity = p.portalBlock ? Math.min(0.85, this.portalTimer / 3) : 0;
    this.ui.portalEl.classList.toggle('aether', p.portalBlock === B.AETHER_PORTAL);
    this.ui.waterEl.style.opacity = p.headInWater ? 1 : 0;
    this.ui.burnEl.style.opacity = p.burning > 0 && p.mode === 'survival' ? 1 : 0;

    this.saveTimer += dt;
    if (this.saveTimer > 15) { this.saveTimer = 0; this.saveAll(); }
    if (this.showDebug) this.updateDebug();
    this.renderer.render();
  }

  camSync() {
    const p = this.player;
    this.renderer.camera.position.set(p.pos.x, p.pos.y + p.eye, p.pos.z);
  }

  gameTick() {
    if (this.dimension !== 'nether') this.time = (this.time + 1) % DAY_LENGTH;
    const p = this.player;
    this.world.fluids.tick();
    this.world.nature.tick(Math.floor(p.pos.x / 16), Math.floor(p.pos.z / 16), Math.min(4, this.settings.get('renderDistance')));
    for (const { e, chunk } of this.world.allBlockEntities()) {
      if (e.type !== 'furnace') continue;
      if (tickFurnace(e)) {
        chunk.dirtySave = true;
        if (this.openFurnaceState === e && this.ui.screen === 'furnace') this.ui.refresh();
      }
    }
  }

  updateInteraction(dt) {
    const hit = this.target();
    const p = this.player;
    this.useCooldown -= dt;
    if (this.mouse.right && this.useCooldown <= 0) { this.use(); this.useCooldown = 0.22; }
    if (this.creativeBreakDelay > 0) this.creativeBreakDelay -= dt;

    if (this.mouse.left && hit) {
      if (p.mode === 'creative') {
        if (this.creativeBreakDelay <= 0) { this.breakBlock(hit); this.creativeBreakDelay = 0.22; }
        this.renderer.setSelection(hit, 0);
        return;
      }
      const b = this.breaking;
      if (!b || b.x !== hit.x || b.y !== hit.y || b.z !== hit.z) this.breaking = { x: hit.x, y: hit.y, z: hit.z, progress: 0 };
      const held = this.inventory.held ? this.inventory.held.id : 0;
      this.breaking.progress += dt / breakTime(hit.id, held);
      this.digSoundTimer -= dt;
      if (this.digSoundTimer <= 0) { this.digSoundTimer = 0.25; this.sound.block('hit', BLOCKS[hit.id].sound, { x: hit.x + 0.5, y: hit.y + 0.5, z: hit.z + 0.5 }); }
      if (this.breaking.progress >= 1) { this.breakBlock(hit); this.breaking = null; }
      this.renderer.setSelection(hit, this.breaking ? this.breaking.progress : 0);
    } else {
      this.breaking = null;
      this.renderer.setSelection(hit, 0);
    }
  }

  updatePortal(dt) {
    const p = this.player;
    if (!p.portalBlock) { this.portalLock = false; this.portalTimer = 0; return; }
    if (this.portalLock || this.state !== 'playing') return;
    if (this.portalTimer === 0) this.sound.play('portal', p.pos);
    this.portalTimer += dt;
    if (this.portalTimer > (p.mode === 'creative' ? 1 : 3)) this.travel(portalTypeOf(p.portalBlock));
  }

  updateDebug() {
    const p = this.player.pos;
    const c = this.world.chunkAt(p.x, p.z);
    const biome = c ? biomeName(BIOMES[c.getBiome(Math.floor(p.x) & 15, Math.floor(p.z) & 15)].key) : '?';
    const L = this.world.getLight(p.x, p.y + 1, p.z);
    const cnt = this.entities.counts();
    const hours = Math.floor(((this.time / DAY_LENGTH) * 24 + 6) % 24);
    this.ui.setDebug([
      `WebCraft — ${this.fps} fps`,
      `XYZ: ${p.x.toFixed(1)} / ${p.y.toFixed(1)} / ${p.z.toFixed(1)}`,
      `Chunk: ${Math.floor(p.x / CHUNK_SIZE)}, ${Math.floor(p.z / CHUNK_SIZE)} · loaded ${this.world.chunks.size}`,
      `Dimension: ${this.dimension} · Biome: ${biome}`,
      `Light: sky ${L.sky} · block ${L.block} · ~${hours}h`,
      `Mesh: ${this.world.stats.lastMeshMs.toFixed(1)} ms · built ${this.world.stats.meshed}`,
      `Mobs: ${cnt.passive} passive · ${cnt.hostile} hostile/neutral · items ${this.entities.items.length}`,
      `Draw calls: ${this.renderer.renderer.info.render.calls} · tris ${this.renderer.renderer.info.render.triangles}`,
      `Armor: ${this.inventory.armorPoints()} · Seed: ${this.seedText} · ${this.player.mode}`,
    ].join('\n'));
  }
}

window.game = new Game();
