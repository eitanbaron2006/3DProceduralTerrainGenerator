import assert from 'node:assert/strict';
import test from 'node:test';
import * as viewportModule from './Viewport3D';

test('removes the renderer canvas from the captured container', () => {
  const canvas = {} as HTMLCanvasElement;
  let child: HTMLCanvasElement | null = canvas;
  const container = {
    contains(node: Node) {
      return child === node;
    },
    removeChild<T extends Node>(node: T): T {
      assert.equal(node, canvas);
      child = null;
      return node;
    }
  };

  const removeRendererCanvas = (
    viewportModule as unknown as Record<string, unknown>
  ).removeRendererCanvas;

  assert.equal(typeof removeRendererCanvas, 'function');
  (removeRendererCanvas as (
    host: Pick<HTMLElement, 'contains' | 'removeChild'>,
    element: HTMLCanvasElement
  ) => void)(container, canvas);
  assert.equal(child, null);
});

test('snaps the infinite ocean origin around positive and negative camera positions', () => {
  const getInfiniteWaterPosition = (
    viewportModule as unknown as Record<string, unknown>
  ).getInfiniteWaterPosition;

  assert.equal(typeof getInfiniteWaterPosition, 'function');
  const getPosition = getInfiniteWaterPosition as (
    x: number,
    z: number,
    snapSize?: number
  ) => { x: number; z: number };

  assert.deepEqual(getPosition(17, -17, 16), { x: 16, z: -16 });
  assert.deepEqual(getPosition(-9, 9, 16), { x: -16, z: 16 });
});

test('keeps the default horizon centered and the ocean cutoff below half a percent', () => {
  const getOceanViewConfig = (
    viewportModule as unknown as Record<string, unknown>
  ).getOceanViewConfig;

  assert.equal(typeof getOceanViewConfig, 'function');
  const sunsetSunDirection: [number, number, number] = [0.8073, 0.1794, 0.5623];
  const config = (getOceanViewConfig as (
    seaLevel: number,
    sunDirection?: [number, number, number]
  ) => {
    cameraPosition: { x: number; y: number; z: number };
    target: { x: number; y: number; z: number };
    cameraNear: number;
    cameraFar: number;
    oceanSize: number;
    maxDistance: number;
    horizonGapFraction: number;
  })(8, sunsetSunDirection);

  assert.equal(config.cameraPosition.y, config.target.y);
  const forwardX = config.target.x - config.cameraPosition.x;
  const forwardZ = config.target.z - config.cameraPosition.z;
  const forwardLength = Math.hypot(forwardX, forwardZ);
  const forwardDotSun =
    (forwardX / forwardLength) * sunsetSunDirection[0]
    + (forwardZ / forwardLength) * sunsetSunDirection[2];
  assert.ok(forwardDotSun > 0.98);
  assert.ok(config.maxDistance >= 900);
  assert.ok(config.cameraNear >= 1);
  assert.ok(config.cameraFar / config.cameraNear <= 10000);
  assert.ok(config.oceanSize / 2 > config.cameraFar);
  assert.ok(config.horizonGapFraction < 0.005);
});

test('renders visible HDRI skyboxes from the same equirectangular texture used by water', () => {
  const getSkyboxRenderConfig = (
    viewportModule as unknown as Record<string, unknown>
  ).getSkyboxRenderConfig;

  assert.equal(typeof getSkyboxRenderConfig, 'function');
  const config = (getSkyboxRenderConfig as () => {
    backgroundBlurriness: number;
    mapping: string;
    colorSpace: string;
    minFilter: string;
    magFilter: string;
    generateMipmaps: boolean;
  })();

  assert.equal(config.backgroundBlurriness, 0);
  assert.equal(config.mapping, 'EquirectangularReflectionMapping');
  assert.equal(config.colorSpace, 'SRGBColorSpace');
  assert.equal(config.minFilter, 'LinearFilter');
  assert.equal(config.magFilter, 'LinearFilter');
  assert.equal(config.generateMipmaps, false);
});

