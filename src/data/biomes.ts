import { BiomeConfig } from '../types';

export const BIOME_PRESETS: BiomeConfig[] = [
  {
    id: 'alpine',
    name: 'Alpine Glacier Peak',
    description: 'Rugged high-altitude pine valleys, granitic cliff faces, and snow-capped mountain peaks.',
    fogColor: '#c3d5e8',
    skyColor: '#688cb0',
    sunColor: '#fff5ea',
    waterColor: '#1d5a7d',
    waterFoamColor: '#e0f2fe',
    layers: [
      { name: 'Pine Valley / Meadow', color: '#2d5a27', minHeight: 0, maxHeight: 0.35, minSlope: 0.7, maxSlope: 1 },
      { name: 'Granite Ridge', color: '#686f78', minHeight: 0.35, maxHeight: 0.7, minSlope: 0.3, maxSlope: 0.8 },
      { name: 'Glacial Snow & Ice', color: '#f8fafc', minHeight: 0.7, maxHeight: 1.0, minSlope: 0, maxSlope: 1 }
    ]
  },
  {
    id: 'tropical',
    name: 'Tropical Volcanic Island',
    description: 'Lush rainforest foliage, turquoise shallow lagoon waters, and volcanic basalt rock.',
    fogColor: '#d6f0f7',
    skyColor: '#38bdf8',
    sunColor: '#fffbe8',
    waterColor: '#06b6d4',
    waterFoamColor: '#f0fdf4',
    layers: [
      { name: 'Sand Beach & Reef', color: '#eab308', minHeight: 0, maxHeight: 0.2, minSlope: 0.8, maxSlope: 1 },
      { name: 'Jungle Canopy', color: '#15803d', minHeight: 0.2, maxHeight: 0.65, minSlope: 0.5, maxSlope: 1 },
      { name: 'Basalt Peak', color: '#334155', minHeight: 0.65, maxHeight: 1.0, minSlope: 0, maxSlope: 0.6 }
    ]
  },
  {
    id: 'desert',
    name: 'Red Rock Canyon',
    description: 'Sedimentary sandstone layers, arid canyons, dry riverbeds, and desert plateaus.',
    fogColor: '#fce7f3',
    skyColor: '#fb923c',
    sunColor: '#fff7ed',
    waterColor: '#0284c7',
    waterFoamColor: '#bae6fd',
    layers: [
      { name: 'Desert Riverbed', color: '#d97706', minHeight: 0, maxHeight: 0.25, minSlope: 0.7, maxSlope: 1 },
      { name: 'Red Sandstone Cliff', color: '#b45309', minHeight: 0.25, maxHeight: 0.7, minSlope: 0.2, maxSlope: 0.7 },
      { name: 'High Mesa Plateau', color: '#78350f', minHeight: 0.7, maxHeight: 1.0, minSlope: 0.8, maxSlope: 1 }
    ]
  },
  {
    id: 'sierra',
    name: 'Sierra High Sierra',
    description: 'Temperate coniferous woodlands, emerald clear lake, and steep granite peaks.',
    fogColor: '#e0f2fe',
    skyColor: '#0284c7',
    sunColor: '#fef3c7',
    waterColor: '#0369a1',
    waterFoamColor: '#e0f2fe',
    layers: [
      { name: 'Forest Floor', color: '#166534', minHeight: 0, maxHeight: 0.4, minSlope: 0.6, maxSlope: 1 },
      { name: 'Subalpine Scrub', color: '#4d7c0f', minHeight: 0.4, maxHeight: 0.75, minSlope: 0.4, maxSlope: 0.9 },
      { name: 'Sierra Granite', color: '#94a3b8', minHeight: 0.75, maxHeight: 1.0, minSlope: 0, maxSlope: 0.5 }
    ]
  },
  {
    id: 'volcanic',
    name: 'Obsidian Ash Caldera',
    description: 'Dark volcanic ash fields, fiery glowing magma cracks, and scorched basalt pillars.',
    fogColor: '#262626',
    skyColor: '#171717',
    sunColor: '#f97316',
    waterColor: '#dc2626',
    waterFoamColor: '#fef08a',
    layers: [
      { name: 'Cooling Magma', color: '#ef4444', minHeight: 0, maxHeight: 0.2, minSlope: 0.8, maxSlope: 1 },
      { name: 'Basalt Ash Fields', color: '#1f2937', minHeight: 0.2, maxHeight: 0.7, minSlope: 0.4, maxSlope: 0.9 },
      { name: 'Volcanic Caldera Peak', color: '#111827', minHeight: 0.7, maxHeight: 1.0, minSlope: 0, maxSlope: 0.5 }
    ]
  },
  {
    id: 'alien',
    name: 'Bioluminescent Alien World',
    description: 'Exotic cyan flora, neon purple mineral deposits, and luminescent dark waters.',
    fogColor: '#2e1065',
    skyColor: '#581c87',
    sunColor: '#e879f9',
    waterColor: '#0284c7',
    waterFoamColor: '#a855f7',
    layers: [
      { name: 'Neon Moss Soil', color: '#06b6d4', minHeight: 0, maxHeight: 0.3, minSlope: 0.6, maxSlope: 1 },
      { name: 'Amethyst Crystal Spires', color: '#9333ea', minHeight: 0.3, maxHeight: 0.75, minSlope: 0.3, maxSlope: 0.8 },
      { name: 'Obsidian Peak', color: '#0284c7', minHeight: 0.75, maxHeight: 1.0, minSlope: 0, maxSlope: 0.5 }
    ]
  }
];
