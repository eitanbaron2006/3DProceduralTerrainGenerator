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
  const config = (getOceanViewConfig as (seaLevel: number) => {
    cameraPosition: { x: number; y: number; z: number };
    target: { x: number; y: number; z: number };
    cameraFar: number;
    oceanSize: number;
    horizonGapFraction: number;
  })(8);

  assert.equal(config.cameraPosition.y, config.target.y);
  assert.ok(config.oceanSize / 2 > config.cameraFar);
  assert.ok(config.horizonGapFraction < 0.005);
});

test('renders HDRI skyboxes without background blur', () => {
  const getSkyboxRenderConfig = (
    viewportModule as unknown as Record<string, unknown>
  ).getSkyboxRenderConfig;

  assert.equal(typeof getSkyboxRenderConfig, 'function');
  const config = (getSkyboxRenderConfig as () => {
    backgroundBlurriness: number;
  })();

  assert.equal(config.backgroundBlurriness, 0);
});
