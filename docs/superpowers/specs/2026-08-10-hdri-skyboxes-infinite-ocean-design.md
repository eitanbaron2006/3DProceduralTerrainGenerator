# HDRI Skyboxes and Infinite Ocean Design

## Goal

Add four locally bundled, manually selectable HDRI environments and make the existing water surface appear continuous to the camera horizon without visible mesh edges.

## Approved Experience

- Bundle the selected cinematic Poly Haven environment pack in the project so it works offline after installation.
- Provide four manual environment choices that remain independent from biome selection:
  - Lakeside Sunrise
  - Table Mountain 2
  - The Sky Is On Fire
  - Rogland Clear Night
- Put the environment selector in the existing Biomes panel.
- Keep the current biome sky color as a loading and error fallback.
- Extend the water beyond the camera view and blend it into the horizon.

## Architecture

### Environment presets

Create a focused environment preset module containing stable IDs, labels, and public HDR asset paths. `App` owns the selected environment ID and passes the resolved preset plus a change callback to the Biomes controls and the viewport. Environment selection does not mutate biome state.

### HDR loading and cleanup

`Viewport3D` loads the selected local `.hdr` file with `RGBELoader`. The original equirectangular texture becomes `scene.background`; a `PMREMGenerator` result becomes `scene.environment`. A monotonically increasing load token prevents a slower, obsolete request from replacing a newer choice. Replaced textures and render targets are disposed. A failed load restores the current biome sky color and clears the environment map.

The current custom water material receives the equirectangular HDR texture as a `sampler2D`. The fragment shader converts its reflection direction to equirectangular UV coordinates and mixes the sampled environment with the existing water color, Fresnel highlight, sun specular, foam, and fog.

### Infinite ocean illusion

Replace the 250-meter water plane with a 3,200-meter plane, large enough to cover the 1,500-meter camera far distance. During animation, recenter the plane on the camera's X/Z position using a small snap interval. Waves use world-space X/Z coordinates, so recentering does not drag the pattern with the camera. Existing depth testing preserves terrain occlusion, while the distant water color blends toward fog near the horizon.

## User Interface

The Biomes panel gains a compact two-column `HDRI Skybox` selector with four buttons. The active choice has the same cyan selection treatment used elsewhere. Each button shows a short time-of-day label; no remote thumbnail dependency is introduced.

## Assets and Licensing

Download the 1K `.hdr` variants into `public/hdri/`. Poly Haven publishes its assets under CC0, so the files can be bundled and redistributed. Add a small `public/hdri/LICENSE.md` manifest with the source asset names, URLs, and CC0 source link.

## Error Handling and Resource Safety

- Retain the biome color while the initial HDRI is loading.
- Ignore stale loader callbacks after selection changes or component cleanup.
- On load failure, use the biome sky color and report one actionable console error.
- Dispose prior HDR textures, PMREM render targets, water geometry, and water materials when replaced.
- Keep water rendering functional with a color-only fallback when no HDR texture is available.

## Testing and Verification

- Unit-test preset lookup and fallback behavior.
- Unit-test snapped camera-follow positioning for positive and negative coordinates.
- Run the existing viewport cleanup regression test.
- Run TypeScript checking and the production build.
- In the browser, verify all four environment buttons, a single WebGL canvas, rendered terrain and ocean, no visible water edge at supported camera distances, and no console errors.

## Out of Scope

- User-uploaded HDR files.
- Automatic biome-to-HDRI mapping.
- Ray-marched water or multi-ring ocean clipmaps.
- Changing the terrain export format or exporting the visual-only infinite ocean.
