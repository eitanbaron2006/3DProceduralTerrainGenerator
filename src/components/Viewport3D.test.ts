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
