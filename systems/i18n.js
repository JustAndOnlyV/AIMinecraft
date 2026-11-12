// systems/i18n.js
// Internacionalização (i18n = "i" + 18 letras + "n"). Todo texto visível passa por t('chave').
// Itens de família (ferramentas, escadas, minérios...) usam templates: "{m} Pickaxe" + material "Diamond".

const EN = {
  ui: {
    'menu.tagline': 'An endless block world, generated on the fly, running entirely in your browser.',
    'menu.seed': 'World seed', 'menu.seedPh': 'leave empty for random', 'menu.mode': 'Game mode',
    'menu.survival': 'Survival', 'menu.survivalDesc': 'health, hunger, mining and crafting',
    'menu.creative': 'Creative', 'menu.creativeDesc': 'flight, infinite items, instant breaking',
    'menu.new': 'New world', 'menu.continue': 'Continue saved world', 'menu.import': 'Import world file', 'menu.options': 'Options',
    'menu.warn': 'Creating a new world erases the current saved world.', 'menu.controls': 'Controls',
    'loading.world': 'Generating world…', 'loading.nether': 'Entering the Nether…', 'loading.aether': 'Ascending to the Aether…', 'loading.overworld': 'Returning to the Overworld…',
    'click.play': 'Click to play', 'click.hint': 'The mouse gets locked to the game. Press Esc to release it.',
    'pause.title': 'Game paused', 'pause.resume': 'Back to game', 'pause.options': 'Options', 'pause.export': 'Save world to file', 'pause.saveQuit': 'Save and quit to menu',
    'pause.hint': 'The world auto-saves in your browser (IndexedDB).',
    'death.title': 'You died!', 'death.respawn': 'Respawn', 'death.cause': 'Cause: {c}',
    'inv.title': 'Inventory', 'inv.crafting': 'Crafting', 'inv.table': 'Crafting Table', 'inv.furnace': 'Furnace', 'inv.chest': 'Chest', 'inv.armor': 'Armor',
    'inv.creative': 'Creative — all items (click: take a stack · Shift+click: send to hotbar)', 'inv.search': 'Search items…', 'inv.trash': 'Trash',
    'msg.welcome': 'Welcome! Click to play. Esc pauses, T opens chat, / types a command.',
    'msg.ate': 'You ate {item}', 'msg.portalOpen': 'The portal opened!', 'msg.portalHint': 'Build an obsidian frame (2×3 inside) and light it from inside.',
    'msg.aetherHint': 'Pour water inside a glowstone frame (2×3 inside) to open the Aether portal.',
    'msg.waterNether': 'The water evaporates in the Nether!', 'msg.creative': 'Creative mode', 'msg.survival': 'Survival mode',
    'msg.sleepDay': 'You can only sleep at night', 'msg.sleepMonsters': 'You may not rest now, there are monsters nearby',
    'msg.spawnSet': 'Respawn point set', 'msg.goodMorning': 'Good morning!', 'msg.bedExplode': 'Beds explode in the Nether!',
    'msg.saved': 'World saved', 'msg.exported': 'World saved to file {f}', 'msg.exportFail': 'The browser blocked the download. Run the game locally to save files.',
    'msg.imported': 'World imported', 'msg.importFail': 'Could not read this file.', 'msg.wrongDim': 'This portal does not work in this dimension',
    'msg.fellFromAether': 'You fell from the Aether!',
    'death.fall': 'fell from a high place', 'death.lava': 'tried to swim in lava', 'death.fire': 'burned to death', 'death.drown': 'drowned',
    'death.starve': 'starved to death', 'death.void': 'fell out of the world', 'death.arrow': 'was shot by an arrow', 'death.explosion': 'blew up',
    'death.mob': 'was slain by {mob}', 'death.command': 'was killed by a command', 'death.cactus': 'was pricked to death',
    'opt.title': 'Options', 'opt.general': 'General', 'opt.video': 'Video', 'opt.audio': 'Audio', 'opt.controls': 'Controls',
    'opt.language': 'Language', 'opt.fov': 'Field of view', 'opt.sensitivity': 'Mouse sensitivity', 'opt.invertY': 'Invert mouse Y',
    'opt.renderDistance': 'Render distance', 'opt.brightness': 'Brightness', 'opt.bobbing': 'View bobbing', 'opt.smoothLighting': 'Smooth lighting',
    'opt.clouds': 'Clouds', 'opt.renderScale': 'Render resolution', 'opt.master': 'Master volume', 'opt.blocks': 'Blocks', 'opt.creatures': 'Creatures',
    'opt.player': 'Player', 'opt.ambient': 'Ambient', 'opt.uiSounds': 'Interface', 'opt.done': 'Done', 'opt.reset': 'Reset keys',
    'opt.pressKey': 'Press a key…', 'opt.on': 'On', 'opt.off': 'Off', 'opt.chunks': '{n} chunks', 'opt.moody': 'Moody', 'opt.bright': 'Bright',
    'opt.rdNote': 'Render distance applies to newly loaded areas.',
    'key.forward': 'Walk forward', 'key.back': 'Walk backward', 'key.left': 'Strafe left', 'key.right': 'Strafe right', 'key.jump': 'Jump / swim / fly up',
    'key.sneak': 'Sneak / fly down', 'key.sprint': 'Sprint', 'key.inventory': 'Inventory', 'key.drop': 'Drop item', 'key.chat': 'Open chat',
    'key.command': 'Open command', 'key.toggleMode': 'Toggle game mode', 'key.fly': 'Toggle flight (creative)', 'key.debug': 'Debug screen',
    'ctl.move': 'move', 'ctl.mouseL': 'Left mouse', 'ctl.mouseLd': 'break block · attack', 'ctl.mouseR': 'Right mouse', 'ctl.mouseRd': 'place · use · eat · open · sleep',
    'ctl.wheel': '1–9 / wheel', 'ctl.wheeld': 'choose hotbar slot', 'ctl.esc': 'Esc', 'ctl.escd': 'pause',
    'cmd.unknown': 'Unknown command: {c}. Type /help', 'cmd.usage': 'Usage: {u}', 'cmd.tp': 'Teleported to {x}, {y}, {z}',
    'cmd.gamemode': 'Game mode set to {m}', 'cmd.time': 'Time set to {t}', 'cmd.give': 'Gave {n} × {item}', 'cmd.noItem': 'Unknown item: {i}',
    'cmd.summon': 'Summoned {mob}', 'cmd.noMob': 'Unknown entity: {m}', 'cmd.kill': 'Removed {n} entities', 'cmd.seed': 'Seed: {s}',
    'cmd.clear': 'Inventory cleared', 'cmd.spawnpoint': 'Spawn point set', 'cmd.help': 'Commands:', 'chat.placeholder': 'Type a message or /command',
  },
  tpl: {
    planks: '{m} Planks', log: '{m} Log', leaves: '{m} Leaves', sapling: '{m} Sapling', stairs: '{m} Stairs', slab: '{m} Slab', fence: '{m} Fence',
    door: '{m} Door', ore: '{m} Ore', block: 'Block of {m}', pickaxe: '{m} Pickaxe', sword: '{m} Sword', axe: '{m} Axe', shovel: '{m} Shovel',
    helmet: '{m} Helmet', chestplate: '{m} Chestplate', leggings: '{m} Leggings', boots: '{m} Boots', wool: '{m} Wool',
  },
  mats: {
    oak: 'Oak', spruce: 'Spruce', birch: 'Birch', jungle: 'Jungle', skyroot: 'Skyroot', cobblestone: 'Cobblestone', stone: 'Stone', stone_brick: 'Stone Brick',
    quartz: 'Quartz', coal: 'Coal', iron: 'Iron', lapis: 'Lapis Lazuli', gold: 'Gold', diamond: 'Diamond', emerald: 'Emerald', sapphire: 'Sapphire',
    amethyst: 'Amethyst', platinum: 'Platinum', zanite: 'Zanite', ambrosium: 'Ambrosium', wooden: 'Wooden', golden: 'Golden', leather: 'Leather',
    color_white: 'White', color_red: 'Red', color_blue: 'Blue', color_green: 'Green', color_yellow: 'Yellow',
  },
  items: {
    grass_block: 'Grass Block', dirt: 'Dirt', stone: 'Stone', glass: 'Glass', sand: 'Sand', water: 'Water', lava: 'Lava', snowy_grass_block: 'Snowy Grass Block',
    ice: 'Ice', cobblestone: 'Cobblestone', torch: 'Torch', glowstone: 'Glowstone', tall_grass: 'Tall Grass', poppy: 'Poppy', dandelion: 'Dandelion',
    netherrack: 'Netherrack', obsidian: 'Obsidian', nether_portal: 'Nether Portal', aether_portal: 'Aether Portal', bedrock: 'Bedrock', cactus: 'Cactus',
    crafting_table: 'Crafting Table', furnace: 'Furnace', chest: 'Chest', gravel: 'Gravel', soul_sand: 'Soul Sand', snow_block: 'Snow Block',
    stone_bricks: 'Stone Bricks', dead_bush: 'Dead Bush', fern: 'Fern', fire: 'Fire', golden_oak_leaves: 'Golden Oak Leaves', quartz_block: 'Block of Quartz',
    chiseled_quartz_block: 'Chiseled Quartz Block', quartz_pillar: 'Quartz Pillar', smooth_quartz: 'Smooth Quartz', bed: 'Bed',
    aether_grass: 'Aether Grass', aether_dirt: 'Aether Dirt', holystone: 'Holystone', cold_aercloud: 'Cold Aercloud', blue_aercloud: 'Blue Aercloud',
    stick: 'Stick', coal: 'Coal', iron_ingot: 'Iron Ingot', gold_ingot: 'Gold Ingot', platinum_ingot: 'Platinum Ingot', diamond: 'Diamond', emerald: 'Emerald',
    sapphire: 'Sapphire', amethyst_shard: 'Amethyst Shard', quartz: 'Nether Quartz', zanite_gemstone: 'Zanite Gemstone', ambrosium_shard: 'Ambrosium Shard',
    flint: 'Flint', flint_and_steel: 'Flint and Steel', lapis_lazuli: 'Lapis Lazuli', string: 'String', bone: 'Bone', porkchop: 'Raw Porkchop',
    cooked_porkchop: 'Cooked Porkchop', beef: 'Raw Beef', steak: 'Steak', chicken: 'Raw Chicken', cooked_chicken: 'Cooked Chicken', mutton: 'Raw Mutton',
    cooked_mutton: 'Cooked Mutton', apple: 'Apple', rotten_flesh: 'Rotten Flesh', arrow: 'Arrow', feather: 'Feather', leather: 'Leather',
    glowstone_dust: 'Glowstone Dust', bucket: 'Bucket', water_bucket: 'Water Bucket', lava_bucket: 'Lava Bucket', bread: 'Bread', wheat_seeds: 'Wheat Seeds',
    gold_nugget: 'Gold Nugget',
  },
  mobs: { pig: 'Pig', cow: 'Cow', sheep: 'Sheep', chicken: 'Chicken', wolf: 'Wolf', fox: 'Fox', zombie: 'Zombie', skeleton: 'Skeleton', spider: 'Spider', pigman: 'Zombie Pigman', phyg: 'Phyg', sheepuff: 'Sheepuff' },
  biomes: { plains: 'Plains', forest: 'Forest', flower_forest: 'Flower Forest', tundra: 'Snowy Taiga', snowy_plains: 'Snowy Plains', desert: 'Desert', jungle: 'Jungle', mountains: 'Rocky Mountains', ocean: 'Ocean', frozen_ocean: 'Frozen Ocean', beach: 'Beach', nether: 'Nether Wastes', aether: 'Aether Highlands' },
  modes: { survival: 'Survival', creative: 'Creative' },
};