test('loads water reflections as skybox-synchronized panorama textures', () => {
  const getWaterReflectionTextureConfig = (
    viewportModule as unknown as Record<string, unknown>
  ).getWaterReflectionTextureConfig;

  assert.equal(typeof getWaterReflectionTextureConfig, 'function');
  const config = (getWaterReflectionTextureConfig as () => {
    mapping: string;
    colorSpace: string;
    wrapS: string;
    wrapT: string;
    minFilter: string;
    magFilter: string;
    generateMipmaps: boolean;
  })();

  assert.equal(config.mapping, 'EquirectangularReflectionMapping');
  assert.equal(config.colorSpace, 'SRGBColorSpace');
  assert.equal(config.wrapS, 'RepeatWrapping');
  assert.equal(config.wrapT, 'ClampToEdgeWrapping');
  assert.equal(config.minFilter, 'LinearFilter');
  assert.equal(config.magFilter, 'LinearFilter');
  assert.equal(config.generateMipmaps, false);
});

test('uses renderer settings that preserve viewport performance', () => {
  const getRendererQualityConfig = (
    viewportModule as unknown as Record<string, unknown>
  ).getRendererQualityConfig;

  assert.equal(typeof getRendererQualityConfig, 'function');
  const config = (getRendererQualityConfig as () => {
    antialias: boolean;
    preserveDrawingBuffer: boolean;
    maxPixelRatio: number;
    shadowMapEnabled: boolean;
    shadowMapSize: number;
    shadowsAutoUpdate: boolean;
  })();

  assert.equal(config.antialias, false);
  assert.equal(config.preserveDrawingBuffer, false);
  assert.ok(config.maxPixelRatio <= 1);
  assert.equal(config.shadowMapEnabled, false);
  assert.ok(config.shadowMapSize <= 1024);
  assert.equal(config.shadowsAutoUpdate, false);
});

test('lowers and offsets the ocean to keep shorelines stable', () => {
  const getStableWaterRenderConfig = (
    viewportModule as unknown as Record<string, unknown>
  ).getStableWaterRenderConfig;

  assert.equal(typeof getStableWaterRenderConfig, 'function');
  const config = (getStableWaterRenderConfig as (seaLevel: number) => {
    renderLevel: number;
    renderOrder: number;
    polygonOffsetFactor: number;
    polygonOffsetUnits: number;
  })(8);

  assert.ok(config.renderLevel <= 7.9);
  assert.ok(config.renderOrder > 0);
  assert.ok(config.polygonOffsetFactor >= 2);
  assert.ok(config.polygonOffsetUnits >= 8);
});

test('uses enough ocean subdivisions for real vertex wave motion', () => {
  const getStableWaterRenderConfig = (
    viewportModule as unknown as Record<string, unknown>
  ).getStableWaterRenderConfig;

  assert.equal(typeof getStableWaterRenderConfig, 'function');
  const config = (getStableWaterRenderConfig as (seaLevel: number) => {
    subdivisions: number;
  })(8);

  assert.ok(config.subdivisions >= 96);
});

test('packs terrain heights into a normalized texture payload for water depth', () => {
  const createTerrainHeightTexturePayload = (
    viewportModule as unknown as Record<string, unknown>
  ).createTerrainHeightTexturePayload;

  assert.equal(typeof createTerrainHeightTexturePayload, 'function');
  const payload = (createTerrainHeightTexturePayload as (
    heights: Float32Array,
    resolution: number
  ) => {
    data: Uint8Array;
    minHeight: number;
    heightRange: number;
  })(new Float32Array([0, 4, 8, 16]), 2);

  assert.equal(payload.minHeight, 0);
  assert.equal(payload.heightRange, 16);
  assert.equal(payload.data.length, 16);
  assert.equal(payload.data[0], 0);
  assert.equal(payload.data[4], 64);
  assert.equal(payload.data[8], 128);
  assert.equal(payload.data[12], 255);
  assert.equal(payload.data[3], 255);
});
