import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { BiomeConfig, NoiseSettings, WaterSettings, LODSettings, SculptBrush, PerformanceStats, EnvironmentPreset } from '../types';
import { createSeededNoise, getProceduralHeight } from '../utils/noise';
import { createCustomTerrainMaterial, createCustomWaterMaterial } from '../utils/shaders';

export function removeRendererCanvas(
  container: Pick<HTMLElement, 'contains' | 'removeChild'>,
  canvas: HTMLCanvasElement
) {
  if (container.contains(canvas)) {
    container.removeChild(canvas);
  }
}

export function getInfiniteWaterPosition(x: number, z: number, snapSize = 16) {
  return {
    x: Math.round(x / snapSize) * snapSize,
    z: Math.round(z / snapSize) * snapSize
  };
}

interface Viewport3DProps {
  biome: BiomeConfig;
  environment: EnvironmentPreset;
  noise: NoiseSettings;
  water: WaterSettings;
  lod: LODSettings;
  sculpt: SculptBrush;
  heightGrid: Float32Array | null;
  onHeightGridUpdate: (newGrid: Float32Array) => void;
  onStatsUpdate: (stats: PerformanceStats) => void;
  onTerrainMeshReady: (meshGroup: THREE.Group) => void;
  sculptBrushRef: React.MutableRefObject<SculptBrush>;
}