const PT = {
  ui: {
    'menu.tagline': 'Um mundo de blocos infinito, gerado na hora, rodando só no navegador.',
    'menu.seed': 'Seed do mundo', 'menu.seedPh': 'deixe vazio para aleatória', 'menu.mode': 'Modo de jogo',
    'menu.survival': 'Sobrevivência', 'menu.survivalDesc': 'vida, fome, minerar e fabricar',
    'menu.creative': 'Criativo', 'menu.creativeDesc': 'voo, itens infinitos, quebra instantânea',
    'menu.new': 'Novo mundo', 'menu.continue': 'Continuar mundo salvo', 'menu.import': 'Importar mundo de arquivo', 'menu.options': 'Opções',
    'menu.warn': 'Criar um novo mundo apaga o mundo salvo atual.', 'menu.controls': 'Controles',
    'loading.world': 'Gerando mundo…', 'loading.nether': 'Entrando no Nether…', 'loading.aether': 'Subindo ao Aether…', 'loading.overworld': 'Voltando ao Overworld…',
    'click.play': 'Clique para jogar', 'click.hint': 'O mouse fica preso na tela. Aperte Esc para soltar.',
    'pause.title': 'Jogo pausado', 'pause.resume': 'Voltar ao jogo', 'pause.options': 'Opções', 'pause.export': 'Salvar mundo em arquivo', 'pause.saveQuit': 'Salvar e sair para o menu',
    'pause.hint': 'O mundo é salvo automaticamente no navegador (IndexedDB).',
    'death.title': 'Você morreu!', 'death.respawn': 'Renascer', 'death.cause': 'Causa: {c}',
    'inv.title': 'Inventário', 'inv.crafting': 'Fabricação', 'inv.table': 'Bancada de Trabalho', 'inv.furnace': 'Fornalha', 'inv.chest': 'Baú', 'inv.armor': 'Armadura',
    'inv.creative': 'Criativo — todos os itens (clique: pega a pilha · Shift+clique: manda pra hotbar)', 'inv.search': 'Buscar item…', 'inv.trash': 'Lixeira',
    'msg.welcome': 'Bem-vindo! Clique para jogar. Esc pausa, T abre o chat, / digita um comando.',
    'msg.ate': 'Você comeu {item}', 'msg.portalOpen': 'O portal se abriu!', 'msg.portalHint': 'Monte uma moldura de obsidiana (interior 2×3) e acenda por dentro.',
    'msg.aetherHint': 'Despeje água dentro de uma moldura de glowstone (interior 2×3) para abrir o portal do Aether.',
    'msg.waterNether': 'A água evapora no Nether!', 'msg.creative': 'Modo Criativo', 'msg.survival': 'Modo Sobrevivência',
    'msg.sleepDay': 'Você só pode dormir à noite', 'msg.sleepMonsters': 'Você não pode descansar agora, há monstros por perto',
    'msg.spawnSet': 'Ponto de renascimento definido', 'msg.goodMorning': 'Bom dia!', 'msg.bedExplode': 'Camas explodem no Nether!',
    'msg.saved': 'Mundo salvo', 'msg.exported': 'Mundo salvo no arquivo {f}', 'msg.exportFail': 'O navegador bloqueou o download. Rode o jogo localmente para salvar arquivos.',
    'msg.imported': 'Mundo importado', 'msg.importFail': 'Não foi possível ler este arquivo.', 'msg.wrongDim': 'Este portal não funciona nesta dimensão',
    'msg.fellFromAether': 'Você caiu do Aether!',
    'death.fall': 'caiu de um lugar alto', 'death.lava': 'tentou nadar na lava', 'death.fire': 'morreu queimado', 'death.drown': 'se afogou',
    'death.starve': 'morreu de fome', 'death.void': 'caiu para fora do mundo', 'death.arrow': 'foi atingido por uma flecha', 'death.explosion': 'explodiu',
    'death.mob': 'foi morto por {mob}', 'death.command': 'foi morto por um comando', 'death.cactus': 'foi espetado até a morte',
    'opt.title': 'Opções', 'opt.general': 'Geral', 'opt.video': 'Vídeo', 'opt.audio': 'Áudio', 'opt.controls': 'Controles',
    'opt.language': 'Idioma', 'opt.fov': 'Campo de visão', 'opt.sensitivity': 'Sensibilidade do mouse', 'opt.invertY': 'Inverter eixo Y',
    'opt.renderDistance': 'Distância de renderização', 'opt.brightness': 'Brilho', 'opt.bobbing': 'Balanço da câmera', 'opt.smoothLighting': 'Iluminação suave',
    'opt.clouds': 'Nuvens', 'opt.renderScale': 'Resolução de renderização', 'opt.master': 'Volume geral', 'opt.blocks': 'Blocos', 'opt.creatures': 'Criaturas',
    'opt.player': 'Jogador', 'opt.ambient': 'Ambiente', 'opt.uiSounds': 'Interface', 'opt.done': 'Concluído', 'opt.reset': 'Restaurar teclas',
    'opt.pressKey': 'Aperte uma tecla…', 'opt.on': 'Ligado', 'opt.off': 'Desligado', 'opt.chunks': '{n} chunks', 'opt.moody': 'Sombrio', 'opt.bright': 'Claro',
    'opt.rdNote': 'A distância vale para áreas carregadas a partir de agora.',
    'key.forward': 'Andar para frente', 'key.back': 'Andar para trás', 'key.left': 'Ir para a esquerda', 'key.right': 'Ir para a direita', 'key.jump': 'Pular / nadar / subir voando',
    'key.sneak': 'Agachar / descer voando', 'key.sprint': 'Correr', 'key.inventory': 'Inventário', 'key.drop': 'Soltar item', 'key.chat': 'Abrir chat',
    'key.command': 'Abrir comando', 'key.toggleMode': 'Alternar modo de jogo', 'key.fly': 'Alternar voo (criativo)', 'key.debug': 'Tela de depuração',
    'ctl.move': 'andar', 'ctl.mouseL': 'Botão esquerdo', 'ctl.mouseLd': 'quebrar bloco · atacar', 'ctl.mouseR': 'Botão direito', 'ctl.mouseRd': 'colocar · usar · comer · abrir · dormir',
    'ctl.wheel': '1–9 / roda', 'ctl.wheeld': 'escolher slot da hotbar', 'ctl.esc': 'Esc', 'ctl.escd': 'pausar',
    'cmd.unknown': 'Comando desconhecido: {c}. Digite /help', 'cmd.usage': 'Uso: {u}', 'cmd.tp': 'Teleportado para {x}, {y}, {z}',
    'cmd.gamemode': 'Modo de jogo: {m}', 'cmd.time': 'Hora definida para {t}', 'cmd.give': 'Recebeu {n} × {item}', 'cmd.noItem': 'Item desconhecido: {i}',
    'cmd.summon': '{mob} invocado', 'cmd.noMob': 'Entidade desconhecida: {m}', 'cmd.kill': '{n} entidades removidas', 'cmd.seed': 'Seed: {s}',
    'cmd.clear': 'Inventário limpo', 'cmd.spawnpoint': 'Ponto de renascimento definido', 'cmd.help': 'Comandos:', 'chat.placeholder': 'Digite uma mensagem ou /comando',
  },
  tpl: {
    planks: 'Tábuas de {m}', log: 'Tronco de {m}', leaves: 'Folhas de {m}', sapling: 'Muda de {m}', stairs: 'Escada de {m}', slab: 'Laje de {m}', fence: 'Cerca de {m}',
    door: 'Porta de {m}', ore: 'Minério de {m}', block: 'Bloco de {m}', pickaxe: 'Picareta de {m}', sword: 'Espada de {m}', axe: 'Machado de {m}', shovel: 'Pá de {m}',
    helmet: 'Capacete de {m}', chestplate: 'Peitoral de {m}', leggings: 'Calças de {m}', boots: 'Botas de {m}', wool: 'Lã {m}',
  },
  mats: {
    oak: 'Carvalho', spruce: 'Pinheiro', birch: 'Bétula', jungle: 'Selva', skyroot: 'Raiz-celeste', cobblestone: 'Pedregulho', stone: 'Pedra', stone_brick: 'Tijolos de Pedra',
    quartz: 'Quartzo', coal: 'Carvão', iron: 'Ferro', lapis: 'Lápis-lazúli', gold: 'Ouro', diamond: 'Diamante', emerald: 'Esmeralda', sapphire: 'Safira',
    amethyst: 'Ametista', platinum: 'Platina', zanite: 'Zanita', ambrosium: 'Ambrósio', wooden: 'Madeira', golden: 'Ouro', leather: 'Couro',
    color_white: 'Branca', color_red: 'Vermelha', color_blue: 'Azul', color_green: 'Verde', color_yellow: 'Amarela',
  },
  items: {
    grass_block: 'Bloco de Grama', dirt: 'Terra', stone: 'Pedra', glass: 'Vidro', sand: 'Areia', water: 'Água', lava: 'Lava', snowy_grass_block: 'Grama Nevada',
    ice: 'Gelo', cobblestone: 'Pedregulho', torch: 'Tocha', glowstone: 'Pedra Luminosa', tall_grass: 'Grama Alta', poppy: 'Papoula', dandelion: 'Dente-de-leão',
    netherrack: 'Netherrack', obsidian: 'Obsidiana', nether_portal: 'Portal do Nether', aether_portal: 'Portal do Aether', bedrock: 'Rocha-mãe', cactus: 'Cacto',
    crafting_table: 'Bancada de Trabalho', furnace: 'Fornalha', chest: 'Baú', gravel: 'Cascalho', soul_sand: 'Areia das Almas', snow_block: 'Bloco de Neve',
    stone_bricks: 'Tijolos de Pedra', dead_bush: 'Arbusto Seco', fern: 'Samambaia', fire: 'Fogo', golden_oak_leaves: 'Folhas de Carvalho Dourado', quartz_block: 'Bloco de Quartzo',
    chiseled_quartz_block: 'Quartzo Talhado', quartz_pillar: 'Pilar de Quartzo', smooth_quartz: 'Quartzo Liso', bed: 'Cama',
    aether_grass: 'Grama do Aether', aether_dirt: 'Terra do Aether', holystone: 'Pedra Sagrada', cold_aercloud: 'Nuvem Fria', blue_aercloud: 'Nuvem Azul',
    stick: 'Graveto', coal: 'Carvão', iron_ingot: 'Barra de Ferro', gold_ingot: 'Barra de Ouro', platinum_ingot: 'Barra de Platina', diamond: 'Diamante', emerald: 'Esmeralda',
    sapphire: 'Safira', amethyst_shard: 'Fragmento de Ametista', quartz: 'Quartzo do Nether', zanite_gemstone: 'Gema de Zanita', ambrosium_shard: 'Fragmento de Ambrósio',
    flint: 'Pederneira', flint_and_steel: 'Isqueiro', lapis_lazuli: 'Lápis-lazúli', string: 'Linha', bone: 'Osso', porkchop: 'Costeleta Crua',
    cooked_porkchop: 'Costeleta Assada', beef: 'Carne Crua', steak: 'Bife', chicken: 'Frango Cru', cooked_chicken: 'Frango Assado', mutton: 'Carneiro Cru',
    cooked_mutton: 'Carneiro Assado', apple: 'Maçã', rotten_flesh: 'Carne Podre', arrow: 'Flecha', feather: 'Pena', leather: 'Couro',
    glowstone_dust: 'Pó de Glowstone', bucket: 'Balde', water_bucket: 'Balde de Água', lava_bucket: 'Balde de Lava', bread: 'Pão', wheat_seeds: 'Sementes de Trigo',
    gold_nugget: 'Pepita de Ouro',
  },
  mobs: { pig: 'Porco', cow: 'Vaca', sheep: 'Ovelha', chicken: 'Galinha', wolf: 'Lobo', fox: 'Raposa', zombie: 'Zumbi', skeleton: 'Esqueleto', spider: 'Aranha', pigman: 'Zumbi-Pigman', phyg: 'Porco Alado', sheepuff: 'Ovelha Fofa' },
  biomes: { plains: 'Planície', forest: 'Floresta', flower_forest: 'Floresta de Flores', tundra: 'Taiga Nevada', snowy_plains: 'Planícies Nevadas', desert: 'Deserto', jungle: 'Selva', mountains: 'Montanhas Rochosas', ocean: 'Oceano', frozen_ocean: 'Oceano Congelado', beach: 'Praia', nether: 'Ermos do Nether', aether: 'Planaltos do Aether' },
  modes: { survival: 'Sobrevivência', creative: 'Criativo' },
};

