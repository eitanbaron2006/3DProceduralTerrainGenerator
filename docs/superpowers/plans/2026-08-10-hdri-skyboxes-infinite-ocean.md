# HDRI Skyboxes and Infinite Ocean Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bundle four selectable HDRI skyboxes and render a camera-following ocean that reaches the horizon without visible edges.

**Architecture:** Keep environment selection as independent application state backed by a focused preset catalog. `Viewport3D` owns asynchronous HDR loading, GPU cleanup, scene background/environment assignment, and camera-follow water positioning; the custom water shader samples the loaded equirectangular texture for reflections.

**Tech Stack:** React 19, TypeScript, Three.js 0.185, GLSL, Node test runner through `tsx`, Vite.

---

### Task 1: Bundle the approved HDRI assets

**Files:**
- Create: `public/hdri/lakeside_sunrise_1k.hdr`
- Create: `public/hdri/table_mountain_2_1k.hdr`
- Create: `public/hdri/the_sky_is_on_fire_1k.hdr`
- Create: `public/hdri/rogland_clear_night_1k.hdr`
- Create: `public/hdri/LICENSE.md`

- [ ] **Step 1: Download the four 1K HDR files**

Use Poly Haven's direct asset URLs with the user agent `3DProceduralTerrainGenerator/1.0`:

```text
https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/lakeside_sunrise_1k.hdr
https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/table_mountain_2_1k.hdr
https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/the_sky_is_on_fire_1k.hdr
https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/rogland_clear_night_1k.hdr
```

- [ ] **Step 2: Verify the downloaded files**

Run:

```powershell
Get-FileHash -Algorithm MD5 public/hdri/*.hdr
```

Expected hashes by filename:

```text
lakeside_sunrise_1k.hdr     895A70A3730B8746991FDDBF288282A2
table_mountain_2_1k.hdr     490DB1312551C8EEE54C10EE5F646A90
the_sky_is_on_fire_1k.hdr   61A167446D21D16FC68328475E889419
rogland_clear_night_1k.hdr  509BF6A02213F0BF068EBF7FC56D45B1
```

- [ ] **Step 3: Add the license manifest**

Record each Poly Haven asset page URL and the CC0 license URL in `public/hdri/LICENSE.md`.

- [ ] **Step 4: Commit the assets**

```bash
git add public/hdri
git commit -m "assets: bundle cinematic HDRI environments"
```

### Task 2: Define environment presets and application state

**Files:**
- Create: `src/data/environments.test.ts`
- Create: `src/data/environments.ts`
- Modify: `src/types.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write the failing preset lookup test**

```ts
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
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npx tsx --test src/data/environments.test.ts`

Expected: FAIL because the environment catalog and lookup do not exist.

- [ ] **Step 3: Implement the typed catalog**

Add to `src/types.ts`:

```ts
export type EnvironmentId = 'lakeside-sunrise' | 'table-mountain' | 'sky-on-fire' | 'clear-night';

export interface EnvironmentPreset {
  id: EnvironmentId;
  name: string;
  timeOfDay: string;
  hdrPath: string;
}
```

Create `src/data/environments.ts` with the four approved presets and:

```ts
export function getEnvironmentPreset(id: string): EnvironmentPreset {
  return ENVIRONMENT_PRESETS.find((preset) => preset.id === id) ?? ENVIRONMENT_PRESETS[0];
}
```

Initialize `environmentId` in `App` to `lakeside-sunrise`, resolve it with `getEnvironmentPreset`, and pass the selected preset to `Viewport3D`.

- [ ] **Step 4: Run the test and verify GREEN**

Run: `npx tsx --test src/data/environments.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the catalog and state**

```bash
git add src/types.ts src/data/environments.ts src/data/environments.test.ts src/App.tsx
git commit -m "feat: add selectable HDRI environment state"
```

### Task 3: Add the manual HDRI selector