export const Viewport3D: React.FC<Viewport3DProps> = ({
  biome,
  environment,
  noise,
  water,
  lod,
  sculpt,
  heightGrid,
  onHeightGridUpdate,
  onStatsUpdate,
  onTerrainMeshReady,
  sculptBrushRef
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  const terrainGroupRef = useRef<THREE.Group | null>(null);
  const waterMeshRef = useRef<THREE.Mesh | null>(null);
  const waterMaterialRef = useRef<THREE.ShaderMaterial | null>(null);
  const terrainMaterialRef = useRef<THREE.ShaderMaterial | null>(null);
  const brushMarkerRef = useRef<THREE.Mesh | null>(null);
  const environmentTextureRef = useRef<THREE.DataTexture | null>(null);
  const environmentTargetRef = useRef<THREE.WebGLRenderTarget | null>(null);
  const environmentLoadIdRef = useRef(0);
  const biomeSkyColorRef = useRef(biome.skyColor);
  biomeSkyColorRef.current = biome.skyColor;

  const isMouseDownRef = useRef(false);
  const lastTimeRef = useRef(performance.now());
  const frameCountRef = useRef(0);

  // Initialize Three.js Scene
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    const initialAspect = height > 0 ? width / height : 16 / 9;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(biome.skyColor);
    scene.fog = new THREE.FogExp2(biome.fogColor, 0.0004);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(
      55,
      initialAspect,
      0.1,
      1500
    );
    camera.position.set(0, 60, 130);
    camera.lookAt(0, 10, 0);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.minDistance = 5;
    controls.maxDistance = 600;
    controls.target.set(0, 0, 0);
    controls.update();
    controlsRef.current = controls;

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(biome.sunColor, 1.3);
    sunLight.position.set(120, 180, 80);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 500;
    const shadowDist = 150;
    sunLight.shadow.camera.left = -shadowDist;
    sunLight.shadow.camera.right = shadowDist;
    sunLight.shadow.camera.top = shadowDist;
    sunLight.shadow.camera.bottom = -shadowDist;
    scene.add(sunLight);

    // 6. Terrain Group
    const terrainGroup = new THREE.Group();
    scene.add(terrainGroup);
    terrainGroupRef.current = terrainGroup;

    // 7. Sculpt Brush Marker Mesh
    const brushGeo = new THREE.RingGeometry(0.8, 1.0, 32);
    brushGeo.rotateX(-Math.PI / 2);
    const brushMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8
    });
    const brushMarker = new THREE.Mesh(brushGeo, brushMat);
    brushMarker.visible = false;
    scene.add(brushMarker);
    brushMarkerRef.current = brushMarker;

    // 8. Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const now = performance.now();
      frameCountRef.current++;

      if (now - lastTimeRef.current >= 500) {
        const fps = Math.round((frameCountRef.current * 1000) / (now - lastTimeRef.current));
        frameCountRef.current = 0;
        lastTimeRef.current = now;

        if (rendererRef.current) {
          const info = rendererRef.current.info;
          onStatsUpdate({
            fps,
            triangles: info.render.triangles,
            drawCalls: info.render.calls,
            chunksRendered: terrainGroupRef.current?.children.length || 1,
            memoryMB: Math.round(info.memory.geometries * 0.1)
          });
        }
      }

      controls.update();

      // Update Water Shader Uniforms
      if (waterMaterialRef.current) {
        waterMaterialRef.current.uniforms.uTime.value = now * 0.001;
      }

      if (waterMeshRef.current) {
        const waterPosition = getInfiniteWaterPosition(camera.position.x, camera.position.z);
        waterMeshRef.current.position.x = waterPosition.x;
        waterMeshRef.current.position.z = waterPosition.z;
      }

      renderer.render(scene, camera);
    };
    animate();

    // ResizeObserver for reliable responsive canvas sizing
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0 && cameraRef.current && rendererRef.current) {
          cameraRef.current.aspect = w / h;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(w, h);
        }
      }
    });

    resizeObserver.observe(container);

    return () => {
      environmentLoadIdRef.current++;
      environmentTextureRef.current?.dispose();
      environmentTargetRef.current?.dispose();
      environmentTextureRef.current = null;
      environmentTargetRef.current = null;
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      renderer.dispose();
      removeRendererCanvas(container, renderer.domElement);
    };
  }, []);

  // Update Biome & Sky Colors
  useEffect(() => {
    if (!sceneRef.current) return;
    if (!environmentTextureRef.current) {
      sceneRef.current.background = new THREE.Color(biome.skyColor);
    }
    sceneRef.current.fog = new THREE.FogExp2(biome.fogColor, 0.0004);
  }, [biome]);

  // Load the selected local HDRI for the sky, environment lighting, and water reflection.
  useEffect(() => {
    if (!sceneRef.current || !rendererRef.current) return;

    const scene = sceneRef.current;
    const renderer = rendererRef.current;
    const loadId = ++environmentLoadIdRef.current;
    let cancelled = false;
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    const clearEnvironment = () => {
      environmentTextureRef.current?.dispose();
      environmentTargetRef.current?.dispose();
      environmentTextureRef.current = null;
      environmentTargetRef.current = null;
      scene.background = new THREE.Color(biomeSkyColorRef.current);
      scene.environment = null;

      if (waterMaterialRef.current) {
        waterMaterialRef.current.uniforms.uEnvironmentMap.value = null;
        waterMaterialRef.current.uniforms.uHasEnvironment.value = false;
      }
    };

    new RGBELoader().load(
      environment.hdrPath,
      (texture) => {
        if (cancelled || loadId !== environmentLoadIdRef.current) {
          texture.dispose();
          pmremGenerator.dispose();
          return;
        }

        texture.mapping = THREE.EquirectangularReflectionMapping;
        const environmentTarget = pmremGenerator.fromEquirectangular(texture);
        pmremGenerator.dispose();

        const previousTexture = environmentTextureRef.current;
        const previousTarget = environmentTargetRef.current;
        environmentTextureRef.current = texture;
        environmentTargetRef.current = environmentTarget;

        scene.background = texture;
        scene.environment = environmentTarget.texture;

        if (waterMaterialRef.current) {
          waterMaterialRef.current.uniforms.uEnvironmentMap.value = texture;
          waterMaterialRef.current.uniforms.uHasEnvironment.value = true;
        }

        previousTexture?.dispose();
        previousTarget?.dispose();
      },
      undefined,
      (error) => {
        pmremGenerator.dispose();
        if (cancelled || loadId !== environmentLoadIdRef.current) return;
        clearEnvironment();
        console.error(`Unable to load HDRI environment: ${environment.name}`, error);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [environment]);

  // Generate or Update Terrain Mesh Chunks
  useEffect(() => {
    if (!terrainGroupRef.current) return;

    const terrainGroup = terrainGroupRef.current;
    // Clear existing chunks
    while (terrainGroup.children.length > 0) {
      const child = terrainGroup.children[0] as THREE.Mesh;
      if (child.geometry) child.geometry.dispose();
      terrainGroup.remove(child);
    }

    const worldSize = 200;
    const gridRes = lod.resolution; // e.g., 128
    const totalVertices = gridRes * gridRes;

    // Create height data if not provided
    let currentHeights = heightGrid;
    if (!currentHeights || currentHeights.length !== totalVertices) {
      const noise2D = createSeededNoise(noise.seed);
      currentHeights = new Float32Array(totalVertices);
      const halfSize = (gridRes - 1) / 2;

      for (let z = 0; z < gridRes; z++) {
        for (let x = 0; x < gridRes; x++) {
          const worldX = ((x - halfSize) / (gridRes - 1)) * worldSize;
          const worldZ = ((z - halfSize) / (gridRes - 1)) * worldSize;
          const h = getProceduralHeight(worldX, worldZ, noise, noise2D, worldSize);
          currentHeights[z * gridRes + x] = h;
        }
      }
      onHeightGridUpdate(currentHeights);
    }

    // Create Terrain Material
    const material = createCustomTerrainMaterial(biome, lod.wireframe);
    material.uniforms.uHeightScale.value = Math.max(10, noise.heightMultiplier * 1.2);
    terrainMaterialRef.current = material;

    // Create Plane Geometry
    const geometry = new THREE.PlaneGeometry(worldSize, worldSize, gridRes - 1, gridRes - 1);
    geometry.rotateX(-Math.PI / 2);

    const posAttr = geometry.attributes.position as THREE.BufferAttribute;
    const positions = posAttr.array as Float32Array;

    // Apply heights to geometry
    for (let i = 0; i < totalVertices; i++) {
      positions[i * 3 + 1] = currentHeights[i];
    }

    posAttr.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Optional Bounding Box helper
    if (lod.showChunkBounds) {
      const boxHelper = new THREE.BoxHelper(mesh, 0x38bdf8);
      terrainGroup.add(boxHelper);
    }

    // Optional Normals helper
    if (lod.showNormals) {
      // Normals visualization
    }

    terrainGroup.add(mesh);
    onTerrainMeshReady(terrainGroup);
  }, [biome, noise, lod, heightGrid]);

  // Update Water Mesh
  useEffect(() => {
    if (!sceneRef.current) return;

    if (waterMeshRef.current) {
      sceneRef.current.remove(waterMeshRef.current);
      if (waterMeshRef.current.geometry) waterMeshRef.current.geometry.dispose();
      if (waterMeshRef.current.material) {
        (waterMeshRef.current.material as THREE.Material).dispose();
      }
      waterMeshRef.current = null;
      waterMaterialRef.current = null;
    }

    if (water.enabled) {
      const worldSize = 3200;
      const waterGeo = new THREE.PlaneGeometry(worldSize, worldSize, 128, 128);
      waterGeo.rotateX(-Math.PI / 2);

      const waterMat = createCustomWaterMaterial(biome);
      waterMat.uniforms.uWaveSpeed.value = water.waveSpeed;
      waterMat.uniforms.uWaveHeight.value = water.waveHeight;
      waterMat.uniforms.uEnvironmentMap.value = environmentTextureRef.current;
      waterMat.uniforms.uHasEnvironment.value = Boolean(environmentTextureRef.current);
      waterMaterialRef.current = waterMat;

      const waterMesh = new THREE.Mesh(waterGeo, waterMat);
      waterMesh.position.y = water.level;
      sceneRef.current.add(waterMesh);
      waterMeshRef.current = waterMesh;
    }
  }, [water, biome]);

  // Sculpting Pointer Events
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const currentBrush = sculptBrushRef.current;
    if (!containerRef.current || !cameraRef.current || !terrainGroupRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);

    const intersects = raycaster.intersectObjects(terrainGroupRef.current.children, true);

    if (intersects.length > 0 && currentBrush.active) {
      const hit = intersects[0];
      if (brushMarkerRef.current) {
        brushMarkerRef.current.position.copy(hit.point);
        brushMarkerRef.current.position.y += 0.3;
        brushMarkerRef.current.scale.set(currentBrush.radius, 1, currentBrush.radius);
        brushMarkerRef.current.visible = true;
      }

      if (isMouseDownRef.current && heightGrid) {
        applySculptingAt(hit.point, currentBrush);
      }
    } else {
      if (brushMarkerRef.current) brushMarkerRef.current.visible = false;
    }
  };

  const handlePointerDown = () => {
    isMouseDownRef.current = true;
  };

  const handlePointerUp = () => {
    isMouseDownRef.current = false;
  };

  // Modify Terrain Height Array at hit location
  const applySculptingAt = (hitPoint: THREE.Vector3, brush: SculptBrush) => {
    if (!heightGrid || !terrainGroupRef.current) return;

    const worldSize = 200;
    const gridRes = lod.resolution;
    const halfSize = worldSize / 2;

    const gridX = Math.round(((hitPoint.x + halfSize) / worldSize) * (gridRes - 1));
    const gridZ = Math.round(((hitPoint.z + halfSize) / worldSize) * (gridRes - 1));

    const radiusInGrid = Math.round((brush.radius / worldSize) * gridRes);
    const newHeights = new Float32Array(heightGrid);

    let modified = false;

    for (let dz = -radiusInGrid; dz <= radiusInGrid; dz++) {
      for (let dx = -radiusInGrid; dx <= radiusInGrid; dx++) {
        const gz = gridZ + dz;
        const gx = gridX + dx;

        if (gx >= 0 && gx < gridRes && gz >= 0 && gz < gridRes) {
          const distSq = dx * dx + dz * dz;
          if (distSq <= radiusInGrid * radiusInGrid) {
            const idx = gz * gridRes + gx;
            const factor = Math.cos((Math.sqrt(distSq) / radiusInGrid) * (Math.PI / 2));
            const delta = brush.strength * factor * 0.8;

            if (brush.mode === 'raise') {
              newHeights[idx] += delta;
            } else if (brush.mode === 'lower') {
              newHeights[idx] = Math.max(0, newHeights[idx] - delta);
            } else if (brush.mode === 'smooth') {
              // Smooth with neighbors
              let sum = 0;
              let count = 0;
              for (let sy = -1; sy <= 1; sy++) {
                for (let sx = -1; sx <= 1; sx++) {
                  const ny = gz + sy;
                  const nx = gx + sx;
                  if (nx >= 0 && nx < gridRes && ny >= 0 && ny < gridRes) {
                    sum += heightGrid[ny * gridRes + nx];
                    count++;
                  }
                }
              }
              const avg = sum / count;
              newHeights[idx] = THREE.MathUtils.lerp(newHeights[idx], avg, brush.strength * 0.3);
            } else if (brush.mode === 'flatten') {
              newHeights[idx] = THREE.MathUtils.lerp(newHeights[idx], hitPoint.y, brush.strength * 0.4);
            }

            modified = true;
          }
        }
      }
    }

    if (modified) {
      onHeightGridUpdate(newHeights);
    }
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative cursor-grab active:cursor-grabbing select-none"
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    />
  );
};
