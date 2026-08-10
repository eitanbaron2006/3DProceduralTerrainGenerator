import assert from 'node:assert/strict';
import test from 'node:test';
import * as environmentModule from './environments';

test('resolves a known environment and falls back for an unknown id', () => {
  const presets = environmentModule.ENVIRONMENT_PRESETS;
  const lookup = environmentModule.getEnvironmentPreset;

  assert.equal(typeof lookup, 'function');
  assert.equal(lookup('table-mountain').id, 'table-mountain');
  assert.equal(lookup('missing').id, presets[0].id);
});
