// world/Biomes.js
// Regras de cada bioma. A escolha do bioma vem de três "mapas" de ruído contínuos:
// temperatura, umidade e continentalidade (o quanto aquele ponto é terra firme vs oceano).
// Como o relevo vem dos mesmos ruídos contínuos, não aparecem "paredões" na fronteira entre biomas.
import { B } from './Blocks.js';

export const BIOME = {
  PLAINS: 0, FOREST: 1, FLOWER_FOREST: 2, TUNDRA: 3, SNOWY_PLAINS: 4,
  DESERT: 5, JUNGLE: 6, MOUNTAINS: 7, OCEAN: 8, FROZEN_OCEAN: 9, BEACH: 10,
  NETHER: 11, AETHER: 12,
};

// tree: tipo de árvore; treeChance: probabilidade por coluna; plants: [blockId, chance]
export const BIOMES = [];
function biome(id, o) {
  BIOMES[id] = Object.assign({
    id, top: B.GRASS, filler: B.DIRT, fillerDepth: 3, tree: null, treeChance: 0,
    plants: [], grass: [0.47, 0.73, 0.29], foliage: [0.38, 0.65, 0.22],
    heightScale: 1, snowy: false, frozenWater: false,
  }, o);
}

biome(BIOME.PLAINS, { key: 'plains', tree: 'oak', treeChance: 0.002, plants: [[B.TALLGRASS, 0.18], [B.FLOWER_YELLOW, 0.01], [B.FLOWER_RED, 0.006]], grass: [0.55, 0.74, 0.33] });
biome(BIOME.FOREST, { key: 'forest', tree: 'oak', treeChance: 0.045, birch: 0.3, plants: [[B.TALLGRASS, 0.1], [B.FERN, 0.02]], grass: [0.47, 0.70, 0.30], foliage: [0.35, 0.60, 0.20] });
biome(BIOME.FLOWER_FOREST, { key: 'flower_forest', tree: 'oak', treeChance: 0.02, birch: 0.5, plants: [[B.FLOWER_RED, 0.09], [B.FLOWER_YELLOW, 0.09], [B.TALLGRASS, 0.08]], grass: [0.50, 0.78, 0.36], foliage: [0.40, 0.70, 0.25] });
biome(BIOME.TUNDRA, { key: 'tundra', top: B.SNOW_GRASS, tree: 'spruce', treeChance: 0.025, plants: [[B.FERN, 0.03]], grass: [0.50, 0.62, 0.50], foliage: [0.30, 0.45, 0.30], snowy: true, frozenWater: true });
biome(BIOME.SNOWY_PLAINS, { key: 'snowy_plains', top: B.SNOW_GRASS, tree: 'spruce', treeChance: 0.002, grass: [0.55, 0.65, 0.55], snowy: true, frozenWater: true });
biome(BIOME.DESERT, { key: 'desert', top: B.SAND, filler: B.SAND, fillerDepth: 4, tree: 'cactus', treeChance: 0.006, plants: [[B.DEAD_BUSH, 0.008]], grass: [0.75, 0.72, 0.38] });
biome(BIOME.JUNGLE, { key: 'jungle', tree: 'jungle', treeChance: 0.08, plants: [[B.TALLGRASS, 0.3], [B.FERN, 0.1], [B.FLOWER_RED, 0.01]], grass: [0.35, 0.80, 0.18], foliage: [0.25, 0.75, 0.10] });
biome(BIOME.MOUNTAINS, { key: 'mountains', top: B.GRASS, tree: 'spruce', treeChance: 0.006, plants: [[B.TALLGRASS, 0.05]], grass: [0.50, 0.68, 0.45], foliage: [0.35, 0.55, 0.30], heightScale: 3 });
biome(BIOME.OCEAN, { key: 'ocean', top: B.SAND, filler: B.SAND, grass: [0.47, 0.73, 0.29] });
biome(BIOME.FROZEN_OCEAN, { key: 'frozen_ocean', top: B.GRAVEL, filler: B.GRAVEL, frozenWater: true, snowy: true });
biome(BIOME.BEACH, { key: 'beach', top: B.SAND, filler: B.SAND, fillerDepth: 4, grass: [0.55, 0.74, 0.33] });
biome(BIOME.AETHER, { key: 'aether', top: B.AETHER_GRASS, filler: B.AETHER_DIRT, grass: [0.6, 0.85, 0.7] });
biome(BIOME.NETHER, { key: 'nether', top: B.NETHERRACK, filler: B.NETHERRACK, grass: [0.6, 0.3, 0.2] });

// Decide o bioma a partir dos valores de clima (todos ~[-1,1]) e da altura final do terreno.
export function pickBiome(temp, humid, cont, mount, height, seaLevel, weird) {
  if (height < seaLevel - 2) return temp < -0.35 ? BIOME.FROZEN_OCEAN : BIOME.OCEAN;
  if (height <= seaLevel + 1 && cont < 0.05) return temp < -0.35 ? BIOME.SNOWY_PLAINS : BIOME.BEACH;
  if (mount > 0.38 && height > seaLevel + 18) return BIOME.MOUNTAINS;
  if (temp < -0.35) return humid > 0.0 ? BIOME.TUNDRA : BIOME.SNOWY_PLAINS;
  if (temp > 0.4) return humid > 0.15 ? BIOME.JUNGLE : BIOME.DESERT;
  if (humid > 0.15) return weird > 0.45 ? BIOME.FLOWER_FOREST : BIOME.FOREST;
  if (humid < -0.2 && weird > 0.55) return BIOME.FLOWER_FOREST;
  return BIOME.PLAINS;
}
