import assert from 'node:assert/strict';
import test from 'node:test';
import { BIOME_PRESETS } from '../data/biomes';
import { createCustomWaterMaterial } from './shaders';

test('water material exposes an optional HDR environment texture', () => {
  const material = createCustomWaterMaterial(BIOME_PRESETS[0]);

  assert.ok(material.uniforms.uEnvironmentMap);
  assert.equal(material.uniforms.uHasEnvironment.value, false);
  assert.ok(material.uniforms.uWaterNormalMap);
  assert.equal(material.uniforms.uHasWaterNormalMap.value, false);
  assert.match(material.fragmentShader, /sampleNormalLayer/);

  material.dispose();
});

test('water material uses deep scattering, multidirectional waves, and no offshore foam', () => {
  const material = createCustomWaterMaterial(BIOME_PRESETS[0]);

  assert.ok(material.uniforms.uDeepWaterColor);
  assert.ok(material.uniforms.uSurfaceWaterColor);
  assert.match(material.fragmentShader, /accumulateWaveSlope/);
  assert.match(material.fragmentShader, /float fresnelSchlick/);
  assert.doesNotMatch(material.fragmentShader, /foam/i);
  assert.equal(material.transparent, false);
  assert.equal(material.depthWrite, true);

  material.dispose();
});