const ES = {
  ui: {
    'menu.tagline': 'Un mundo de bloques infinito, generado al instante, que funciona solo en el navegador.',
    'menu.seed': 'Semilla del mundo', 'menu.seedPh': 'déjala vacía para una aleatoria', 'menu.mode': 'Modo de juego',
    'menu.survival': 'Supervivencia', 'menu.survivalDesc': 'vida, hambre, minar y fabricar',
    'menu.creative': 'Creativo', 'menu.creativeDesc': 'vuelo, objetos infinitos, rotura instantánea',
    'menu.new': 'Nuevo mundo', 'menu.continue': 'Continuar mundo guardado', 'menu.import': 'Importar mundo desde archivo', 'menu.options': 'Opciones',
    'menu.warn': 'Crear un mundo nuevo borra el mundo guardado actual.', 'menu.controls': 'Controles',
    'loading.world': 'Generando mundo…', 'loading.nether': 'Entrando al Nether…', 'loading.aether': 'Ascendiendo al Aether…', 'loading.overworld': 'Volviendo al Overworld…',
    'click.play': 'Haz clic para jugar', 'click.hint': 'El ratón queda bloqueado en el juego. Pulsa Esc para soltarlo.',
    'pause.title': 'Juego en pausa', 'pause.resume': 'Volver al juego', 'pause.options': 'Opciones', 'pause.export': 'Guardar mundo en archivo', 'pause.saveQuit': 'Guardar y salir al menú',
    'pause.hint': 'El mundo se guarda automáticamente en el navegador (IndexedDB).',
    'death.title': '¡Has muerto!', 'death.respawn': 'Reaparecer', 'death.cause': 'Causa: {c}',
    'inv.title': 'Inventario', 'inv.crafting': 'Fabricación', 'inv.table': 'Mesa de trabajo', 'inv.furnace': 'Horno', 'inv.chest': 'Cofre', 'inv.armor': 'Armadura',
    'inv.creative': 'Creativo — todos los objetos (clic: tomar pila · Mayús+clic: a la barra)', 'inv.search': 'Buscar objetos…', 'inv.trash': 'Papelera',
    'msg.welcome': '¡Bienvenido! Haz clic para jugar. Esc pausa, T abre el chat, / escribe un comando.',
    'msg.ate': 'Has comido {item}', 'msg.portalOpen': '¡El portal se ha abierto!', 'msg.portalHint': 'Construye un marco de obsidiana (interior 2×3) y enciéndelo por dentro.',
    'msg.aetherHint': 'Vierte agua dentro de un marco de piedra luminosa (interior 2×3) para abrir el portal del Aether.',
    'msg.waterNether': '¡El agua se evapora en el Nether!', 'msg.creative': 'Modo creativo', 'msg.survival': 'Modo supervivencia',
    'msg.sleepDay': 'Solo puedes dormir de noche', 'msg.sleepMonsters': 'No puedes descansar ahora, hay monstruos cerca',
    'msg.spawnSet': 'Punto de reaparición establecido', 'msg.goodMorning': '¡Buenos días!', 'msg.bedExplode': '¡Las camas explotan en el Nether!',
    'msg.saved': 'Mundo guardado', 'msg.exported': 'Mundo guardado en el archivo {f}', 'msg.exportFail': 'El navegador bloqueó la descarga. Ejecuta el juego en local para guardar archivos.',
    'msg.imported': 'Mundo importado', 'msg.importFail': 'No se pudo leer este archivo.', 'msg.wrongDim': 'Este portal no funciona en esta dimensión',
    'msg.fellFromAether': '¡Te has caído del Aether!',
    'death.fall': 'cayó desde muy alto', 'death.lava': 'intentó nadar en lava', 'death.fire': 'murió quemado', 'death.drown': 'se ahogó',
    'death.starve': 'murió de hambre', 'death.void': 'cayó fuera del mundo', 'death.arrow': 'recibió un flechazo', 'death.explosion': 'explotó',
    'death.mob': 'fue asesinado por {mob}', 'death.command': 'murió por un comando', 'death.cactus': 'murió pinchado',
    'opt.title': 'Opciones', 'opt.general': 'General', 'opt.video': 'Vídeo', 'opt.audio': 'Audio', 'opt.controls': 'Controles',
    'opt.language': 'Idioma', 'opt.fov': 'Campo de visión', 'opt.sensitivity': 'Sensibilidad del ratón', 'opt.invertY': 'Invertir eje Y',
    'opt.renderDistance': 'Distancia de renderizado', 'opt.brightness': 'Brillo', 'opt.bobbing': 'Balanceo de cámara', 'opt.smoothLighting': 'Iluminación suave',
    'opt.clouds': 'Nubes', 'opt.renderScale': 'Resolución de renderizado', 'opt.master': 'Volumen general', 'opt.blocks': 'Bloques', 'opt.creatures': 'Criaturas',
    'opt.player': 'Jugador', 'opt.ambient': 'Ambiente', 'opt.uiSounds': 'Interfaz', 'opt.done': 'Listo', 'opt.reset': 'Restablecer teclas',
    'opt.pressKey': 'Pulsa una tecla…', 'opt.on': 'Sí', 'opt.off': 'No', 'opt.chunks': '{n} chunks', 'opt.moody': 'Oscuro', 'opt.bright': 'Claro',
    'opt.rdNote': 'La distancia se aplica a las zonas que se carguen a partir de ahora.',
    'key.forward': 'Avanzar', 'key.back': 'Retroceder', 'key.left': 'Izquierda', 'key.right': 'Derecha', 'key.jump': 'Saltar / nadar / subir volando',
    'key.sneak': 'Agacharse / bajar volando', 'key.sprint': 'Correr', 'key.inventory': 'Inventario', 'key.drop': 'Soltar objeto', 'key.chat': 'Abrir chat',
    'key.command': 'Abrir comando', 'key.toggleMode': 'Cambiar modo de juego', 'key.fly': 'Activar vuelo (creativo)', 'key.debug': 'Pantalla de depuración',
    'ctl.move': 'moverse', 'ctl.mouseL': 'Botón izquierdo', 'ctl.mouseLd': 'romper bloque · atacar', 'ctl.mouseR': 'Botón derecho', 'ctl.mouseRd': 'colocar · usar · comer · abrir · dormir',
    'ctl.wheel': '1–9 / rueda', 'ctl.wheeld': 'elegir casilla', 'ctl.esc': 'Esc', 'ctl.escd': 'pausa',
    'cmd.unknown': 'Comando desconocido: {c}. Escribe /help', 'cmd.usage': 'Uso: {u}', 'cmd.tp': 'Teletransportado a {x}, {y}, {z}',
    'cmd.gamemode': 'Modo de juego: {m}', 'cmd.time': 'Hora establecida: {t}', 'cmd.give': 'Recibiste {n} × {item}', 'cmd.noItem': 'Objeto desconocido: {i}',
    'cmd.summon': '{mob} invocado', 'cmd.noMob': 'Entidad desconocida: {m}', 'cmd.kill': '{n} entidades eliminadas', 'cmd.seed': 'Semilla: {s}',
    'cmd.clear': 'Inventario vaciado', 'cmd.spawnpoint': 'Punto de reaparición establecido', 'cmd.help': 'Comandos:', 'chat.placeholder': 'Escribe un mensaje o /comando',
  },
  tpl: {
    planks: 'Tablones de {m}', log: 'Tronco de {m}', leaves: 'Hojas de {m}', sapling: 'Brote de {m}', stairs: 'Escaleras de {m}', slab: 'Losa de {m}', fence: 'Valla de {m}',
    door: 'Puerta de {m}', ore: 'Mena de {m}', block: 'Bloque de {m}', pickaxe: 'Pico de {m}', sword: 'Espada de {m}', axe: 'Hacha de {m}', shovel: 'Pala de {m}',
    helmet: 'Casco de {m}', chestplate: 'Peto de {m}', leggings: 'Grebas de {m}', boots: 'Botas de {m}', wool: 'Lana {m}',
  },
  mats: {
    oak: 'roble', spruce: 'abeto', birch: 'abedul', jungle: 'jungla', skyroot: 'raíz celeste', cobblestone: 'roca', stone: 'piedra', stone_brick: 'ladrillos de piedra',
    quartz: 'cuarzo', coal: 'carbón', iron: 'hierro', lapis: 'lapislázuli', gold: 'oro', diamond: 'diamante', emerald: 'esmeralda', sapphire: 'zafiro',
    amethyst: 'amatista', platinum: 'platino', zanite: 'zanita', ambrosium: 'ambrosía', wooden: 'madera', golden: 'oro', leather: 'cuero',
    color_white: 'blanca', color_red: 'roja', color_blue: 'azul', color_green: 'verde', color_yellow: 'amarilla',
  },
  items: {
    grass_block: 'Bloque de césped', dirt: 'Tierra', stone: 'Piedra', glass: 'Cristal', sand: 'Arena', water: 'Agua', lava: 'Lava', snowy_grass_block: 'Césped nevado',
    ice: 'Hielo', cobblestone: 'Roca', torch: 'Antorcha', glowstone: 'Piedra luminosa', tall_grass: 'Hierba alta', poppy: 'Amapola', dandelion: 'Diente de león',
    netherrack: 'Netherrack', obsidian: 'Obsidiana', nether_portal: 'Portal del Nether', aether_portal: 'Portal del Aether', bedrock: 'Lecho de roca', cactus: 'Cactus',
    crafting_table: 'Mesa de trabajo', furnace: 'Horno', chest: 'Cofre', gravel: 'Grava', soul_sand: 'Arena de almas', snow_block: 'Bloque de nieve',
    stone_bricks: 'Ladrillos de piedra', dead_bush: 'Arbusto muerto', fern: 'Helecho', fire: 'Fuego', golden_oak_leaves: 'Hojas de roble dorado', quartz_block: 'Bloque de cuarzo',
    chiseled_quartz_block: 'Cuarzo cincelado', quartz_pillar: 'Pilar de cuarzo', smooth_quartz: 'Cuarzo liso', bed: 'Cama',
    aether_grass: 'Césped del Aether', aether_dirt: 'Tierra del Aether', holystone: 'Piedra sagrada', cold_aercloud: 'Nube fría', blue_aercloud: 'Nube azul',
    stick: 'Palo', coal: 'Carbón', iron_ingot: 'Lingote de hierro', gold_ingot: 'Lingote de oro', platinum_ingot: 'Lingote de platino', diamond: 'Diamante', emerald: 'Esmeralda',
    sapphire: 'Zafiro', amethyst_shard: 'Fragmento de amatista', quartz: 'Cuarzo del Nether', zanite_gemstone: 'Gema de zanita', ambrosium_shard: 'Fragmento de ambrosía',
    flint: 'Pedernal', flint_and_steel: 'Mechero', lapis_lazuli: 'Lapislázuli', string: 'Cuerda', bone: 'Hueso', porkchop: 'Chuleta cruda',
    cooked_porkchop: 'Chuleta cocinada', beef: 'Filete crudo', steak: 'Filete', chicken: 'Pollo crudo', cooked_chicken: 'Pollo asado', mutton: 'Cordero crudo',
    cooked_mutton: 'Cordero asado', apple: 'Manzana', rotten_flesh: 'Carne podrida', arrow: 'Flecha', feather: 'Pluma', leather: 'Cuero',
    glowstone_dust: 'Polvo de piedra luminosa', bucket: 'Cubo', water_bucket: 'Cubo de agua', lava_bucket: 'Cubo de lava', bread: 'Pan', wheat_seeds: 'Semillas de trigo',
    gold_nugget: 'Pepita de oro',
  },
  mobs: { pig: 'Cerdo', cow: 'Vaca', sheep: 'Oveja', chicken: 'Gallina', wolf: 'Lobo', fox: 'Zorro', zombie: 'Zombi', skeleton: 'Esqueleto', spider: 'Araña', pigman: 'Zombi porquero', phyg: 'Cerdo alado', sheepuff: 'Oveja esponjosa' },
  biomes: { plains: 'Llanura', forest: 'Bosque', flower_forest: 'Bosque florido', tundra: 'Taiga nevada', snowy_plains: 'Llanuras nevadas', desert: 'Desierto', jungle: 'Jungla', mountains: 'Montañas rocosas', ocean: 'Océano', frozen_ocean: 'Océano congelado', beach: 'Playa', nether: 'Páramos del Nether', aether: 'Tierras altas del Aether' },
  modes: { survival: 'Supervivencia', creative: 'Creativo' },
};

