import { NoiseSettings, BiomeConfig } from '../types';
import { createSeededNoise, getProceduralHeight } from './noise';

/**
 * Generates an 8-bit or 16-bit Grayscale Heightmap canvas data URL
 */
export function generateHeightmapCanvas(
  resolution: number,
  noiseSettings: NoiseSettings,
  worldSize: number = 200,
  heightGrid?: Float32Array
): { canvas: HTMLCanvasElement; dataUrl: string } {
  const canvas = document.createElement('canvas');
  canvas.width = resolution;
  canvas.height = resolution;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(resolution, resolution);
  const pixels = imgData.data;

  const noise2D = createSeededNoise(noiseSettings.seed);
  const halfSize = worldSize / 2;

  let maxH = -Infinity;
  let minH = Infinity;

  // First pass to sample heights
  const heights = new Float32Array(resolution * resolution);
  for (let z = 0; z < resolution; z++) {
    for (let x = 0; x < resolution; x++) {
      const idx = z * resolution + x;
      let h = 0;
      if (heightGrid && heightGrid.length === resolution * resolution) {
        h = heightGrid[idx];
      } else {
        const worldX = (x / (resolution - 1) - 0.5) * worldSize;
        const worldZ = (z / (resolution - 1) - 0.5) * worldSize;
        h = getProceduralHeight(worldX, worldZ, noiseSettings, noise2D, worldSize);
      }
      heights[idx] = h;
      if (h > maxH) maxH = h;
      if (h < minH) minH = h;
    }
  }

  const range = maxH - minH || 1.0;

  for (let i = 0; i < heights.length; i++) {
    const norm = Math.min(255, Math.max(0, Math.floor(((heights[i] - minH) / range) * 255)));
    const pIdx = i * 4;
    pixels[pIdx] = norm;     // R
    pixels[pIdx + 1] = norm; // G
    pixels[pIdx + 2] = norm; // B
    pixels[pIdx + 3] = 255;  // A
  }

  ctx.putImageData(imgData, 0, 0);
  return { canvas, dataUrl: canvas.toDataURL('image/png') };
}

/**
 * Generates Tangent-space Normal Map from Heightmap
 */
export function generateNormalMapCanvas(
  resolution: number,
  noiseSettings: NoiseSettings,
  worldSize: number = 200,
  strength: number = 2.0,
  heightGrid?: Float32Array
): { canvas: HTMLCanvasElement; dataUrl: string } {
  const canvas = document.createElement('canvas');
  canvas.width = resolution;
  canvas.height = resolution;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(resolution, resolution);
  const pixels = imgData.data;

  const noise2D = createSeededNoise(noiseSettings.seed);

  const getHeightAt = (x: number, z: number): number => {
    if (x < 0 || x >= resolution || z < 0 || z >= resolution) return 0;
    const idx = z * resolution + x;
    if (heightGrid && heightGrid.length === resolution * resolution) {
      return heightGrid[idx];
    }
    const worldX = (x / (resolution - 1) - 0.5) * worldSize;
    const worldZ = (z / (resolution - 1) - 0.5) * worldSize;
    return getProceduralHeight(worldX, worldZ, noiseSettings, noise2D, worldSize);
  };

  for (let z = 0; z < resolution; z++) {
    for (let x = 0; x < resolution; x++) {
      const hL = getHeightAt(x - 1, z);
      const hR = getHeightAt(x + 1, z);
      const hD = getHeightAt(x, z - 1);
      const hU = getHeightAt(x, z + 1);

      // Sobel operator / central difference
      const dx = (hR - hL) * strength;
      const dz = (hU - hD) * strength;
      const dy = 1.0;

      // Normalize vector
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const nx = dx / len;
      const ny = dy / len;
      const nz = dz / len;

      // Convert -1..1 vector to 0..255 RGB
      const r = Math.floor((nx * 0.5 + 0.5) * 255);
      const g = Math.floor((nz * 0.5 + 0.5) * 255); // inverted for OpenGL/Three.js
      const b = Math.floor((ny * 0.5 + 0.5) * 255);

      const pIdx = (z * resolution + x) * 4;
      pixels[pIdx] = r;
      pixels[pIdx + 1] = g;
      pixels[pIdx + 2] = b;
      pixels[pIdx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return { canvas, dataUrl: canvas.toDataURL('image/png') };
}

/**
 * Generates Biome Splatmap (R = Layer 0/Grass, G = Layer 1/Rock, B = Layer 2/Snow)
 */
export function generateSplatmapCanvas(
  resolution: number,
  noiseSettings: NoiseSettings,
  worldSize: number = 200,
  heightGrid?: Float32Array
): { canvas: HTMLCanvasElement; dataUrl: string } {
  const canvas = document.createElement('canvas');
  canvas.width = resolution;
  canvas.height = resolution;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(resolution, resolution);
  const pixels = imgData.data;

  const noise2D = createSeededNoise(noiseSettings.seed);

  const getHeightAt = (x: number, z: number): number => {
    if (x < 0 || x >= resolution || z < 0 || z >= resolution) return 0;
    const idx = z * resolution + x;
    if (heightGrid && heightGrid.length === resolution * resolution) {
      return heightGrid[idx];
    }
    const worldX = (x / (resolution - 1) - 0.5) * worldSize;
    const worldZ = (z / (resolution - 1) - 0.5) * worldSize;
    return getProceduralHeight(worldX, worldZ, noiseSettings, noise2D, worldSize);
  };

  for (let z = 0; z < resolution; z++) {
    for (let x = 0; x < resolution; x++) {
      const h = getHeightAt(x, z);
      const hL = getHeightAt(x - 1, z);
      const hR = getHeightAt(x + 1, z);
      const hD = getHeightAt(x, z - 1);
      const hU = getHeightAt(x, z + 1);

      const dx = (hR - hL) * 2.0;
      const dz = (hU - hD) * 2.0;
      const slope = 1.0 - 1.0 / (1.0 + Math.sqrt(dx * dx + dz * dz)); // 0 = flat, 1 = cliff

      const hNorm = Math.min(1.0, Math.max(0.0, h / noiseSettings.heightMultiplier));

      // Layer 0: Flat ground (Red channel)
      // Layer 1: Steep cliffs (Green channel)
      // Layer 2: High peaks / Snow (Blue channel)

      const rockWeight = Math.min(1.0, slope * 2.5);
      const snowWeight = Math.max(0.0, (hNorm - 0.6) * 2.5);
      const grassWeight = Math.max(0.0, 1.0 - rockWeight - snowWeight);

      const pIdx = (z * resolution + x) * 4;
      pixels[pIdx] = Math.floor(grassWeight * 255);
      pixels[pIdx + 1] = Math.floor(rockWeight * 255);
      pixels[pIdx + 2] = Math.floor(snowWeight * 255);
      pixels[pIdx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return { canvas, dataUrl: canvas.toDataURL('image/png') };
}
