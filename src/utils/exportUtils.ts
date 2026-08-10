import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { USDZExporter } from 'three/addons/exporters/USDZExporter.js';
import { BiomeConfig, NoiseSettings, WaterSettings } from '../types';

/**
 * Exports Three.js terrain mesh scene to binary GLB / glTF
 */
export async function exportToGLTF(mesh: THREE.Mesh | THREE.Group, filename: string = 'terrain.glb'): Promise<void> {
  const exporter = new GLTFExporter();
  return new Promise((resolve, reject) => {
    exporter.parse(
      mesh,
      (gltf) => {
        let output: Blob;
        if (gltf instanceof ArrayBuffer) {
          output = new Blob([gltf], { type: 'application/octet-stream' });
        } else {
          const stringified = JSON.stringify(gltf, null, 2);
          output = new Blob([stringified], { type: 'application/json' });
        }
        downloadBlob(output, filename);
        resolve();
      },
      (error) => {
        console.error('An error occurred exporting glTF:', error);
        reject(error);
      },
      { binary: true }
    );
  });
}

/**
 * Exports Three.js terrain mesh scene to USDZ (Apple AR / iOS format)
 */
export async function exportToUSDZ(mesh: THREE.Mesh | THREE.Group, filename: string = 'terrain.usdz'): Promise<void> {
  const exporter = new USDZExporter();
  return new Promise((resolve, reject) => {
    exporter.parse(
      mesh,
      (usdz) => {
        const blob = new Blob([usdz], { type: 'application/octet-stream' });
        downloadBlob(blob, filename);
        resolve();
      },
      (error) => {
        console.error('An error occurred exporting USDZ:', error);
        reject(error);
      }
    );
  });
}

/**
 * Downloads a binary or text Blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

/**
 * Generates ready-to-use standalone HTML/Three.js integration code snippet
 */
export function generateThreeJsCodeSnippet(
  biome: BiomeConfig,
  noise: NoiseSettings,
  water: WaterSettings
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Three.js Procedural Terrain Integration</title>
  <style>
    body { margin: 0; overflow: hidden; background: #0a0a0f; }
    #canvas-container { width: 100vw; height: 100vh; }
  </style>
</head>
<body>
  <div id="canvas-container"></div>

  <!-- Import Three.js via ES Modules -->
  <script type="importmap">
    {
      "imports": {
        "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
        "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
      }
    }
  </script>

  <script type="module">
    import * as THREE from 'three';
    import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

    // 1. Scene & Renderer Setup
    const container = document.getElementById('canvas-container');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('${biome.skyColor}');
    scene.fog = new THREE.FogExp2('${biome.fogColor}', 0.003);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 50, 120);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;

    // 2. Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight('${biome.sunColor}', 1.2);
    sunLight.position.set(100, 150, 50);
    sunLight.castShadow = true;
    scene.add(sunLight);

    // 3. Terrain Custom Shader Material
    const terrainMaterial = new THREE.ShaderMaterial({
      vertexShader: \`
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying float vElevation;

        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          vElevation = position.y;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      \`,
      fragmentShader: \`
        uniform vec3 uColorLow;
        uniform vec3 uColorMid;
        uniform vec3 uColorHigh;
        uniform vec3 uSunDirection;

        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        varying float vElevation;

        void main() {
          float slope = dot(vNormal, vec3(0.0, 1.0, 0.0));
          float heightNorm = clamp(vElevation / ${noise.heightMultiplier.toFixed(1)}, 0.0, 1.0);

          vec3 baseColor = uColorLow;
          baseColor = mix(baseColor, uColorMid, smoothstep(0.2, 0.5, heightNorm));
          baseColor = mix(baseColor, uColorHigh, smoothstep(0.6, 0.9, heightNorm));
          baseColor = mix(baseColor, uColorMid * 0.8, 1.0 - smoothstep(0.4, 0.7, slope));

          vec3 sunDir = normalize(uSunDirection);
          float diff = max(dot(vNormal, sunDir), 0.0);
          vec3 finalColor = baseColor * (vec3(0.3) + vec3(0.8) * diff);

          gl_FragColor = vec4(finalColor, 1.0);
        }
      \`,
      uniforms: {
        uColorLow: { value: new THREE.Color('${biome.layers[0]?.color || '#3b7a36'}') },
        uColorMid: { value: new THREE.Color('${biome.layers[1]?.color || '#8c8c8c'}') },
        uColorHigh: { value: new THREE.Color('${biome.layers[2]?.color || '#ffffff'}') },
        uSunDirection: { value: new THREE.Vector3(100, 150, 50).normalize() }
      }
    });

    // Load exported terrain mesh or heightmap texture
    console.log("Terrain material ready. Import GLB or Heightmap via THREE.GLTFLoader.");

    ${water.enabled ? `
    // 4. Water Plane
    const waterGeo = new THREE.PlaneGeometry(300, 300, 64, 64);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = new THREE.MeshStandardMaterial({
      color: '${water.color}',
      roughness: 0.1,
      metalness: 0.8,
      transparent: true,
      opacity: ${water.transparency}
    });
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.position.y = ${water.level};
    scene.add(waterMesh);
    ` : ''}

    // 5. Render Loop
    function animate(time) {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  </script>
</body>
</html>`;
}
