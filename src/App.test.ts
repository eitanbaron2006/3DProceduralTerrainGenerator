import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_BIOME_ID,
  DEFAULT_ENVIRONMENT_ID,
  DEFAULT_NOISE_SETTINGS,
  DEFAULT_WATER_SETTINGS
} from './App';

test('starts in the ocean island presentation shown in the reference screenshots', () => {
  assert.equal(DEFAULT_BIOME_ID, 'tropical');
  assert.equal(DEFAULT_ENVIRONMENT_ID, 'sky-on-fire');
  assert.equal(DEFAULT_NOISE_SETTINGS.islandGradient, true);
  assert.ok(DEFAULT_NOISE_SETTINGS.heightMultiplier <= 28);
  assert.ok(DEFAULT_WATER_SETTINGS.waveHeight <= 0.45);
  assert.ok(DEFAULT_WATER_SETTINGS.waveSpeed <= 0.8);
});
