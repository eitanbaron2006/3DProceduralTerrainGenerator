import { ErosionSettings } from '../types';

/**
 * Simulates Particle Hydraulic Erosion on a 2D Heightmap Grid (width x height)
 */
export function simulateHydraulicErosion(
  grid: Float32Array,
  width: number,
  height: number,
  settings: ErosionSettings
): Float32Array {
  const result = new Float32Array(grid);
  const { droplets, erosionRate, depositionRate, evaporationRate, inertia, gravity, radius } = settings;

  // Pre-calculate brush index offsets for droplet erosion radius
  const brushIndices: number[][] = [];
  const brushWeights: number[][] = [];

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const sqrDst = dx * dx + dy * dy;
      if (sqrDst <= radius * radius) {
        const weight = 1 - Math.sqrt(sqrDst) / radius;
        brushIndices.push([dx, dy]);
        brushWeights.push([weight]);
      }
    }
  }

  // Run particle simulation droplets
  for (let iteration = 0; iteration < droplets; iteration++) {
    // Random starting position on map
    let posX = Math.random() * (width - 2) + 1;
    let posY = Math.random() * (height - 2) + 1;

    let dirX = 0;
    let dirY = 0;
    let speed = 1.0;
    let water = 1.0;
    let sediment = 0.0;

    const maxLifetime = 30;

    for (let step = 0; step < maxLifetime; step++) {
      const nodeX = Math.floor(posX);
      const nodeY = Math.floor(posY);
      const u = posX - nodeX;
      const v = posY - nodeY;

      // Calculate height and gradients at current droplet position via bilinear interpolation
      const idx00 = nodeY * width + nodeX;
      const idx10 = idx00 + 1;
      const idx01 = idx00 + width;
      const idx11 = idx01 + 1;

      if (nodeX < 0 || nodeX >= width - 1 || nodeY < 0 || nodeY >= height - 1) {
        break;
      }

      const h00 = result[idx00];
      const h10 = result[idx10];
      const h01 = result[idx01];
      const h11 = result[idx11];

      // Calculate height gradient
      const gradX = (h10 - h00) * (1 - v) + (h11 - h01) * v;
      const gradY = (h01 - h00) * (1 - u) + (h11 - h10) * u;

      // Calculate height at position
      const heightAtPos = h00 * (1 - u) * (1 - v) + h10 * u * (1 - v) + h01 * (1 - u) * v + h11 * u * v;

      // Update droplet direction with inertia
      dirX = dirX * inertia - gradX * (1 - inertia);
      dirY = dirY * inertia - gradY * (1 - inertia);

      // Normalize direction
      const len = Math.sqrt(dirX * dirX + dirY * dirY);
      if (len !== 0) {
        dirX /= len;
        dirY /= len;
      } else {
        // Random direction if flat slope
        dirX = (Math.random() - 0.5) * 2;
        dirY = (Math.random() - 0.5) * 2;
      }

      const newPosX = posX + dirX;
      const newPosY = posY + dirY;

      if (newPosX < 0 || newPosX >= width - 1 || newPosY < 0 || newPosY >= height - 1) {
        break;
      }

      // Calculate height at new position
      const newNodeX = Math.floor(newPosX);
      const newNodeY = Math.floor(newPosY);
      const newU = newPosX - newNodeX;
      const newV = newPosY - newNodeY;

      const newIdx00 = newNodeY * width + newNodeX;
      const newIdx10 = newIdx00 + 1;
      const newIdx01 = newIdx00 + width;
      const newIdx11 = newIdx01 + 1;

      const newHeightAtPos =
        result[newIdx00] * (1 - newU) * (1 - newV) +
        result[newIdx10] * newU * (1 - newV) +
        result[newIdx01] * (1 - newU) * newV +
        result[newIdx11] * newU * newV;

      const deltaHeight = newHeightAtPos - heightAtPos;

      // Calculate sediment capacity (higher speed & steep drop = higher capacity)
      const sedimentCapacity = Math.max(-deltaHeight, 0.01) * speed * water * 4.0;

      if (sediment > sedimentCapacity || deltaHeight > 0) {
        // Deposit sediment
        const depositAmount =
          deltaHeight > 0
            ? Math.min(deltaHeight, sediment)
            : (sediment - sedimentCapacity) * depositionRate;

        sediment -= depositAmount;
        result[idx00] += depositAmount * (1 - u) * (1 - v);
        result[idx10] += depositAmount * u * (1 - v);
        result[idx01] += depositAmount * (1 - u) * v;
        result[idx11] += depositAmount * u * v;
      } else {
        // Erode soil
        const erodeAmount = Math.min((sedimentCapacity - sediment) * erosionRate, -deltaHeight);

        sediment += erodeAmount;
        result[idx00] -= erodeAmount * (1 - u) * (1 - v);
        result[idx10] -= erodeAmount * u * (1 - v);
        result[idx01] -= erodeAmount * (1 - u) * v;
        result[idx11] -= erodeAmount * u * v;
      }

      // Update speed & water
      speed = Math.sqrt(Math.max(0, speed * speed + deltaHeight * gravity));
      water *= 1 - evaporationRate;

      posX = newPosX;
      posY = newPosY;
    }
  }

  return result;
}

/**
 * Thermal Weathering / Scree slope relaxation
 */
export function simulateThermalErosion(
  grid: Float32Array,
  width: number,
  height: number,
  talusAngle: number = 0.08,
  strength: number = 0.5
): Float32Array {
  const result = new Float32Array(grid);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const currentH = grid[idx];

      let maxDiff = 0;
      let targetX = x;
      let targetY = y;

      // Check 4-neighbors
      const neighbors = [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1]
      ];

      for (const [nx, ny] of neighbors) {
        const nIdx = ny * width + nx;
        const diff = currentH - grid[nIdx];
        if (diff > maxDiff) {
          maxDiff = diff;
          targetX = nx;
          targetY = ny;
        }
      }

      if (maxDiff > talusAngle) {
        const moveAmount = (maxDiff - talusAngle) * 0.5 * strength;
        result[idx] -= moveAmount;
        result[targetY * width + targetX] += moveAmount;
      }
    }
  }

  return result;
}
