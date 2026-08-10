import * as THREE from 'three';
import { BiomeConfig } from '../types';

/**
 * Creates custom GLSL Terrain Material with slope & height biome blending
 */
export function createCustomTerrainMaterial(biome: BiomeConfig, wireframe: boolean = false): THREE.ShaderMaterial {
  // Extract layer colors
  const color0 = new THREE.Color(biome.layers[0]?.color || '#3b7a36');
  const color1 = new THREE.Color(biome.layers[1]?.color || '#8c8c8c');
  const color2 = new THREE.Color(biome.layers[2]?.color || '#ffffff');

  const vertexShader = /* glsl */ `
    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying vec2 vUv;
    varying float vElevation;

    void main() {
      vUv = uv;
      // World space normal for proper lighting and slope calculations
      vNormal = normalize(mat3(modelMatrix) * normal);
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPos.xyz;
      vElevation = position.y;

      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform vec3 uColorLow;
    uniform vec3 uColorMid;
    uniform vec3 uColorHigh;
    uniform vec3 uSunDirection;
    uniform vec3 uSunColor;
    uniform vec3 uFogColor;
    uniform float uFogDensity;
    uniform float uHeightScale;

    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying vec2 vUv;
    varying float vElevation;

    // Pseudo noise for surface micro-detail
    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    void main() {
      vec3 norm = normalize(vNormal);

      // Calculate world slope (1 = flat ground, 0 = vertical cliff)
      float slope = clamp(dot(norm, vec3(0.0, 1.0, 0.0)), 0.0, 1.0);
      
      // Normalized height 0..1
      float heightNorm = clamp(vElevation / max(1.0, uHeightScale), 0.0, 1.0);

      // Micro noise detail
      float noiseVal = hash(vWorldPosition.xz * 0.2) * 0.06;

      // Base biome color selection
      vec3 baseColor = uColorLow;

      // Height blend (Low -> Mid)
      float midFactor = smoothstep(0.12, 0.45, heightNorm + noiseVal);
      baseColor = mix(baseColor, uColorMid, midFactor);

      // Height blend (Mid -> High)
      float highFactor = smoothstep(0.55, 0.85, heightNorm + noiseVal);
      baseColor = mix(baseColor, uColorHigh, highFactor);

      // Slope override for steep cliffs
      float cliffFactor = 1.0 - smoothstep(0.3, 0.7, slope);
      baseColor = mix(baseColor, uColorMid * 0.75, cliffFactor);

      // Directional Sun lighting calculation in world space
      vec3 sunDir = normalize(uSunDirection);
      float diff = max(dot(norm, sunDir), 0.0);
      vec3 ambient = vec3(0.35, 0.38, 0.42);
      vec3 diffuse = uSunColor * diff * 0.8;

      vec3 finalColor = baseColor * (ambient + diffuse);

      // Distance Fog (soft atmosphere beyond 200m)
      float dist = length(vWorldPosition - cameraPosition);
      float fogFactor = smoothstep(180.0, 700.0, dist) * 0.6;
      finalColor = mix(finalColor, uFogColor, clamp(fogFactor, 0.0, 0.6));

      gl_FragColor = vec4(finalColor, 1.0);
    }
  `;

  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    wireframe,
    uniforms: {
      uColorLow: { value: color0 },
      uColorMid: { value: color1 },
      uColorHigh: { value: color2 },
      uSunDirection: { value: new THREE.Vector3(120, 180, 80).normalize() },
      uSunColor: { value: new THREE.Color(biome.sunColor) },
      uFogColor: { value: new THREE.Color(biome.fogColor) },
      uFogDensity: { value: 0.0004 },
      uHeightScale: { value: 40.0 }
    }
  });
}

/**
 * Creates custom GLSL Water Shader with animated waves, foam, Fresnel reflection
 */
export function createCustomWaterMaterial(biome: BiomeConfig): THREE.ShaderMaterial {
  const waterColor = new THREE.Color(biome.waterColor);
  const foamColor = new THREE.Color(biome.waterFoamColor);

  const vertexShader = /* glsl */ `
    uniform float uTime;
    uniform float uWaveSpeed;
    uniform float uWaveHeight;

    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying vec2 vUv;

    void main() {
      vUv = uv;
      vec3 pos = position;

      // Animated wave displacement
      float wave = sin(pos.x * 0.15 + uTime * uWaveSpeed) * cos(pos.z * 0.15 + uTime * uWaveSpeed * 0.8);
      wave += sin(pos.x * 0.3 - uTime * uWaveSpeed * 1.2) * 0.5;
      pos.y += wave * uWaveHeight;

      vec4 worldPos = modelMatrix * vec4(pos, 1.0);
      vWorldPosition = worldPos.xyz;

      // World space wave normal
      vec3 n = vec3(
        -cos(pos.x * 0.15 + uTime * uWaveSpeed) * 0.15 * uWaveHeight,
        1.0,
        -sin(pos.z * 0.15 + uTime * uWaveSpeed) * 0.15 * uWaveHeight
      );
      vNormal = normalize(mat3(modelMatrix) * n);

      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform vec3 uWaterColor;
    uniform vec3 uFoamColor;
    uniform float uTime;
    uniform vec3 uSunDirection;
    uniform vec3 uFogColor;
    uniform float uFogDensity;

    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying vec2 vUv;

    void main() {
      vec3 norm = normalize(vNormal);
      vec3 viewDir = normalize(cameraPosition - vWorldPosition);

      // Fresnel reflection factor
      float fresnel = pow(1.0 - max(dot(viewDir, norm), 0.0), 3.0);

      // Base water color mix with sky reflection
      vec3 col = mix(uWaterColor, vec3(0.7, 0.85, 1.0), fresnel * 0.5);

      // Sun specular highlight
      vec3 sunDir = normalize(uSunDirection);
      vec3 halfDir = normalize(sunDir + viewDir);
      float spec = pow(max(dot(norm, halfDir), 0.0), 128.0);
      col += vec3(1.0, 0.95, 0.8) * spec * 0.8;

      // Shoreline foam pattern simulation
      float foamNoise = sin(vWorldPosition.x * 2.0 + uTime * 3.0) * cos(vWorldPosition.z * 2.0 + uTime * 2.0);
      if (foamNoise > 0.6) {
        col = mix(col, uFoamColor, 0.4);
      }

      // Distance fog (soft atmosphere beyond 200m)
      float dist = length(vWorldPosition - cameraPosition);
      float fogFactor = smoothstep(180.0, 700.0, dist) * 0.6;
      col = mix(col, uFogColor, clamp(fogFactor, 0.0, 0.6));

      gl_FragColor = vec4(col, 0.85);
    }
  `;

  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uWaterColor: { value: waterColor },
      uFoamColor: { value: foamColor },
      uTime: { value: 0 },
      uWaveSpeed: { value: 1.5 },
      uWaveHeight: { value: 0.8 },
      uSunDirection: { value: new THREE.Vector3(120, 180, 80).normalize() },
      uFogColor: { value: new THREE.Color(biome.fogColor) },
      uFogDensity: { value: 0.0004 }
    }
  });
}