**Files:**
- Modify: `src/components/Sidebar/BiomeControls.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add selector props**

Extend `BiomeControlsProps` with:

```ts
environments: EnvironmentPreset[];
selectedEnvironmentId: EnvironmentId;
onSelectEnvironment: (id: EnvironmentId) => void;
```

- [ ] **Step 2: Render the selector**

Add a two-column `HDRI Skybox` button grid. Each button uses `aria-pressed={isSelected}` and the existing cyan selected-state classes. Wire `App` to pass the catalog, selected ID, and state setter.

- [ ] **Step 3: Verify TypeScript**

Run: `npm run lint`

Expected: exit 0.

- [ ] **Step 4: Commit the selector**

```bash
git add src/App.tsx src/components/Sidebar/BiomeControls.tsx
git commit -m "feat: add HDRI skybox selector"
```

### Task 4: Load, switch, and dispose HDR environments

**Files:**
- Modify: `src/components/Viewport3D.tsx`
- Modify: `src/utils/shaders.ts`
- Create: `src/utils/shaders.test.ts`

- [ ] **Step 1: Write the failing water-environment uniform test**

```ts
test('water material exposes an optional HDR environment texture', () => {
  const material = createCustomWaterMaterial(BIOME_PRESETS[0]);
  assert.ok(material.uniforms.uEnvironmentMap);
  assert.equal(material.uniforms.uHasEnvironment.value, false);
  material.dispose();
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npx tsx --test src/utils/shaders.test.ts`

Expected: FAIL because the environment uniforms do not exist.

- [ ] **Step 3: Extend the water shader**

Add `uEnvironmentMap` and `uHasEnvironment` uniforms. Convert the reflected view vector to equirectangular UV coordinates with `atan` and `asin`, sample the HDR texture, and Fresnel-mix it into the water color only when `uHasEnvironment` is true.

- [ ] **Step 4: Implement the HDR lifecycle**

Import `RGBELoader`, accept an `environment: EnvironmentPreset` prop, and add an effect that:

```ts
const loadId = ++environmentLoadIdRef.current;
new RGBELoader().load(environment.hdrPath, (texture) => {
  if (loadId !== environmentLoadIdRef.current) {
    texture.dispose();
    return;
  }
  texture.mapping = THREE.EquirectangularReflectionMapping;
  const target = pmremGenerator.fromEquirectangular(texture);
  scene.background = texture;
  scene.environment = target.texture;
  waterMaterialRef.current?.uniforms.uEnvironmentMap.value = texture;
  waterMaterialRef.current?.uniforms.uHasEnvironment.value = true;
});
```

Dispose the previous HDR texture and PMREM target when replacing them or unmounting. On error, restore the biome sky color, clear `scene.environment`, and keep color-only water.

- [ ] **Step 5: Run shader and existing viewport tests**

Run:

```bash
npx tsx --test src/utils/shaders.test.ts src/components/Viewport3D.test.ts
```

Expected: both tests PASS.

- [ ] **Step 6: Commit HDR rendering**

```bash
git add src/components/Viewport3D.tsx src/utils/shaders.ts src/utils/shaders.test.ts
git commit -m "feat: render HDRI backgrounds and water reflections"
```

### Task 5: Make the ocean follow the camera

**Files:**
- Modify: `src/components/Viewport3D.test.ts`
- Modify: `src/components/Viewport3D.tsx`
- Modify: `src/utils/shaders.ts`

- [ ] **Step 1: Write the failing snapped-position test**

```ts
test('snaps the infinite ocean origin around positive and negative camera positions', () => {
  assert.deepEqual(getInfiniteWaterPosition(17, -17, 16), { x: 16, z: -16 });
  assert.deepEqual(getInfiniteWaterPosition(-9, 9, 16), { x: -16, z: 16 });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npx tsx --test src/components/Viewport3D.test.ts`

Expected: FAIL because `getInfiniteWaterPosition` does not exist.

- [ ] **Step 3: Implement camera-follow positioning**

```ts
export function getInfiniteWaterPosition(x: number, z: number, snapSize = 16) {
  return {
    x: Math.round(x / snapSize) * snapSize,
    z: Math.round(z / snapSize) * snapSize
  };
}
```

Build a 3,200-meter water plane. In the animation loop, update its X/Z position from the helper and leave Y at `water.level`.

- [ ] **Step 4: Anchor waves in world space and blend the horizon**

Calculate wave phase from the model-transformed base position rather than local `position`. Blend distant water toward `uFogColor` between 900 and 1,500 meters.

- [ ] **Step 5: Run the viewport test and verify GREEN**

Run: `npx tsx --test src/components/Viewport3D.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the infinite ocean**

```bash
git add src/components/Viewport3D.tsx src/components/Viewport3D.test.ts src/utils/shaders.ts
git commit -m "feat: extend ocean continuously to the horizon"
```

### Task 6: Full verification

**Files:**
- Modify only if verification reveals a defect in the planned behavior.

- [ ] **Step 1: Run all automated checks**

```powershell
npx tsx --test src/**/*.test.ts
npm run lint
npm run build
git diff --check
```

Expected: all tests pass, TypeScript exits 0, Vite build exits 0, and `git diff --check` exits 0.

- [ ] **Step 2: Verify in the browser**

At `http://127.0.0.1:3000/`, verify one canvas, rendered terrain, visible ocean to the horizon, four unique HDRI controls, correct selected state after each click, and zero console errors.

- [ ] **Step 3: Review repository status**

Run: `git status --short`

Expected: only intentionally uncommitted user-owned files remain.
