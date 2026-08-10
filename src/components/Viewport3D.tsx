import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { AtmosphereConfig, BiomeConfig, NoiseSettings, WaterSettings, LODSettings, SculptBrush, PerformanceStats, EnvironmentPreset } from '../types';
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

export function getOceanViewConfig(
  seaLevel: number,
  sunDirection: [number, number, number] = [0.8073, 0.1794, 0.5623]
) {
  const verticalFovDegrees = 52;
  const cameraNear = 1;
  const cameraFar = 9000;
  const oceanSize = 24000;
  const maxDistance = 1100;
  const maxPolarAngle = Math.PI / 2 - 0.005;
  const cameraDistance = 285;
  const sunHorizontalLength = Math.hypot(sunDirection[0], sunDirection[2]) || 1;
  const sunForwardX = sunDirection[0] / sunHorizontalLength;
  const sunForwardZ = sunDirection[2] / sunHorizontalLength;
  const cameraPosition = {
    x: -sunForwardX * cameraDistance,
    y: 44,
    z: -sunForwardZ * cameraDistance
  };
  const target = { x: 0, y: 44, z: 0 };
  const maxCameraY = target.y + maxDistance * Math.cos(maxPolarAngle);
  const heightAboveWater = Math.max(0, maxCameraY - seaLevel);
  const angularGap = Math.asin(Math.min(0.999, heightAboveWater / cameraFar));
  const halfFov = THREE.MathUtils.degToRad(verticalFovDegrees / 2);
  const horizonGapFraction = Math.tan(angularGap) / (2 * Math.tan(halfFov));

  return {
    verticalFovDegrees,
    cameraNear,
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
    backgroundBlurriness: 0,
    mapping: 'EquirectangularReflectionMapping',
    colorSpace: 'SRGBColorSpace',
    minFilter: 'LinearFilter',
    magFilter: 'LinearFilter',
    generateMipmaps: false
  };
}

export function getWaterReflectionTextureConfig() {
  return {
    mapping: 'EquirectangularReflectionMapping',
    colorSpace: 'SRGBColorSpace',
    wrapS: 'RepeatWrapping',
    wrapT: 'ClampToEdgeWrapping',
    minFilter: 'LinearFilter',
    magFilter: 'LinearFilter',
    generateMipmaps: false
  };
}

export function getRendererQualityConfig() {
  return {
    antialias: false,
    preserveDrawingBuffer: false,
    maxPixelRatio: 1,
    shadowMapEnabled: false,
    shadowMapSize: 512,
    shadowsAutoUpdate: false
  };
}

export function getStableWaterRenderConfig(seaLevel: number) {
  return {
    renderLevel: seaLevel - 0.18,
    renderOrder: 1,
    polygonOffsetFactor: 3,
    polygonOffsetUnits: 12,
    subdivisions: 160
  };
}

export interface TerrainHeightTexturePayload {
  data: Uint8Array;
  minHeight: number;
  heightRange: number;
}

export function createTerrainHeightTexturePayload(
  heights: Float32Array,
  resolution: number
): TerrainHeightTexturePayload {
  const sampleCount = resolution * resolution;
  let minHeight = Number.POSITIVE_INFINITY;
  let maxHeight = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < sampleCount; i++) {
    const height = heights[i];
    if (!Number.isFinite(height)) continue;
    minHeight = Math.min(minHeight, height);
    maxHeight = Math.max(maxHeight, height);
  }

  if (!Number.isFinite(minHeight) || !Number.isFinite(maxHeight)) {
    minHeight = 0;
    maxHeight = 1;
  }

  const heightRange = Math.max(1e-6, maxHeight - minHeight);
  const data = new Uint8Array(sampleCount * 4);

  for (let i = 0; i < sampleCount; i++) {
    const safeHeight = Number.isFinite(heights[i]) ? heights[i] : minHeight;
    const normalizedHeight = THREE.MathUtils.clamp(
      (safeHeight - minHeight) / heightRange,
      0,
      1
    );
    const encodedHeight = Math.round(normalizedHeight * 255);
    const offset = i * 4;
    data[offset] = encodedHeight;
    data[offset + 1] = encodedHeight;
    data[offset + 2] = encodedHeight;
    data[offset + 3] = 255;
  }

  return { data, minHeight, heightRange };
}

