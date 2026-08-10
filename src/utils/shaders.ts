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
  const foamColor = new THREE.Color(biome.waterFoamColor);
  const deepWaterColor = waterColor
    .clone()
    .multiplyScalar(0.18)
    .lerp(new THREE.Color('#041725'), 0.72);
  const surfaceWaterColor = waterColor
    .clone()
    .multiplyScalar(0.42)
    .lerp(new THREE.Color('#164d5f'), 0.5);
  const shallowWaterColor = waterColor
    .clone()
    .lerp(new THREE.Color('#48c7ba'), 0.58);

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
    uniform vec3 uShallowWaterColor;
    uniform vec3 uFoamColor;
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

    varying vec3 vWorldPosition;

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
      vec2 swellWarp = vec2(
        ripple(point, vec2(0.91, 0.21), 0.012, 0.07),
        ripple(point, vec2(-0.28, 0.96), 0.01, -0.055)
      ) * 4.2;
      vec2 warpedPoint = point + swellWarp;

      if (uHasWaterNormalMap) {
        vec2 normalDetail = sampleNormalLayer(
          warpedPoint,
          0.0075,
          vec2(0.004, -0.002),
          0.21
        ) * 0.7;
        return normalDetail;
      }

      return vec2(
        ripple(warpedPoint, vec2(0.78, 0.31), 0.035, 0.16),
        ripple(warpedPoint, vec2(-0.22, 0.91), 0.029, -0.12)
      ) * 0.45;
    }

    void main() {
      float distanceToCamera = length(vWorldPosition - cameraPosition);
      float distantDetail = 1.0 - smoothstep(700.0, 6200.0, distanceToCamera);
      float horizonBlend = smoothstep(700.0, 6200.0, distanceToCamera);

      vec2 point = vWorldPosition.xz;
      vec2 fineNormals = blendNormalLayers(point);
      vec2 broadSwell = vec2(
        ripple(point, vec2(0.82, 0.31), 0.019, 0.12),
        ripple(point, vec2(-0.22, 0.91), 0.017, -0.09)
      ) * 0.04;

      float normalFade = mix(0.18, 1.0, distantDetail);
      vec2 slope = (fineNormals * 0.42 + broadSwell) * uWaveHeight * uNormalStrength * normalFade;

      vec3 norm = normalize(vec3(-slope.x, 1.0, -slope.y));
      vec3 viewDir = normalize(cameraPosition - vWorldPosition);
      float facing = clamp(dot(viewDir, norm), 0.0, 1.0);
      float fresnel = fresnelSchlick(facing, 0.02);

      vec3 sunDir = normalize(uSunDirection);
      float sunFacing = max(dot(norm, sunDir), 0.0);
      float windVariation = ripple(point, vec2(0.37, 0.93), 0.006, 0.04) * 0.5 + 0.5;
      float islandDistance = length(point);
      float reefBand = smoothstep(34.0, 58.0, islandDistance)
        * (1.0 - smoothstep(78.0, 118.0, islandDistance));
      float brokenFoam = ripple(point, vec2(0.68, -0.74), 0.16, 0.18) * 0.55
        + ripple(point, vec2(-0.21, 0.98), 0.11, -0.12) * 0.45;
      float shoreFoam = reefBand * smoothstep(0.52, 0.88, brokenFoam) * (1.0 - horizonBlend * 0.62);
      float depthTone = 0.24 + sunFacing * 0.11 + windVariation * 0.04;
      vec3 waterBody = mix(uDeepWaterColor, uSurfaceWaterColor, depthTone);
      waterBody = mix(waterBody, uShallowWaterColor, reefBand * 0.24);

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

      float reflectionWeight = mix(0.28, 0.92, fresnel);
      reflectionWeight = mix(reflectionWeight, 0.86, horizonBlend * 0.72);
      reflectionWeight += reefBand * 0.08;
      vec3 col = mix(waterBody, reflectionColor, reflectionWeight);

      col = mix(col, uFoamColor, shoreFoam * 0.1);
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
      uShallowWaterColor: { value: shallowWaterColor },
      uFoamColor: { value: foamColor },
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
      uNormalStrength: { value: 0.5 },
      uReflectionStrength: { value: 1.16 }
    }
  });
}
