import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { BiomeConfig, NoiseSettings, WaterSettings, LODSettings, SculptBrush, PerformanceStats, EnvironmentPreset } from '../types';
import { getEffectiveAtmosphere } from '../data/environments';
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

export function getOceanViewConfig(seaLevel: number) {
  const verticalFovDegrees = 55;
  const cameraFar = 10000;
  const oceanSize = 24000;
  const maxDistance = 600;
  const maxPolarAngle = Math.PI / 2 - 0.005;
  const cameraPosition = { x: 0, y: 30, z: 150 };
  const target = { x: 0, y: 30, z: 0 };
  const maxCameraY = target.y + maxDistance * Math.cos(maxPolarAngle);
  const heightAboveWater = Math.max(0, maxCameraY - seaLevel);
  const angularGap = Math.asin(Math.min(0.999, heightAboveWater / cameraFar));
  const halfFov = THREE.MathUtils.degToRad(verticalFovDegrees / 2);
  const horizonGapFraction = Math.tan(angularGap) / (2 * Math.tan(halfFov));

  return {
    verticalFovDegrees,
    cameraFar,
    oceanSize,
    maxDistance,
    maxPolarAngle,
    cameraPosition,
    target,
    horizonGapFraction
  };
}

export function getSkyboxRenderConfig() {
  return {
    backgroundBlurriness: 0
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
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);

  const terrainGroupRef = useRef<THREE.Group | null>(null);
  const waterMeshRef = useRef<THREE.Mesh | null>(null);
  const waterMaterialRef = useRef<THREE.ShaderMaterial | null>(null);
  const terrainMaterialRef = useRef<THREE.ShaderMaterial | null>(null);
  const brushMarkerRef = useRef<THREE.Mesh | null>(null);
  const environmentTextureRef = useRef<THREE.DataTexture | null>(null);
  const environmentTargetRef = useRef<THREE.WebGLRenderTarget | null>(null);
  const skyboxTextureRef = useRef<THREE.Texture | null>(null);
  const waterNormalTextureRef = useRef<THREE.Texture | null>(null);
  const environmentLoadIdRef = useRef(0);
  const atmosphereRef = useRef(getEffectiveAtmosphere(biome, environment));
  atmosphereRef.current = getEffectiveAtmosphere(biome, environment);

  const isMouseDownRef = useRef(false);
  const lastTimeRef = useRef(performance.now());
  const frameCountRef = useRef(0);

  // Initialize Three.js Scene
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    let disposed = false;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    const initialAspect = height > 0 ? width / height : 16 / 9;
    const viewConfig = getOceanViewConfig(water.level);

    // 1. Scene
    const scene = new THREE.Scene();
    const skyboxRenderConfig = getSkyboxRenderConfig();
    const atmosphere = getEffectiveAtmosphere(biome, environment);
    scene.background = new THREE.Color(atmosphere.skyColor);
    scene.backgroundBlurriness = skyboxRenderConfig.backgroundBlurriness;
    scene.backgroundIntensity = atmosphere.backgroundIntensity;
    scene.environmentIntensity = atmosphere.environmentIntensity;
    scene.fog = new THREE.FogExp2(atmosphere.fogColor, atmosphere.fogDensity);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(
      viewConfig.verticalFovDegrees,
      initialAspect,
      0.1,
      viewConfig.cameraFar
    );
    camera.position.set(
      viewConfig.cameraPosition.x,
      viewConfig.cameraPosition.y,
      viewConfig.cameraPosition.z
    );
    camera.lookAt(viewConfig.target.x, viewConfig.target.y, viewConfig.target.z);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = viewConfig.maxPolarAngle;
    controls.minDistance = 5;
    controls.maxDistance = viewConfig.maxDistance;
    controls.target.set(viewConfig.target.x, viewConfig.target.y, viewConfig.target.z);
    controls.update();
    controlsRef.current = controls;

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, atmosphere.ambientLightIntensity);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    const sunLight = new THREE.DirectionalLight(atmosphere.sunColor, atmosphere.sunLightIntensity);
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
    sunLightRef.current = sunLight;

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

    // Seamless surface detail breaks up repeating procedural wave bands.
    new THREE.TextureLoader().load(
      '/textures/waternormals.jpg',
      (texture) => {
        if (disposed) {
          texture.dispose();
          return;
        }

        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.colorSpace = THREE.NoColorSpace;
        waterNormalTextureRef.current = texture;

        if (waterMaterialRef.current) {
          waterMaterialRef.current.uniforms.uWaterNormalMap.value = texture;
          waterMaterialRef.current.uniforms.uHasWaterNormalMap.value = true;
        }
      },
      undefined,
      (error) => {
        if (!disposed) console.error('Unable to load water normal map', error);
      }
    );

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
      disposed = true;
      environmentLoadIdRef.current++;
      environmentTextureRef.current?.dispose();
      environmentTargetRef.current?.dispose();
      skyboxTextureRef.current?.dispose();
      environmentTextureRef.current = null;
      environmentTargetRef.current = null;
      skyboxTextureRef.current = null;
      ambientLightRef.current = null;
      sunLightRef.current = null;
      waterNormalTextureRef.current?.dispose();
      waterNormalTextureRef.current = null;
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      renderer.dispose();
      removeRendererCanvas(container, renderer.domElement);
    };
  }, []);

  // Update biome terrain colors and skybox-driven atmosphere.
  useEffect(() => {
    if (!sceneRef.current) return;
    const atmosphere = getEffectiveAtmosphere(biome, environment);

    if (!environmentTextureRef.current) {
      sceneRef.current.background = new THREE.Color(atmosphere.skyColor);
    }
    sceneRef.current.backgroundIntensity = atmosphere.backgroundIntensity;
    sceneRef.current.environmentIntensity = atmosphere.environmentIntensity;
    sceneRef.current.fog = new THREE.FogExp2(atmosphere.fogColor, atmosphere.fogDensity);

    ambientLightRef.current?.color.set(0xffffff);
    if (ambientLightRef.current) {
      ambientLightRef.current.intensity = atmosphere.ambientLightIntensity;
    }

    sunLightRef.current?.color.set(atmosphere.sunColor);
    if (sunLightRef.current) {
      sunLightRef.current.intensity = atmosphere.sunLightIntensity;
    }

    if (terrainMaterialRef.current) {
      terrainMaterialRef.current.uniforms.uFogColor.value.set(atmosphere.fogColor);
      terrainMaterialRef.current.uniforms.uSunColor.value.set(atmosphere.sunColor);
    }

    if (waterMaterialRef.current) {
      waterMaterialRef.current.uniforms.uSkyFallback.value.set(atmosphere.skyColor);
      waterMaterialRef.current.uniforms.uSunColor.value.set(atmosphere.sunColor);
    }
  }, [biome, environment]);

  // Load the selected local HDRI for the sky, environment lighting, and water reflection.
  useEffect(() => {
    if (!sceneRef.current || !rendererRef.current) return;

    const scene = sceneRef.current;
    const renderer = rendererRef.current;
    const loadId = ++environmentLoadIdRef.current;
    let cancelled = false;
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    const previousSkyboxAtLoadStart = skyboxTextureRef.current;
    skyboxTextureRef.current = null;
    if (previousSkyboxAtLoadStart) {
      scene.background = new THREE.Color(atmosphereRef.current.skyColor);
      previousSkyboxAtLoadStart.dispose();
    }

    const clearEnvironment = () => {
      environmentTextureRef.current?.dispose();
      environmentTargetRef.current?.dispose();
      environmentTextureRef.current = null;
      environmentTargetRef.current = null;
      if (!skyboxTextureRef.current) {
        scene.background = new THREE.Color(atmosphereRef.current.skyColor);
      }
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

        if (!skyboxTextureRef.current) {
          scene.background = texture;
        }
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

    new THREE.TextureLoader().load(
      environment.skyboxPath,
      (texture) => {
        if (cancelled || loadId !== environmentLoadIdRef.current) {
          texture.dispose();
          return;
        }

        texture.mapping = THREE.EquirectangularReflectionMapping;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;

        const previousSkyboxTexture = skyboxTextureRef.current;
        skyboxTextureRef.current = texture;
        scene.background = texture;
        previousSkyboxTexture?.dispose();
      },
      undefined,
      (error) => {
        if (cancelled || loadId !== environmentLoadIdRef.current) return;
        console.error(`Unable to load skybox texture: ${environment.name}`, error);
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
      const { oceanSize } = getOceanViewConfig(water.level);
      const waterGeo = new THREE.PlaneGeometry(oceanSize, oceanSize, 1, 1);
      waterGeo.rotateX(-Math.PI / 2);

      const waterMat = createCustomWaterMaterial(biome);
      waterMat.uniforms.uWaveSpeed.value = water.waveSpeed;
      waterMat.uniforms.uWaveHeight.value = water.waveHeight;
      waterMat.uniforms.uEnvironmentMap.value = environmentTextureRef.current;
      waterMat.uniforms.uHasEnvironment.value = Boolean(environmentTextureRef.current);
      waterMat.uniforms.uWaterNormalMap.value = waterNormalTextureRef.current;
      waterMat.uniforms.uHasWaterNormalMap.value = Boolean(waterNormalTextureRef.current);
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