export const LANGS = { en: { label: 'English', data: EN }, pt: { label: 'Português (Brasil)', data: PT }, es: { label: 'Español', data: ES } };
let cur = EN;
let curCode = 'en';
const listeners = new Set();

export function setLanguage(code) {
  if (!LANGS[code]) code = 'en';
  cur = LANGS[code].data; curCode = code;
  document.documentElement.lang = code === 'pt' ? 'pt-BR' : code;
  for (const fn of listeners) fn(code);
}
export function getLanguage() { return curCode; }
export function onLanguageChange(fn) { listeners.add(fn); }

function fmt(s, p) { return p ? s.replace(/\{(\w+)\}/g, (_, k) => (p[k] !== undefined ? p[k] : '{' + k + '}')) : s; }
export function t(key, params) { return fmt(cur.ui[key] ?? EN.ui[key] ?? key, params); }
export function mobName(type) { return cur.mobs[type] ?? EN.mobs[type] ?? type; }
export function biomeName(key) { return cur.biomes[key] ?? EN.biomes[key] ?? key; }
export function modeName(m) { return cur.modes[m] ?? m; }

export function itemName(it) {
  if (!it) return '';
  if (cur.items[it.key]) return cur.items[it.key];
  if (it.tpl) return fmt(cur.tpl[it.tpl] ?? EN.tpl[it.tpl], { m: cur.mats[it.mat] ?? EN.mats[it.mat] ?? it.mat });
  return EN.items[it.key] ?? it.key;
}

// Aplica traduções a elementos com data-i18n="chave" (textContent) e data-i18n-ph (placeholder)
export function applyDOM(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
}
