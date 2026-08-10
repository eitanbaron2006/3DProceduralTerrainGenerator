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
  assert.match(material.fragmentShader, /sampleNormalLayer/);

  material.dispose();
});

test('water material uses layered normals, stable shore depth, and no offshore foam', () => {
  const material = createCustomWaterMaterial(BIOME_PRESETS[0]);

  assert.ok(material.uniforms.uDeepWaterColor);
  assert.ok(material.uniforms.uSurfaceWaterColor);
  assert.ok(material.uniforms.uNormalStrength);
  assert.ok(material.uniforms.uReflectionStrength);
  assert.match(material.fragmentShader, /blendNormalLayers/);
  assert.match(material.fragmentShader, /fbm/);
  assert.doesNotMatch(material.fragmentShader, /accumulateWaveSlope/);
  assert.match(material.fragmentShader, /float fresnelSchlick/);
  assert.doesNotMatch(material.fragmentShader, /foam/i);
  assert.equal(material.transparent, false);
  assert.equal(material.depthWrite, false);
  assert.equal(material.polygonOffset, true);
  assert.ok(material.polygonOffsetFactor >= 2);
  assert.ok(material.polygonOffsetUnits >= 8);

  material.dispose();
});
