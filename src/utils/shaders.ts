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
      float noiseVal = hash(vWorldPosition.xz * 0.2) * 0.025;

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
      vec3 ambient = vec3(0.5, 0.5, 0.46);
      vec3 diffuse = uSunColor * diff * 0.72;

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
  const shallowWaterColor = waterColor
    .clone()
    .lerp(new THREE.Color('#42d6cd'), 0.78);

  const vertexShader = /* glsl */ `
    uniform float uTime;
    uniform float uWaveSpeed;
    uniform float uWaveHeight;

    varying vec3 vWorldPosition;
    varying vec3 vWaveNormal;

    float phaseNoise(vec2 point) {
      return (
        sin(point.x * 1.37 + point.y * 0.41)
        + sin(point.x * -0.32 + point.y * 1.91 + sin(point.x * 0.27))
      ) * 0.5;
    }

    float dynamicWavePhase(vec2 point, float scale, float offset) {
      float time = uTime * uWaveSpeed;
      vec2 drift = vec2(time * 0.019 + offset, -time * 0.013 - offset);
      return phaseNoise(point * scale + drift) * 0.95
        + sin(dot(point, vec2(scale * 0.7, -scale * 0.43)) + time * 0.08 + offset) * 0.32;
    }

    vec2 waveWarp(vec2 point) {
      float time = uTime * uWaveSpeed;
      return vec2(
        sin(dot(point, vec2(0.0023, -0.0011)) + time * 0.18),
        cos(dot(point, vec2(-0.0017, 0.0020)) - time * 0.13)
      ) * 95.0;
    }

    float waveLayer(
      vec2 point,
      vec2 direction,
      float frequency,
      float speed,
      float amplitude,
      float phaseOffset
    ) {
      float phase = dynamicWavePhase(point, frequency * 0.23, phaseOffset);
      float crest = sin(dot(point, normalize(direction)) * frequency + uTime * uWaveSpeed * speed + phase);
      return crest * amplitude;
    }

    float microChop(vec2 point) {
      float time = uTime * uWaveSpeed;
      float chop = sin(dot(point, normalize(vec2(0.13, 0.99))) * 0.018 + time * 0.73);
      chop += sin(dot(point, normalize(vec2(-0.91, 0.28))) * 0.024 - time * 0.61) * 0.62;
      return chop * 0.075;
    }

    float oceanHeight(vec2 point) {
      vec2 warpedPoint = point + waveWarp(point);
      float wave = waveLayer(warpedPoint, vec2(0.82, 0.31), 0.0064, 0.82, 0.24, 1.7);
      wave += waveLayer(warpedPoint, vec2(-0.22, 0.91), 0.0049, -0.54, 0.23, -2.1);
      wave += waveLayer(point + warpedPoint * 0.18, vec2(0.41, -0.73), 0.0095, 1.04, 0.18, 4.4);
      wave += waveLayer(point - warpedPoint * 0.11, vec2(-0.67, -0.42), 0.0125, -0.82, 0.14, -5.6);
      wave += waveLayer(point + vec2(phaseNoise(point * 0.0021), phaseNoise(point * 0.0027)) * 70.0, vec2(0.16, -0.98), 0.0074, 0.37, 0.12, 8.2);
      wave += microChop(point + warpedPoint * 0.28);
      return wave;
    }

    void main() {
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vec2 wavePosition = worldPos.xz;
      float wave = oceanHeight(wavePosition);
      worldPos.y += wave * uWaveHeight;

      float normalSampleStep = 5.0;
      float heightX = oceanHeight(wavePosition + vec2(normalSampleStep, 0.0))
        - oceanHeight(wavePosition - vec2(normalSampleStep, 0.0));
      float heightZ = oceanHeight(wavePosition + vec2(0.0, normalSampleStep))
        - oceanHeight(wavePosition - vec2(0.0, normalSampleStep));
      vWaveNormal = normalize(vec3(
        -heightX * uWaveHeight,
        normalSampleStep * 2.0,
        -heightZ * uWaveHeight
      ));

      vWorldPosition = worldPos.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `;

  const fragmentShader = /* glsl */ `
    uniform vec3 uDeepWaterColor;
    uniform vec3 uSurfaceWaterColor;
    uniform vec3 uShallowWaterColor;
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
    uniform sampler2D uTerrainHeightMap;
    uniform bool uHasTerrainHeightMap;
    uniform float uTerrainWorldSize;
    uniform float uTerrainHeightMin;
    uniform float uTerrainHeightRange;
    uniform float uWaterLevel;
    uniform float uShallowDepth;
    uniform float uDeepDepth;
    uniform float uShallowOpacity;
    uniform float uDeepOpacity;

    varying vec3 vWorldPosition;
    varying vec3 vWaveNormal;

    const float PI = 3.14159265359;

    vec2 directionToEquirectUv(vec3 direction) {
      vec3 dir = normalize(direction);
      return vec2(
        atan(dir.z, dir.x) / (2.0 * PI) + 0.5,
        0.5 - asin(clamp(dir.y, -1.0, 1.0)) / PI
      );
    }

    float fresnelSchlick(float cosine, float reflectanceAtNormal) {
      return reflectanceAtNormal
        + (1.0 - reflectanceAtNormal) * pow(1.0 - cosine, 5.0);
    }

    float sampleTerrainHeight(vec2 point) {
      float fallbackTerrainHeight = uWaterLevel - uDeepDepth * 3.2;

      if (!uHasTerrainHeightMap) {
        return fallbackTerrainHeight;
      }

      vec2 terrainUv = point / uTerrainWorldSize + 0.5;
      if (
        terrainUv.x < 0.0
        || terrainUv.x > 1.0
        || terrainUv.y < 0.0
        || terrainUv.y > 1.0
      ) {
        return fallbackTerrainHeight;
      }

      float encodedHeight = texture2D(uTerrainHeightMap, terrainUv).r;
      float sampledTerrainHeight = uTerrainHeightMin + encodedHeight * uTerrainHeightRange;
      vec2 edgeDistance = min(terrainUv, 1.0 - terrainUv);
      float edgeBlend = smoothstep(0.0, 0.08, min(edgeDistance.x, edgeDistance.y));
      return mix(fallbackTerrainHeight, sampledTerrainHeight, edgeBlend);
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

    float ripple(vec2 point, vec2 direction, float scale, float speed) {
      return sin(dot(point, normalize(direction)) * scale + uTime * uWaveSpeed * speed);
    }

    vec2 blendNormalLayers(vec2 point) {
      float time = uTime * uWaveSpeed;
      vec2 swellWarp = vec2(
        sin(dot(point, vec2(0.0047, 0.0019)) + time * 0.041),
        cos(dot(point, vec2(-0.0018, 0.0042)) - time * 0.034)
      ) * 34.0;
      vec2 warpedPoint = point + swellWarp;

      vec2 normalDetail = vec2(
        ripple(warpedPoint, vec2(0.78, 0.31), 0.029, 0.16),
        ripple(warpedPoint, vec2(-0.22, 0.91), 0.023, -0.12)
      ) * 0.34;

      if (uHasWaterNormalMap) {
        vec2 normalA = sampleNormalLayer(
          warpedPoint + vec2(sin(time * 0.07), cos(time * 0.05)) * 18.0,
          0.0062,
          vec2(0.006, -0.004),
          0.31
        );
        vec2 normalB = sampleNormalLayer(
          warpedPoint * 1.43 + swellWarp.yx * 0.72,
          0.0145,
          vec2(-0.004, 0.007),
          1.78
        );
        vec2 counterFlowNormals = normalA * 0.62 + vec2(-normalB.y, normalB.x) * 0.48;
        normalDetail = mix(normalDetail, counterFlowNormals, 0.76);
      }

      normalDetail += vec2(
        ripple(warpedPoint, vec2(0.68, -0.74), 0.052, 0.34),
        ripple(warpedPoint, vec2(-0.21, 0.98), 0.043, -0.27)
      ) * 0.28;

      return normalDetail;
    }

    void main() {
      float distanceToCamera = length(vWorldPosition - cameraPosition);
      float distantDetail = 1.0 - smoothstep(700.0, 6200.0, distanceToCamera);
      float horizonBlend = smoothstep(700.0, 6200.0, distanceToCamera);

      vec2 point = vWorldPosition.xz;
      float terrainHeight = sampleTerrainHeight(point);
      float depthMeters = max(0.0, uWaterLevel - terrainHeight);
      float depthBlend = smoothstep(uShallowDepth, uDeepDepth, depthMeters);
      float bottomVisibility = 1.0 - smoothstep(1.0, 3.25, depthMeters);

      vec2 fineNormals = blendNormalLayers(point);
      vec2 broadPoint = point + vec2(
        ripple(point, vec2(-0.31, 0.95), 0.0052, 0.06),
        ripple(point, vec2(0.88, 0.47), 0.0046, -0.05)
      ) * 72.0;
      vec2 broadSwell = vec2(
        sin(dot(broadPoint, normalize(vec2(0.82, 0.31))) * 0.018 + uTime * uWaveSpeed * 0.16),
        sin(dot(broadPoint, normalize(vec2(-0.22, 0.91))) * 0.015 - uTime * uWaveSpeed * 0.11)
      ) * 0.012;

      float normalFade = mix(0.04, 0.72, distantDetail);
      vec2 slope = (fineNormals * 0.38 + broadSwell) * uWaveHeight * uNormalStrength * normalFade;

      vec3 norm = normalize(vWaveNormal + vec3(-slope.x, 0.0, -slope.y));
      vec3 viewDir = normalize(cameraPosition - vWorldPosition);
      float facing = clamp(dot(viewDir, norm), 0.0, 1.0);
      float fresnel = fresnelSchlick(facing, 0.02);

      vec3 sunDir = normalize(uSunDirection);
      float sunFacing = max(dot(norm, sunDir), 0.0);
      float windVariation = ripple(point, vec2(0.37, 0.93), 0.006, 0.04) * 0.5 + 0.5;
      vec3 waterBody = mix(uShallowWaterColor, uSurfaceWaterColor, depthBlend);
      waterBody = mix(waterBody, uDeepWaterColor, smoothstep(uDeepDepth, uDeepDepth * 2.4, depthMeters) * 0.72);
      waterBody += uSunColor * (sunFacing * 0.03 + windVariation * 0.018) * (1.0 - horizonBlend);
      waterBody = mix(waterBody, uShallowWaterColor * 1.12, bottomVisibility * 0.62);

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
      reflectionColor *= mix(0.78, 1.18, horizonBlend) * uReflectionStrength;

      float reflectionWeight = mix(0.18, 0.88, fresnel);
      reflectionWeight = mix(reflectionWeight * 0.48, reflectionWeight, depthBlend);
      reflectionWeight = mix(reflectionWeight, 0.86, horizonBlend * 0.72);
      vec3 col = mix(waterBody, reflectionColor, reflectionWeight);

      col = mix(col, uSkyFallback, horizonBlend * 0.06);

      float alpha = mix(uShallowOpacity, uDeepOpacity, depthBlend);
      alpha = mix(alpha, uShallowOpacity * 0.82, bottomVisibility * 0.42);
      alpha = mix(alpha, 0.94, horizonBlend * 0.36);
      alpha = max(alpha, smoothstep(uDeepDepth, uDeepDepth * 1.35, depthMeters) * 0.985);

      gl_FragColor = vec4(col, alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `;

  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 8,
    uniforms: {
      uDeepWaterColor: { value: deepWaterColor },
      uSurfaceWaterColor: { value: surfaceWaterColor },
      uShallowWaterColor: { value: shallowWaterColor },
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
      uNormalStrength: { value: 1.0 },
      uReflectionStrength: { value: 1.16 },
      uTerrainHeightMap: { value: null },
      uHasTerrainHeightMap: { value: false },
      uTerrainWorldSize: { value: 200 },
      uTerrainHeightMin: { value: 0 },
      uTerrainHeightRange: { value: 1 },
      uWaterLevel: { value: 8 },
      uShallowDepth: { value: 0.85 },
      uDeepDepth: { value: 5.8 },
      uShallowOpacity: { value: 0.44 },
      uDeepOpacity: { value: 0.965 }
    }
  });
}
