import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { BIOME_PRESETS } from './biomes';
import * as environmentModule from './environments';

test('resolves a known environment and falls back for an unknown id', () => {
  const presets = environmentModule.ENVIRONMENT_PRESETS;
  const lookup = environmentModule.getEnvironmentPreset;

  assert.equal(typeof lookup, 'function');
  assert.equal(lookup('table-mountain').id, 'table-mountain');
  assert.equal(lookup('missing').id, presets[0].id);
});

test('uses high-resolution sky-only HDRIs so the procedural world has one crisp horizon', () => {
  const presets = environmentModule.ENVIRONMENT_PRESETS;

  assert.equal(presets.length, 4);
  for (const preset of presets) {
    assert.match(preset.hdrPath, /_puresky_4k\.hdr$/);
    assert.equal(existsSync(join(process.cwd(), 'public', preset.hdrPath)), true);
    assert.match(preset.skyboxPath, /_puresky\.jpg$/);
    assert.equal(existsSync(join(process.cwd(), 'public', preset.skyboxPath)), true);
    assert.equal(preset.skyboxFacePaths.length, 6);
    for (const facePath of preset.skyboxFacePaths) {
      assert.match(facePath, /\/hdri\/cubemaps\/.+\/(px|nx|py|ny|pz|nz)\.jpg$/);
      assert.equal(existsSync(join(process.cwd(), 'public', facePath)), true);
    }
    assert.match(preset.waterReflectionPath, /\/hdri\/water-reflections\/.+\.jpg$/);
    assert.equal(existsSync(join(process.cwd(), 'public', preset.waterReflectionPath)), true);
  }
});

test('pairs each HDRI with atmosphere values that match its time of day', () => {
  const day = environmentModule.getEnvironmentPreset('table-mountain');
  const night = environmentModule.getEnvironmentPreset('clear-night');

  assert.ok(day.atmosphere.backgroundIntensity > night.atmosphere.backgroundIntensity);
  assert.ok(day.atmosphere.sunLightIntensity > night.atmosphere.sunLightIntensity);
  assert.match(night.atmosphere.fogColor, /^#[0-2][0-9a-f][0-2][0-9a-f][0-3][0-9a-f]$/i);

  for (const preset of environmentModule.ENVIRONMENT_PRESETS) {
    assert.match(preset.atmosphere.skyColor, /^#[0-9a-f]{6}$/i);
    assert.match(preset.atmosphere.fogColor, /^#[0-9a-f]{6}$/i);
    assert.match(preset.atmosphere.sunColor, /^#[0-9a-f]{6}$/i);
    assert.ok(preset.atmosphere.fogDensity >= 0);
    assert.ok(preset.atmosphere.backgroundIntensity > 0);
    assert.ok(preset.atmosphere.skyboxIntensity > 0);
    assert.ok(preset.atmosphere.environmentIntensity > 0);
    assert.equal(preset.atmosphere.sunDirection.length, 3);
    const sunLength = Math.hypot(...preset.atmosphere.sunDirection);
    assert.ok(sunLength > 0.99 && sunLength < 1.01);
    assert.ok(preset.atmosphere.sunDirection[1] > 0);
  }
});

test('can apply skybox atmosphere colors without changing the selected biome terrain', () => {
  const biome = BIOME_PRESETS[0];
  const night = environmentModule.getEnvironmentPreset('clear-night');
  const syncedBiome = environmentModule.applyEnvironmentAtmosphereToBiome(biome, night);

  assert.equal(syncedBiome.id, biome.id);
  assert.deepEqual(syncedBiome.layers, biome.layers);
  assert.equal(syncedBiome.skyColor, night.atmosphere.skyColor);
  assert.equal(syncedBiome.fogColor, night.atmosphere.fogColor);
  assert.equal(syncedBiome.sunColor, night.atmosphere.sunColor);
});
