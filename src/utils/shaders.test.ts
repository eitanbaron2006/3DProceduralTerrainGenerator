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

test('water material blends open-ocean foam without a binary dot pattern', () => {
  const material = createCustomWaterMaterial(BIOME_PRESETS[0]);

  assert.match(material.fragmentShader, /float foamFactor = smoothstep/);
  assert.doesNotMatch(material.fragmentShader, /if \(foamNoise > 0\.6\)/);

  material.dispose();
});
