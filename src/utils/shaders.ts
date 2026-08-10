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

      // Distance fog uses the active skybox profile instead of a fixed haze.
      float dist = length(vWorldPosition - cameraPosition);
      float fogFactor = 1.0 - exp(-dist * uFogDensity);
      fogFactor = smoothstep(0.02, 0.82, fogFactor) * 0.72;
      finalColor = mix(finalColor, uFogColor, clamp(fogFactor, 0.0, 0.72));

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
    .multiplyScalar(0.08)
    .lerp(new THREE.Color('#041722'), 0.86);
  const surfaceWaterColor = waterColor
    .clone()
    .multiplyScalar(0.22)
    .lerp(new THREE.Color('#123946'), 0.72);

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
    uniform sampler2D uSkyReflectionMap;
    uniform bool uHasSkyReflection;
    uniform sampler2D uWaterNormalMap;
    uniform bool uHasWaterNormalMap;
    uniform float uNormalStrength;
    uniform float uReflectionStrength;
    uniform float uGlintStrength;

    varying vec3 vWorldPosition;

    const float PI = 3.14159265359;

    vec2 directionToEquirectUv(vec3 direction) {
      vec3 dir = normalize(direction);
      return vec2(
        atan(dir.z, dir.x) / (2.0 * PI) + 0.5,
        asin(clamp(dir.y, -1.0, 1.0)) / PI + 0.5
      );
    }

    float fresnelSchlick(float cosine, float reflectanceAtNormal) {
      return reflectanceAtNormal
        + (1.0 - reflectanceAtNormal) * pow(1.0 - cosine, 5.0);
    }

    float hash(vec2 p) {
      p = fract(p * vec2(443.8975, 397.2973));
      p += dot(p, p.yx + 19.19);
      return fract(p.x * p.y);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);

      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));

      return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
    }

    float fbm(vec2 p) {
      return noise(p) * 0.72 + noise(p * 1.91 + vec2(17.1, 9.2)) * 0.28;
    }

    vec2 rotateUv(vec2 point, float rotation) {
      float sine = sin(rotation);
      float cosine = cos(rotation);
      mat2 rotationMatrix = mat2(cosine, -sine, sine, cosine);
      return rotationMatrix * point;
    }

    vec2 sampleNormalLayer(vec2 point, float scale, vec2 drift, float rotation) {
      vec2 uv = rotateUv(point, rotation) * scale + drift * uTime * uWaveSpeed;
      vec3 sampledNormal = texture2D(uWaterNormalMap, uv).xyz * 2.0 - 1.0;
      return sampledNormal.xy;
    }

    vec2 blendNormalLayers(vec2 point) {
      vec2 swellWarp = vec2(
        sin(dot(point, vec2(0.0061, 0.0027)) + uTime * 0.036),
        cos(dot(point, vec2(-0.0023, 0.0057)) - uTime * 0.028)
      ) * 7.5;
      vec2 warpedPoint = point + swellWarp;

      if (uHasWaterNormalMap) {
        vec2 normalDetail = sampleNormalLayer(
          warpedPoint,
          0.008,
          vec2(0.007, -0.004),
          0.21
        ) * 0.78;
        normalDetail += sampleNormalLayer(
          warpedPoint,
          0.023,
          vec2(-0.004, 0.006),
          -0.63
        ) * 0.42;
        normalDetail += sampleNormalLayer(
          warpedPoint,
          0.055,
          vec2(0.003, 0.008),
          1.17
        ) * 0.16;
        return normalDetail;
      }

      float n0 = fbm(warpedPoint * 0.018 + uTime * 0.05);
      float n1 = fbm(warpedPoint * 0.018 + vec2(4.7, 2.9) + uTime * 0.05);
      return vec2(n0 - 0.5, n1 - 0.5) * 1.6;
    }

    void main() {
      float distanceToCamera = length(vWorldPosition - cameraPosition);
      float distantDetail = 1.0 - smoothstep(700.0, 6200.0, distanceToCamera);
      float horizonBlend = smoothstep(700.0, 6200.0, distanceToCamera);

      vec2 point = vWorldPosition.xz;
      vec2 fineNormals = blendNormalLayers(point);
      vec2 broadSwell = vec2(
        sin(dot(point, normalize(vec2(0.82, 0.31))) * 0.027 + uTime * uWaveSpeed * 0.16),
        sin(dot(point, normalize(vec2(-0.22, 0.91))) * 0.021 - uTime * uWaveSpeed * 0.11)
      ) * 0.055;

      float normalFade = mix(0.18, 1.0, distantDetail);
      vec2 slope = (fineNormals * 0.42 + broadSwell) * uWaveHeight * uNormalStrength * normalFade;

      vec3 norm = normalize(vec3(-slope.x, 1.0, -slope.y));
      vec3 viewDir = normalize(cameraPosition - vWorldPosition);
      float facing = clamp(dot(viewDir, norm), 0.0, 1.0);
      float fresnel = fresnelSchlick(facing, 0.02);

      vec3 sunDir = normalize(uSunDirection);
      float sunFacing = max(dot(norm, sunDir), 0.0);
      float windVariation = fbm(point * 0.004 + uTime * 0.01);
      float depthTone = 0.18 + sunFacing * 0.14 + windVariation * 0.07;
      vec3 waterBody = mix(uDeepWaterColor, uSurfaceWaterColor, depthTone);

      vec3 reflectionDirection = reflect(-viewDir, norm);
      vec3 reflectionColor = uSkyFallback;
      if (uHasSkyReflection) {
        reflectionColor = texture2D(
          uSkyReflectionMap,
          directionToEquirectUv(reflectionDirection)
        ).rgb;
      } else {
        float skyFacing = clamp(reflectionDirection.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 highSky = mix(uSkyFallback, vec3(0.78, 0.88, 0.94), 0.2);
        vec3 lowSky = uSkyFallback * 0.52;
        reflectionColor = mix(lowSky, highSky, skyFacing);
      }
      reflectionColor += uSunColor * pow(max(dot(normalize(reflectionDirection), sunDir), 0.0), 24.0) * 0.05;
      reflectionColor *= mix(0.68, 1.08, horizonBlend) * uReflectionStrength;

      float reflectionWeight = mix(0.16, 0.88, fresnel);
      reflectionWeight = mix(reflectionWeight, 0.84, horizonBlend * 0.55);
      vec3 col = mix(waterBody, reflectionColor, reflectionWeight);

      vec3 reflectedSun = reflect(-sunDir, norm);
      float sunGlint = max(dot(viewDir, reflectedSun), 0.0);
      float tightGlint = pow(sunGlint, 520.0);
      float broadGlint = pow(sunGlint, 96.0);
      col += uSunColor * (tightGlint * 1.1 + broadGlint * 0.05) * uGlintStrength;
      col = mix(col, uSkyFallback, horizonBlend * 0.06);

      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `;

  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: false,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 8,
    uniforms: {
      uDeepWaterColor: { value: deepWaterColor },
      uSurfaceWaterColor: { value: surfaceWaterColor },
      uSkyFallback: { value: new THREE.Color(biome.skyColor) },
      uTime: { value: 0 },
      uWaveSpeed: { value: 1.5 },
      uWaveHeight: { value: 0.8 },
      uSunDirection: { value: new THREE.Vector3(120, 180, 80).normalize() },
      uSunColor: { value: new THREE.Color(biome.sunColor) },
      uSkyReflectionMap: { value: null },
      uHasSkyReflection: { value: false },
      uWaterNormalMap: { value: null },
      uHasWaterNormalMap: { value: false },
      uNormalStrength: { value: 0.62 },
      uReflectionStrength: { value: 0.92 },
      uGlintStrength: { value: 0.7 }
    }
  });
}
