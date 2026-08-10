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
  const deepWaterColor = waterColor
    .clone()
    .multiplyScalar(0.12)
    .lerp(new THREE.Color('#031922'), 0.78);
  const surfaceWaterColor = waterColor
    .clone()
    .multiplyScalar(0.34)
    .lerp(new THREE.Color('#0a3442'), 0.58);

  const vertexShader = /* glsl */ `
    varying vec3 vWorldPosition;

    void main() {
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPos.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform vec3 uDeepWaterColor;
    uniform vec3 uSurfaceWaterColor;
    uniform vec3 uSkyFallback;
    uniform float uTime;
    uniform float uWaveSpeed;
    uniform float uWaveHeight;
    uniform vec3 uSunDirection;
    uniform vec3 uSunColor;
    uniform sampler2D uEnvironmentMap;
    uniform bool uHasEnvironment;
    uniform sampler2D uWaterNormalMap;
    uniform bool uHasWaterNormalMap;

    varying vec3 vWorldPosition;

    const float PI = 3.14159265359;

    vec2 directionToEquirectUv(vec3 direction) {
      vec3 dir = normalize(direction);
      return vec2(
        atan(dir.z, dir.x) / (2.0 * PI) + 0.5,
        asin(clamp(dir.y, -1.0, 1.0)) / PI + 0.5
      );
    }

    vec2 accumulateWaveSlope(
      vec2 point,
      vec2 direction,
      float wavelength,
      float amplitude,
      float phaseSpeed
    ) {
      vec2 waveDirection = normalize(direction);
      float waveNumber = 2.0 * PI / wavelength;
      float phase = dot(point, waveDirection) * waveNumber
        + uTime * uWaveSpeed * phaseSpeed;
      return waveDirection * cos(phase) * waveNumber * amplitude * uWaveHeight;
    }

    float fresnelSchlick(float cosine, float reflectanceAtNormal) {
      return reflectanceAtNormal
        + (1.0 - reflectanceAtNormal) * pow(1.0 - cosine, 5.0);
    }

    vec2 sampleNormalLayer(
      vec2 point,
      float scale,
      vec2 drift,
      float rotation
    ) {
      float sine = sin(rotation);
      float cosine = cos(rotation);
      mat2 rotationMatrix = mat2(cosine, -sine, sine, cosine);
      vec2 uv = rotationMatrix * point * scale
        + drift * uTime * uWaveSpeed;
      vec3 sampledNormal = texture2D(uWaterNormalMap, uv).xyz * 2.0 - 1.0;
      return sampledNormal.xy;
    }

    void main() {
      float distanceToCamera = length(vWorldPosition - cameraPosition);
      float distantDetail = 1.0 - smoothstep(900.0, 6500.0, distanceToCamera);

      vec2 slope = vec2(0.0);
      slope += accumulateWaveSlope(vWorldPosition.xz, vec2(1.0, 0.22), 14.0, 0.55, 1.9);
      slope += accumulateWaveSlope(vWorldPosition.xz, vec2(-0.35, 1.0), 27.0, 0.75, 1.25);
      slope += accumulateWaveSlope(vWorldPosition.xz, vec2(0.62, 0.78), 51.0, 1.0, 0.72);
      slope += accumulateWaveSlope(vWorldPosition.xz, vec2(-0.9, 0.4), 113.0, 0.85, 0.38);
      slope *= 0.38;

      if (uHasWaterNormalMap) {
        vec2 normalDetail = sampleNormalLayer(
          vWorldPosition.xz,
          0.015,
          vec2(0.012, -0.008),
          0.32
        );
        normalDetail += sampleNormalLayer(
          vWorldPosition.xz,
          0.041,
          vec2(-0.009, 0.014),
          -0.71
        ) * 0.55;
        slope += normalDetail * uWaveHeight * 0.22;
      }

      slope *= mix(0.06, 1.0, distantDetail);

      vec3 norm = normalize(vec3(-slope.x, 1.0, -slope.y));
      vec3 viewDir = normalize(cameraPosition - vWorldPosition);
      float facing = clamp(dot(viewDir, norm), 0.0, 1.0);
      float fresnel = fresnelSchlick(facing, 0.02);

      vec3 sunDir = normalize(uSunDirection);
      float sunFacing = max(dot(norm, sunDir), 0.0);
      vec3 waterBody = mix(uDeepWaterColor, uSurfaceWaterColor, 0.28 + sunFacing * 0.22);

      vec3 reflectionDirection = reflect(-viewDir, norm);
      vec3 reflectionColor = uSkyFallback;
      if (uHasEnvironment) {
        reflectionColor = texture2D(
          uEnvironmentMap,
          directionToEquirectUv(reflectionDirection)
        ).rgb * 0.72;
      }

      float reflectionWeight = mix(0.08, 0.96, fresnel);
      vec3 col = mix(waterBody, reflectionColor, reflectionWeight);

      vec3 reflectedSun = reflect(-sunDir, norm);
      float tightGlint = pow(max(dot(viewDir, reflectedSun), 0.0), 420.0);
      float broadGlint = pow(max(dot(viewDir, reflectedSun), 0.0), 72.0);
      col += uSunColor * (tightGlint * 1.5 + broadGlint * 0.08);

      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `;

  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: false,
    depthWrite: true,
    uniforms: {
      uDeepWaterColor: { value: deepWaterColor },
      uSurfaceWaterColor: { value: surfaceWaterColor },
      uSkyFallback: { value: new THREE.Color(biome.skyColor) },
      uTime: { value: 0 },
      uWaveSpeed: { value: 1.5 },
      uWaveHeight: { value: 0.8 },
      uSunDirection: { value: new THREE.Vector3(120, 180, 80).normalize() },
      uSunColor: { value: new THREE.Color(biome.sunColor) },
      uEnvironmentMap: { value: null },
      uHasEnvironment: { value: false },
      uWaterNormalMap: { value: null },
      uHasWaterNormalMap: { value: false }
    }
  });
}
