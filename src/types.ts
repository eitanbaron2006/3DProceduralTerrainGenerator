export type BiomeType = 'alpine' | 'tropical' | 'desert' | 'sierra' | 'volcanic' | 'alien';

export interface BiomeLayer {
  name: string;
  color: string;
  minHeight: number; // 0 to 1
  maxHeight: number; // 0 to 1
  minSlope: number;  // 0 to 1 (0 = flat, 1 = vertical)
  maxSlope: number;
}

export interface BiomeConfig {
  id: BiomeType;
  name: string;
  description: string;
  fogColor: string;
  skyColor: string;
  sunColor: string;
  waterColor: string;
  waterFoamColor: string;
  layers: BiomeLayer[];
}

export type EnvironmentId =
  | 'lakeside-sunrise'
  | 'table-mountain'
  | 'sky-on-fire'
  | 'clear-night';

export interface EnvironmentPreset {
  id: EnvironmentId;
  name: string;
  timeOfDay: string;
  hdrPath: string;
  skyboxPath: string;
  skyboxFacePaths: [string, string, string, string, string, string];
  waterReflectionPath: string;
  atmosphere: AtmosphereConfig;
}

export interface AtmosphereConfig {
  skyColor: string;
  fogColor: string;
  sunColor: string;
  fogDensity: number;
  backgroundIntensity: number;
  skyboxIntensity: number;
  environmentIntensity: number;
  ambientLightIntensity: number;
  sunLightIntensity: number;
  sunDirection: [number, number, number];
}

export interface NoiseSettings {
  seed: number;
  scale: number;        // Overall noise scale
  octaves: number;      // 1 to 8
  persistance: number;  // 0.1 to 0.9 (lacunarity persistence)
  lacunarity: number;   // 1.5 to 3.5
  heightMultiplier: number; // Vertical height amplification
  exponent: number;     // Ridge / plateau exponent (e.g. 1.0 to 3.0)
  ridgeWeight: number;  // 0 to 1 (sharp mountain ridges)
  terraces: number;     // 0 = none, 2 to 20 terrace steps
  islandGradient: boolean; // Radial falloff to create islands
}

export interface ErosionSettings {
  droplets: number;     // Number of raindrops in simulation
  erosionRate: number;
  depositionRate: number;
  evaporationRate: number;
  inertia: number;
  gravity: number;
  radius: number;
}

export interface WaterSettings {
  enabled: boolean;
  level: number;         // Y height of water plane
  transparency: number;  // 0 to 1
  waveSpeed: number;
  waveHeight: number;
  color: string;
  shallowColor: string;
  foamWidth: number;
}

export interface SculptBrush {
  active: boolean;
  mode: 'raise' | 'lower' | 'smooth' | 'flatten' | 'erode';
  radius: number;
  strength: number;
}

export interface LODSettings {
  chunkGridSize: number; // 1x1, 2x2, 4x4, 8x8
  resolution: number;    // Base vertices per chunk side (e.g. 64, 128, 256)
  enableLOD: boolean;
  lodDistance1: number;
  lodDistance2: number;
  wireframe: boolean;
  showChunkBounds: boolean;
  showNormals: boolean;
}

export interface PerformanceStats {
  fps: number;
  triangles: number;
  drawCalls: number;
  chunksRendered: number;
  memoryMB: number;
}

export type ActiveTab = 'terrain' | 'biomes' | 'water' | 'sculpt' | 'lod' | 'export';
