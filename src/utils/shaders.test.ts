import assert from 'node:assert/strict';
import test from 'node:test';
import { BIOME_PRESETS } from '../data/biomes';
import { createCustomWaterMaterial } from './shaders';

test('water material exposes an optional HDR environment texture', () => {
  const material = createCustomWaterMaterial(BIOME_PRESETS[0]);

  assert.ok(material.uniforms.uEnvironmentMap);
  assert.equal(material.uniforms.uHasEnvironment.value, false);

  material.dispose();
});
