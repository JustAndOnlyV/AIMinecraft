// systems/Commands.js
// Interpretador de comandos estilo Minecraft. Cada comando recebe os argumentos já separados por espaço.
// Coordenadas aceitam "~" (relativo à posição atual): /tp ~ ~10 ~  → sobe 10 blocos.
import { ITEMS, ITEM_BY_KEY, maxStack } from './Items.js';
import { ANIMAL_TYPES } from '../entities/Animal.js';
import { HOSTILE_TYPES } from '../entities/Hostile.js';
import { t, mobName, modeName, itemName } from './i18n.js';

const MOB_ALIASES = { zombie_pigman: 'pigman', zombified_piglin: 'pigman' };
const TIMES = { day: 1000, noon: 6000, sunset: 12000, night: 13000, midnight: 18000, sunrise: 23000 };

export const COMMANDS = {
  help: { usage: '/help' },
  tp: { usage: '/tp <x> <y> <z>' },
  gamemode: { usage: '/gamemode <survival|creative>' },
  time: { usage: '/time set <day|night|noon|midnight|ticks>' },
  give: { usage: '/give <item> [amount]' },
  summon: { usage: '/summon <entity> [x y z]' },
  kill: { usage: '/kill <self|monster|passive|all>' },
  seed: { usage: '/seed' },
  clear: { usage: '/clear' },
  spawnpoint: { usage: '/spawnpoint' },
};

export class Commands {
  constructor(game) { this.game = game; }

  // Lista de sugestões para o autocompletar (Tab)
  complete(text) {
    const parts = text.slice(1).split(' ');
    if (parts.length === 1) return Object.keys(COMMANDS).filter((c) => c.startsWith(parts[0])).map((c) => '/' + c);
    const [cmd] = parts;
    const last = parts[parts.length - 1].toLowerCase();
    const prefix = '/' + parts.slice(0, -1).join(' ') + ' ';
    let pool = [];
    if (cmd === 'give' && parts.length === 2) pool = [...ITEM_BY_KEY.keys()].filter((k) => !ITEMS[ITEM_BY_KEY.get(k)].hidden);
    if (cmd === 'summon' && parts.length === 2) pool = [...Object.keys(ANIMAL_TYPES), ...Object.keys(HOSTILE_TYPES), 'zombie_pigman'];
    if (cmd === 'gamemode' && parts.length === 2) pool = ['survival', 'creative'];
    if (cmd === 'time' && parts.length === 2) pool = ['set'];
    if (cmd === 'time' && parts.length === 3) pool = Object.keys(TIMES);
    if (cmd === 'kill' && parts.length === 2) pool = ['self', 'monster', 'passive', 'all'];
    return pool.filter((k) => k.startsWith(last)).slice(0, 40).map((k) => prefix + k);
  }

  coord(arg, base) {
    if (arg === undefined) return NaN;
    if (arg.startsWith('~')) return base + (arg.length > 1 ? parseFloat(arg.slice(1)) : 0);
    return parseFloat(arg);
  }

  run(text) {
    const g = this.game, p = g.player;
    const parts = text.trim().replace(/^\//, '').split(/\s+/);
    const cmd = (parts.shift() || '').toLowerCase();
    const usage = () => ({ err: t('cmd.usage', { u: COMMANDS[cmd].usage }) });
    switch (cmd) {
      case 'help': return { ok: t('cmd.help') + '\n' + Object.values(COMMANDS).map((c) => c.usage).join('\n') };
      case 'tp': case 'teleport': {
        const [x, y, z] = [this.coord(parts[0], p.pos.x), this.coord(parts[1], p.pos.y), this.coord(parts[2], p.pos.z)];
        if ([x, y, z].some(Number.isNaN)) return usage();
        p.teleport(x, y, z);
        g.world.ensureChunkSync(Math.floor(x / 16), Math.floor(z / 16));
        return { ok: t('cmd.tp', { x: x.toFixed(1), y: y.toFixed(1), z: z.toFixed(1) }) };
      }
      case 'gamemode': case 'gm': {
        const m = { survival: 'survival', s: 'survival', 0: 'survival', creative: 'creative', c: 'creative', 1: 'creative' }[(parts[0] || '').toLowerCase()];
        if (!m) return usage();
        p.setMode(m);
        return { ok: t('cmd.gamemode', { m: modeName(m) }) };
      }
      case 'time': {
        if (parts[0] !== 'set' && parts[0] !== 'add') return usage();
        const v = parts[1];
        let ticks = TIMES[v] !== undefined ? TIMES[v] : parseInt(v, 10);
        if (Number.isNaN(ticks)) return usage();
        // nosso relógio: 0 = nascer do sol (o "1000/day" do Minecraft é logo depois)
        ticks = parts[0] === 'add' ? g.time + ticks : ticks;
        g.time = ((ticks % 24000) + 24000) % 24000;
        return { ok: t('cmd.time', { t: v }) };
      }
      case 'give': {
        if (!parts[0]) return usage();
        const key = parts[0].toLowerCase().replace(/^minecraft:/, '');
        const id = ITEM_BY_KEY.get(key) ?? (/^\d+$/.test(key) && ITEMS[+key] ? +key : undefined);
        if (id === undefined) return { err: t('cmd.noItem', { i: parts[0] }) };
        const n = Math.max(1, Math.min(64 * 36, parseInt(parts[1] || '1', 10) || 1));
        let left = g.inventory.add(id, n);
        while (left > 0) { const k = Math.min(left, maxStack(id)); g.dropFromPlayer({ id, count: k, dmg: 0 }); left -= k; }
        return { ok: t('cmd.give', { n, item: itemName(ITEMS[id]) }) };
      }
      case 'summon': {
        if (!parts[0]) return usage();
        let type = parts[0].toLowerCase().replace(/^minecraft:/, '');
        type = MOB_ALIASES[type] || type;
        if (!ANIMAL_TYPES[type] && !HOSTILE_TYPES[type]) return { err: t('cmd.noMob', { m: parts[0] }) };
        const d = p.lookDirection();
        const x = parts[1] ? this.coord(parts[1], p.pos.x) : p.pos.x + d.x * 3;
        const y = parts[2] ? this.coord(parts[2], p.pos.y) : p.pos.y + 0.5;
        const z = parts[3] ? this.coord(parts[3], p.pos.z) : p.pos.z + d.z * 3;
        if ([x, y, z].some(Number.isNaN)) return usage();
        g.entities.spawn(type, x, y, z);
        return { ok: t('cmd.summon', { mob: mobName(type) }) };
      }
      case 'kill': {
        const target = (parts[0] || 'self').toLowerCase();
        if (target === 'self' || target === '@s' || target === '@p') { p.damage(1e9, 'command', true); return { ok: t('cmd.kill', { n: 1 }) }; }
        const f = { monster: 'monster', monsters: 'monster', passive: 'passive', all: 'all', '@e': 'all' }[target];
        if (!f) return usage();
        return { ok: t('cmd.kill', { n: g.entities.kill(f) }) };
      }
      case 'seed': return { ok: t('cmd.seed', { s: g.seedText }) };
      case 'clear': g.inventory.clear(); return { ok: t('cmd.clear') };
      case 'spawnpoint': p.spawnPoint.copy(p.pos); return { ok: t('cmd.spawnpoint') };
      default: return { err: t('cmd.unknown', { c: '/' + cmd }) };
    }
  }
}