function applyTerrainHeightTextureToWaterMaterial(
  material: THREE.ShaderMaterial,
  texture: THREE.DataTexture | null,
  meta: TerrainHeightTexturePayload,
  terrainWorldSize: number,
  waterLevel: number
) {
  material.uniforms.uTerrainHeightMap.value = texture;
  material.uniforms.uHasTerrainHeightMap.value = Boolean(texture);
  material.uniforms.uTerrainWorldSize.value = terrainWorldSize;
  material.uniforms.uTerrainHeightMin.value = meta.minHeight;
  material.uniforms.uTerrainHeightRange.value = meta.heightRange;
  material.uniforms.uWaterLevel.value = waterLevel;
}

export function getAtmosphereSunVector(atmosphere: Pick<AtmosphereConfig, 'sunDirection'>) {
  const [x, y, z] = atmosphere.sunDirection;
  return new THREE.Vector3(x, y, z).normalize();
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
  const skyboxTextureRef = useRef<THREE.Texture | null>(null);
  const waterNormalTextureRef = useRef<THREE.Texture | null>(null);
  const terrainHeightTextureRef = useRef<THREE.DataTexture | null>(null);
  const terrainHeightTextureMetaRef = useRef<TerrainHeightTexturePayload>({
    data: new Uint8Array(4),
    minHeight: 0,
    heightRange: 1
  });
  const skyboxLoadIdRef = useRef(0);
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
    // 1. Scene
    const scene = new THREE.Scene();
    const skyboxRenderConfig = getSkyboxRenderConfig();
    const rendererQualityConfig = getRendererQualityConfig();
    const atmosphere = getEffectiveAtmosphere(biome, environment);
    const viewConfig = getOceanViewConfig(water.level, atmosphere.sunDirection);
    scene.background = new THREE.Color(atmosphere.skyColor);
    scene.backgroundBlurriness = skyboxRenderConfig.backgroundBlurriness;
    scene.backgroundIntensity = atmosphere.skyboxIntensity;
    scene.environmentIntensity = atmosphere.environmentIntensity;
    scene.fog = new THREE.FogExp2(atmosphere.fogColor, atmosphere.fogDensity);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(
      viewConfig.verticalFovDegrees,
      initialAspect,
      viewConfig.cameraNear,
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
      antialias: rendererQualityConfig.antialias,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: rendererQualityConfig.preserveDrawingBuffer
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, rendererQualityConfig.maxPixelRatio));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    renderer.shadowMap.enabled = rendererQualityConfig.shadowMapEnabled;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.shadowMap.autoUpdate = rendererQualityConfig.shadowsAutoUpdate;
    renderer.shadowMap.needsUpdate = true;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = viewConfig.maxPolarAngle;
    controls.minDistance = 60;
    controls.maxDistance = viewConfig.maxDistance;
    controls.target.set(viewConfig.target.x, viewConfig.target.y, viewConfig.target.z);
    controls.update();
    controlsRef.current = controls;

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, atmosphere.ambientLightIntensity);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    const sunLight = new THREE.DirectionalLight(atmosphere.sunColor, atmosphere.sunLightIntensity);
    sunLight.position.copy(getAtmosphereSunVector(atmosphere).multiplyScalar(300));
    sunLight.castShadow = rendererQualityConfig.shadowMapEnabled;
    sunLight.shadow.mapSize.width = rendererQualityConfig.shadowMapSize;
    sunLight.shadow.mapSize.height = rendererQualityConfig.shadowMapSize;
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
      skyboxLoadIdRef.current++;
      skyboxTextureRef.current?.dispose();
      skyboxTextureRef.current = null;
      ambientLightRef.current = null;
      sunLightRef.current = null;
      waterNormalTextureRef.current?.dispose();
      waterNormalTextureRef.current = null;
      terrainHeightTextureRef.current?.dispose();
      terrainHeightTextureRef.current = null;
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

    if (!skyboxTextureRef.current) {
      sceneRef.current.background = new THREE.Color(atmosphere.skyColor);
    }
    sceneRef.current.backgroundIntensity = atmosphere.skyboxIntensity;
    sceneRef.current.environmentIntensity = atmosphere.environmentIntensity;
    sceneRef.current.fog = new THREE.FogExp2(atmosphere.fogColor, atmosphere.fogDensity);

    ambientLightRef.current?.color.set(0xffffff);
    if (ambientLightRef.current) {
      ambientLightRef.current.intensity = atmosphere.ambientLightIntensity;
    }

    sunLightRef.current?.color.set(atmosphere.sunColor);
    if (sunLightRef.current) {
      sunLightRef.current.intensity = atmosphere.sunLightIntensity;
      sunLightRef.current.position.copy(getAtmosphereSunVector(atmosphere).multiplyScalar(300));
    }
    if (rendererRef.current) {
      rendererRef.current.shadowMap.needsUpdate = true;
    }

    if (terrainMaterialRef.current) {
      terrainMaterialRef.current.uniforms.uFogColor.value.set(atmosphere.fogColor);
      terrainMaterialRef.current.uniforms.uFogDensity.value = atmosphere.fogDensity;
      terrainMaterialRef.current.uniforms.uSunColor.value.set(atmosphere.sunColor);
      terrainMaterialRef.current.uniforms.uSunDirection.value.copy(getAtmosphereSunVector(atmosphere));
    }

    if (waterMaterialRef.current) {
      waterMaterialRef.current.uniforms.uSkyFallback.value.set(atmosphere.skyColor);
      waterMaterialRef.current.uniforms.uSunColor.value.set(atmosphere.sunColor);
      waterMaterialRef.current.uniforms.uSunDirection.value.copy(getAtmosphereSunVector(atmosphere));
    }

  }, [biome, environment]);

  // Reframe the default composition whenever a new HDRI is selected so the
  // visible sky, low sun, and water reflection share the same screen azimuth.
  useEffect(() => {
    if (!cameraRef.current || !controlsRef.current) return;

    const viewConfig = getOceanViewConfig(water.level, environment.atmosphere.sunDirection);
    cameraRef.current.position.set(
      viewConfig.cameraPosition.x,
      viewConfig.cameraPosition.y,
      viewConfig.cameraPosition.z
    );
    cameraRef.current.lookAt(viewConfig.target.x, viewConfig.target.y, viewConfig.target.z);
    controlsRef.current.target.set(viewConfig.target.x, viewConfig.target.y, viewConfig.target.z);
    controlsRef.current.update();
  }, [environment, water.level]);

  // Load one local equirectangular HDRI JPG for both the visible skybox and water reflection.
  // Sharing the exact same Texture keeps the reflected azimuth locked to the visible sky.
  useEffect(() => {
    if (!sceneRef.current) return;

    const scene = sceneRef.current;
    const skyboxRenderConfig = getSkyboxRenderConfig();
    const waterReflectionConfig = getWaterReflectionTextureConfig();
    const loadId = ++skyboxLoadIdRef.current;
    let cancelled = false;

    const previousSkyboxAtLoadStart = skyboxTextureRef.current;
    skyboxTextureRef.current = null;
    if (previousSkyboxAtLoadStart) {
      scene.background = new THREE.Color(atmosphereRef.current.skyColor);
      previousSkyboxAtLoadStart.dispose();
    }
    if (waterMaterialRef.current) {
      waterMaterialRef.current.uniforms.uSkyReflectionMap.value = null;
      waterMaterialRef.current.uniforms.uHasSkyReflection.value = false;
    }

    new THREE.TextureLoader().load(
      environment.skyboxPath,
      (texture) => {
        if (cancelled || loadId !== skyboxLoadIdRef.current) {
          texture.dispose();
          return;
        }

        texture.mapping = THREE.EquirectangularReflectionMapping;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = waterReflectionConfig.generateMipmaps;
        texture.needsUpdate = true;

        const previousSkyboxTexture = skyboxTextureRef.current;
        skyboxTextureRef.current = texture;
        scene.background = texture;
        scene.backgroundBlurriness = skyboxRenderConfig.backgroundBlurriness;
        scene.backgroundIntensity = atmosphereRef.current.skyboxIntensity;
        if (waterMaterialRef.current) {
          waterMaterialRef.current.uniforms.uSkyReflectionMap.value = texture;
          waterMaterialRef.current.uniforms.uHasSkyReflection.value = true;
        }
        previousSkyboxTexture?.dispose();
      },
      undefined,
      (error) => {
        if (cancelled || loadId !== skyboxLoadIdRef.current) return;
        console.error(`Unable to load synchronized HDRI sky/reflection map: ${environment.name}`, error);
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

    const heightTexturePayload = createTerrainHeightTexturePayload(currentHeights, gridRes);
    const heightTexture = new THREE.DataTexture(
      heightTexturePayload.data,
      gridRes,
      gridRes,
      THREE.RGBAFormat
    );
    heightTexture.wrapS = THREE.ClampToEdgeWrapping;
    heightTexture.wrapT = THREE.ClampToEdgeWrapping;
    heightTexture.minFilter = THREE.LinearFilter;
    heightTexture.magFilter = THREE.LinearFilter;
    heightTexture.generateMipmaps = false;
    heightTexture.flipY = false;
    heightTexture.colorSpace = THREE.NoColorSpace;
    heightTexture.needsUpdate = true;

    terrainHeightTextureRef.current?.dispose();
    terrainHeightTextureRef.current = heightTexture;
    terrainHeightTextureMetaRef.current = heightTexturePayload;

    if (waterMaterialRef.current) {
      applyTerrainHeightTextureToWaterMaterial(
        waterMaterialRef.current,
        heightTexture,
        heightTexturePayload,
        worldSize,
        water.level
      );
    }

    // Create Terrain Material
    const material = createCustomTerrainMaterial(biome, lod.wireframe);
    material.uniforms.uHeightScale.value = Math.max(10, noise.heightMultiplier * 1.2);
    material.uniforms.uFogDensity.value = atmosphereRef.current.fogDensity;
    material.uniforms.uSunDirection.value.copy(getAtmosphereSunVector(atmosphereRef.current));
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
    mesh.castShadow = false;
    mesh.receiveShadow = false;

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
    if (rendererRef.current) {
      rendererRef.current.shadowMap.needsUpdate = true;
    }
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
      const waterRenderConfig = getStableWaterRenderConfig(water.level);
      const waterGeo = new THREE.PlaneGeometry(
        oceanSize,
        oceanSize,
        waterRenderConfig.subdivisions,
        waterRenderConfig.subdivisions
      );
      waterGeo.rotateX(-Math.PI / 2);

      const waterMat = createCustomWaterMaterial(biome);
      waterMat.uniforms.uWaveSpeed.value = water.waveSpeed;
      waterMat.uniforms.uWaveHeight.value = water.waveHeight;
      waterMat.uniforms.uWaterLevel.value = water.level;
      waterMat.uniforms.uShallowWaterColor.value.set(water.shallowColor);
      waterMat.uniforms.uShallowOpacity.value = THREE.MathUtils.clamp(water.transparency * 0.55, 0.38, 0.58);
      waterMat.uniforms.uDeepOpacity.value = THREE.MathUtils.clamp(0.82 + water.transparency * 0.18, 0.94, 0.995);
      waterMat.polygonOffsetFactor = waterRenderConfig.polygonOffsetFactor;
      waterMat.polygonOffsetUnits = waterRenderConfig.polygonOffsetUnits;
      waterMat.uniforms.uWaterNormalMap.value = waterNormalTextureRef.current;
      waterMat.uniforms.uHasWaterNormalMap.value = Boolean(waterNormalTextureRef.current);
      waterMat.uniforms.uSkyReflectionMap.value = skyboxTextureRef.current;
      waterMat.uniforms.uHasSkyReflection.value = Boolean(skyboxTextureRef.current);
      waterMat.uniforms.uSunDirection.value.copy(getAtmosphereSunVector(atmosphereRef.current));
      applyTerrainHeightTextureToWaterMaterial(
        waterMat,
        terrainHeightTextureRef.current,
        terrainHeightTextureMetaRef.current,
        200,
        water.level
      );
      waterMaterialRef.current = waterMat;

      const waterMesh = new THREE.Mesh(waterGeo, waterMat);
      waterMesh.position.y = waterRenderConfig.renderLevel;
      waterMesh.renderOrder = waterRenderConfig.renderOrder;
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
