import assert from 'node:assert/strict';
import test from 'node:test';
import { BIOME_PRESETS } from '../data/biomes';
import { createCustomTerrainMaterial, createCustomWaterMaterial } from './shaders';

test('terrain material uses the configured exponential fog density', () => {
  const material = createCustomTerrainMaterial(BIOME_PRESETS[0]);

  assert.ok(material.uniforms.uFogDensity);
  assert.match(material.fragmentShader, /exp\(-dist \* uFogDensity\)/);

  material.dispose();
});

test('water material reflects a skybox-synchronized panorama when available', () => {
  const material = createCustomWaterMaterial(BIOME_PRESETS[0]);

  assert.ok(material.uniforms.uSkyReflectionMap);
  assert.equal(material.uniforms.uHasSkyReflection.value, false);
  assert.ok(material.uniforms.uWaterNormalMap);
  assert.equal(material.uniforms.uHasWaterNormalMap.value, false);
  assert.match(material.fragmentShader, /uniform sampler2D uSkyReflectionMap/);
  assert.match(material.fragmentShader, /texture2D/);
  assert.match(material.fragmentShader, /uHasSkyReflection/);
  assert.doesNotMatch(material.fragmentShader, /uEnvironmentMap/);
  assert.match(material.fragmentShader, /directionToEquirectUv/);
  assert.match(material.fragmentShader, /0\.5 - asin/);
  assert.match(material.fragmentShader, /sampleNormalLayer/);

  material.dispose();
});

test('water material uses layered animated ocean normals without fake radial reef donuts', () => {
  const material = createCustomWaterMaterial(BIOME_PRESETS[0]);

  assert.ok(material.uniforms.uDeepWaterColor);
  assert.ok(material.uniforms.uSurfaceWaterColor);
  assert.ok(material.uniforms.uNormalStrength);
  assert.ok(material.uniforms.uReflectionStrength);
  assert.match(material.fragmentShader, /blendNormalLayers/);
  assert.doesNotMatch(material.fragmentShader, /fbm/);
  assert.doesNotMatch(material.fragmentShader, /float hash/);
  assert.doesNotMatch(material.fragmentShader, /float noise/);
  const normalLayerSamples = material.fragmentShader.match(/sampleNormalLayer\(/g) ?? [];
  assert.ok(normalLayerSamples.length >= 3);
  assert.doesNotMatch(material.fragmentShader, /return normalDetail;\s*}\s*return vec2/);
  assert.doesNotMatch(material.fragmentShader, /0\.055,\s*\n\s*vec2\(0\.003, 0\.008\)/);
  assert.doesNotMatch(material.fragmentShader, /sunPath/);
  assert.doesNotMatch(material.fragmentShader, /uSunPathStrength/);
  assert.doesNotMatch(material.fragmentShader, /uGlintStrength/);
  assert.doesNotMatch(material.fragmentShader, /reefBand/);
  assert.doesNotMatch(material.fragmentShader, /shoreFoam/);
  assert.doesNotMatch(material.fragmentShader, /islandDistance \* 0\.42/);
  assert.doesNotMatch(material.fragmentShader, /accumulateWaveSlope/);
  assert.match(material.fragmentShader, /float fresnelSchlick/);
  assert.match(material.fragmentShader, /counterFlowNormals/);
  assert.equal(material.transparent, true);
  assert.equal(material.depthWrite, false);
  assert.equal(material.polygonOffset, true);
  assert.ok(material.polygonOffsetFactor >= 2);
  assert.ok(material.polygonOffsetUnits >= 8);

  material.dispose();
});

test('water material animates real wave geometry instead of only repainting a flat plane', () => {
  const material = createCustomWaterMaterial(BIOME_PRESETS[0]);

  assert.match(material.vertexShader, /uniform float uTime/);
  assert.match(material.vertexShader, /uniform float uWaveSpeed/);
  assert.match(material.vertexShader, /uniform float uWaveHeight/);
  assert.match(material.vertexShader, /dynamicWavePhase/);
  assert.match(material.vertexShader, /phaseNoise/);
  assert.match(material.vertexShader, /waveWarp/);
  assert.match(material.vertexShader, /microChop/);
  assert.match(material.vertexShader, /wavePosition/);
  assert.match(material.vertexShader, /0\.006/);
  assert.doesNotMatch(material.vertexShader, /0\.034/);
  assert.match(material.vertexShader, /worldPos\.y \+= wave \* uWaveHeight/);
  assert.match(material.vertexShader, /vWorldPosition = worldPos\.xyz/);

  material.dispose();
});

test('water normals have procedural cross motion instead of one drifting texture layer', () => {
  const material = createCustomWaterMaterial(BIOME_PRESETS[0]);

  const normalLayerSamples = material.fragmentShader.match(/sampleNormalLayer\(/g) ?? [];
  assert.ok(normalLayerSamples.length >= 3);
  assert.match(material.fragmentShader, /normalDetail \+= vec2\(/);
  assert.match(material.fragmentShader, /ripple\(warpedPoint, vec2\(0\.68, -0\.74\)/);
  assert.match(material.fragmentShader, /ripple\(warpedPoint, vec2\(-0\.21, 0\.98\)/);
  assert.ok(material.uniforms.uNormalStrength.value >= 0.95);

  material.dispose();
});

test('water material fades from transparent turquoise shallows to opaque deep water by terrain depth', () => {
  const material = createCustomWaterMaterial(BIOME_PRESETS[0]);

  assert.ok(material.uniforms.uTerrainHeightMap);
  assert.ok(material.uniforms.uHasTerrainHeightMap);
  assert.ok(material.uniforms.uTerrainWorldSize);
  assert.ok(material.uniforms.uTerrainHeightMin);
  assert.ok(material.uniforms.uTerrainHeightRange);
  assert.ok(material.uniforms.uWaterLevel);
  assert.ok(material.uniforms.uShallowDepth);
  assert.ok(material.uniforms.uDeepDepth);
  assert.ok(material.uniforms.uShallowOpacity);
  assert.ok(material.uniforms.uDeepOpacity);
  assert.ok(material.uniforms.uShallowWaterColor);
  assert.match(material.fragmentShader, /sampleTerrainHeight/);
  assert.match(material.fragmentShader, /depthMeters/);
  assert.match(material.fragmentShader, /smoothstep\(uShallowDepth, uDeepDepth, depthMeters\)/);
  assert.match(material.fragmentShader, /mix\(uShallowWaterColor, uSurfaceWaterColor, depthBlend\)/);
  assert.match(material.fragmentShader, /mix\(uShallowOpacity, uDeepOpacity, depthBlend\)/);
  assert.match(material.fragmentShader, /gl_FragColor = vec4\(col, alpha\)/);
  assert.equal(material.transparent, true);
  assert.equal(material.depthWrite, false);

  material.dispose();
});

test('water depth sampling fades out at the terrain texture bounds instead of drawing a square edge', () => {
  const material = createCustomWaterMaterial(BIOME_PRESETS[0]);

  assert.match(material.fragmentShader, /edgeBlend/);
  assert.match(material.fragmentShader, /fallbackTerrainHeight/);
  assert.match(material.fragmentShader, /return mix\(fallbackTerrainHeight, sampledTerrainHeight, edgeBlend\)/);

  material.dispose();
});
