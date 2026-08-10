import { createNoise2D } from 'simplex-noise';
import { NoiseSettings } from '../types';

// Simple pseudo-random number generator for seeded noise
class PRNG {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
}

export function createSeededNoise(seed: number) {
  const prng = new PRNG(seed);
  return createNoise2D(() => prng.next());
}

/**
 * Calculates height value at (x, z) given NoiseSettings
 * Returns normalized value between 0.0 and 1.0 (or higher depending on multiplier)
 */
export function getProceduralHeight(
  x: number,
  z: number,
  settings: NoiseSettings,
  noise2D: (x: number, y: number) => number,
  worldSize: number = 200
): number {
  const {
    scale,
    octaves,
    persistance,
    lacunarity,
    exponent,
    ridgeWeight,
    terraces,
    islandGradient
  } = settings;

  let frequency = scale / 1000;
  let amplitude = 1.0;
  let maxPossibleValue = 0;
  let totalHeight = 0;

  for (let i = 0; i < octaves; i++) {
    const sampleX = x * frequency;
    const sampleZ = z * frequency;

    // Standard simplex noise (-1 to 1) -> convert to (0 to 1)
    let n = (noise2D(sampleX, sampleZ) + 1) * 0.5;

    // Ridge noise blend: abs(n * 2 - 1) inverted creates sharp ridges
    if (ridgeWeight > 0) {
      const ridge = 1.0 - Math.abs(noise2D(sampleX * 1.5, sampleZ * 1.5));
      n = n * (1 - ridgeWeight) + Math.pow(ridge, 2) * ridgeWeight;
    }

    totalHeight += n * amplitude;
    maxPossibleValue += amplitude;

    amplitude *= persistance;
    frequency *= lacunarity;
  }

  // Normalize to 0..1 range
  let normalized = totalHeight / maxPossibleValue;

  // Apply power exponent curve for mountains vs flat plains
  if (exponent !== 1.0) {
    normalized = Math.pow(normalized, exponent);
  }

  // Apply Terracing step effect if enabled
  if (terraces > 1) {
    const step = 1.0 / terraces;
    const terraceIndex = Math.floor(normalized / step);
    const fraction = (normalized % step) / step;
    // Smooth step transition between terraces
    const smoothFraction = fraction * fraction * (3 - 2 * fraction);
    normalized = (terraceIndex + smoothFraction) * step;
  }

  // Apply Island Gradient mask (radial distance falloff from center)
  if (islandGradient) {
    const halfSize = worldSize / 2;
    const dx = x / halfSize;
    const dz = z / halfSize;
    const dist = Math.sqrt(dx * dx + dz * dz);
    // Smooth falloff to 0 at edges
    const falloff = Math.max(0, 1 - Math.pow(dist, 2.5));
    normalized *= falloff;
  }

  return Math.max(0, normalized * settings.heightMultiplier);
}

/**
 * Generates a 2D Float32Array heightmap grid of dimension (width x height)
 */
export function generateHeightmapGrid(
  width: number,
  height: number,
  settings: NoiseSettings,
  worldSize: number = 200,
  offsetX: number = 0,
  offsetZ: number = 0
): Float32Array {
  const noise2D = createSeededNoise(settings.seed);
  const grid = new Float32Array(width * height);

  const halfW = (width - 1) / 2;
  const halfH = (height - 1) / 2;

  for (let z = 0; z < height; z++) {
    for (let x = 0; x < width; x++) {
      const worldX = ((x - halfW) / (width - 1)) * worldSize + offsetX;
      const worldZ = ((z - halfH) / (height - 1)) * worldSize + offsetZ;

      const h = getProceduralHeight(worldX, worldZ, settings, noise2D, worldSize);
      grid[z * width + x] = h;
    }
  }

  return grid;
}
