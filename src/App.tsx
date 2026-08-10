import React, { useState, useRef } from 'react';
import * as THREE from 'three';
import { BiomeConfig, NoiseSettings, ErosionSettings, WaterSettings, SculptBrush, LODSettings, PerformanceStats, ActiveTab, EnvironmentId } from './types';
import { BIOME_PRESETS } from './data/biomes';
import {
  ENVIRONMENT_PRESETS,
  applyEnvironmentAtmosphereToBiome,
  getEnvironmentPreset
} from './data/environments';
import { simulateHydraulicErosion } from './utils/erosion';
import { Viewport3D } from './components/Viewport3D';
import { Header } from './components/Header';
import { TerrainControls } from './components/Sidebar/TerrainControls';
import { BiomeControls } from './components/Sidebar/BiomeControls';
import { WaterControls } from './components/Sidebar/WaterControls';
import { SculptControls } from './components/Sidebar/SculptControls';
import { LODControls } from './components/Sidebar/LODControls';
import { ExportModal } from './components/Modals/ExportModal';
import { DocumentationModal } from './components/Modals/DocumentationModal';
import { Mountain, Palette, Waves, Paintbrush, Cpu, Download } from 'lucide-react';

export default function App() {
  const defaultEnvironmentId: EnvironmentId = 'lakeside-sunrise';
  const defaultEnvironment = getEnvironmentPreset(defaultEnvironmentId);

  // State Initialization
  const [currentBiome, setCurrentBiome] = useState<BiomeConfig>(
    applyEnvironmentAtmosphereToBiome(BIOME_PRESETS[0], defaultEnvironment)
  );
  const [environmentId, setEnvironmentId] = useState<EnvironmentId>(defaultEnvironmentId);
  const environment = getEnvironmentPreset(environmentId);

  const [noise, setNoise] = useState<NoiseSettings>({
    seed: 42,
    scale: 6.5,
    octaves: 5,
    persistance: 0.45,
    lacunarity: 2.2,
    heightMultiplier: 35.0,
    exponent: 1.2,
    ridgeWeight: 0.25,
    terraces: 0,
    islandGradient: false
  });

  const [erosion, setErosion] = useState<ErosionSettings>({
    droplets: 12000,
    erosionRate: 0.05,
    depositionRate: 0.02,
    evaporationRate: 0.015,
    inertia: 0.05,
    gravity: 4.0,
    radius: 3
  });

  const [water, setWater] = useState<WaterSettings>({
    enabled: true,
    level: 8.0,
    transparency: 0.8,
    waveSpeed: 1.2,
    waveHeight: 0.6,
    color: '#1d5a7d',
    shallowColor: '#38bdf8',
    foamWidth: 0.5
  });

  const [sculpt, setSculpt] = useState<SculptBrush>({
    active: false,
    mode: 'raise',
    radius: 12,
    strength: 0.3
  });
  const sculptBrushRef = useRef<SculptBrush>(sculpt);
  sculptBrushRef.current = sculpt;

  const [lod, setLOD] = useState<LODSettings>({
    chunkGridSize: 1,
    resolution: 128,
    enableLOD: true,
    lodDistance1: 100,
    lodDistance2: 250,
    wireframe: false,
    showChunkBounds: false,
    showNormals: false
  });

  const [heightGrid, setHeightGrid] = useState<Float32Array | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('terrain');
  const [isEroding, setIsEroding] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isDocOpen, setIsDocOpen] = useState(false);

  const [stats, setStats] = useState<PerformanceStats>({
    fps: 60,
    triangles: 32000,
    drawCalls: 4,
    chunksRendered: 1,
    memoryMB: 12
  });

  const terrainMeshGroupRef = useRef<THREE.Group | null>(null);

  // Handlers
  const handleRandomizeSeed = () => {
    const newSeed = Math.floor(Math.random() * 999999);
    setNoise((prev) => ({ ...prev, seed: newSeed }));
    setHeightGrid(null); // Reset heightmap grid so noise regenerates
  };

  const handleRunHydraulicErosion = () => {
    if (!heightGrid) return;
    setIsEroding(true);
    setTimeout(() => {
      const eroded = simulateHydraulicErosion(heightGrid, lod.resolution, lod.resolution, erosion);
      setHeightGrid(eroded);
      setIsEroding(false);
    }, 50);
  };

  const handleResetHeightsToNoise = () => {
    setHeightGrid(null);
  };

  const handleSelectBiome = (biome: BiomeConfig) => {
    setCurrentBiome((prev) => ({
      ...biome,
      skyColor: prev.skyColor,
      fogColor: prev.fogColor,
      sunColor: prev.sunColor
    }));
    setWater((prev) => ({ ...prev, color: biome.waterColor }));
  };

  const handleSelectEnvironment = (id: EnvironmentId) => {
    const nextEnvironment = getEnvironmentPreset(id);
    setEnvironmentId(id);
    setCurrentBiome((prev) => applyEnvironmentAtmosphereToBiome(prev, nextEnvironment));
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 font-sans text-slate-100 overflow-hidden select-none">
      {/* App Header */}
      <Header
        currentBiome={currentBiome}
        onSelectBiome={handleSelectBiome}
        onRandomizeSeed={handleRandomizeSeed}
        onOpenExportModal={() => setIsExportOpen(true)}
        onOpenDocModal={() => setIsDocOpen(true)}
        stats={stats}
      />

      {/* Main Studio Viewport & Sidebar Layout */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Left Control Panel Sidebar */}
        <div className="w-80 bg-slate-950/80 border-r border-slate-800/80 flex flex-col z-10 backdrop-blur-md shrink-0">
          {/* Navigation Control Tabs */}
          <div className="flex border-b border-slate-800/80 bg-slate-900/60 p-1 gap-1">
            <button
              onClick={() => setActiveTab('terrain')}
              className={`flex-1 p-2 rounded-md flex flex-col items-center gap-1 text-[11px] font-medium transition-all ${
                activeTab === 'terrain'
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Noise & Elevation"
            >
              <Mountain className="w-4 h-4" />
              <span>Noise</span>
            </button>

            <button
              onClick={() => setActiveTab('biomes')}
              className={`flex-1 p-2 rounded-md flex flex-col items-center gap-1 text-[11px] font-medium transition-all ${
                activeTab === 'biomes'
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Biomes & Atmosphere"
            >
              <Palette className="w-4 h-4" />
              <span>Biomes</span>
            </button>

            <button
              onClick={() => setActiveTab('water')}
              className={`flex-1 p-2 rounded-md flex flex-col items-center gap-1 text-[11px] font-medium transition-all ${
                activeTab === 'water'
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Custom Water Shader"
            >
              <Waves className="w-4 h-4" />
              <span>Water</span>
            </button>

            <button
              onClick={() => setActiveTab('sculpt')}
              className={`flex-1 p-2 rounded-md flex flex-col items-center gap-1 text-[11px] font-medium transition-all ${
                activeTab === 'sculpt'
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="3D Sculpting Brush"
            >
              <Paintbrush className="w-4 h-4" />
              <span>Sculpt</span>
            </button>

            <button
              onClick={() => setActiveTab('lod')}
              className={`flex-1 p-2 rounded-md flex flex-col items-center gap-1 text-[11px] font-medium transition-all ${
                activeTab === 'lod'
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Performance & Mesh Resolution"
            >
              <Cpu className="w-4 h-4" />
              <span>LOD</span>
            </button>
          </div>

          {/* Active Tab Panel Body */}
          <div className="p-4 overflow-y-auto flex-1 space-y-4">
            {activeTab === 'terrain' && (
              <TerrainControls
                noise={noise}
                erosion={erosion}
                onChangeNoise={(n) => {
                  setNoise(n);
                  setHeightGrid(null);
                }}
                onChangeErosion={setErosion}
                onRunErosion={handleRunHydraulicErosion}
                onRandomizeSeed={handleRandomizeSeed}
                isEroding={isEroding}
              />
            )}

            {activeTab === 'biomes' && (
              <BiomeControls
                currentBiome={currentBiome}
                environments={ENVIRONMENT_PRESETS}
                selectedEnvironmentId={environmentId}
                onSelectBiome={handleSelectBiome}
                onSelectEnvironment={handleSelectEnvironment}
                onUpdateBiome={setCurrentBiome}
              />
            )}

            {activeTab === 'water' && (
              <WaterControls
                water={water}
                biome={currentBiome}
                onChangeWater={setWater}
                onChangeBiome={setCurrentBiome}
              />
            )}

            {activeTab === 'sculpt' && (
              <SculptControls
                sculpt={sculpt}
                onChangeSculpt={setSculpt}
                onResetHeights={handleResetHeightsToNoise}
              />
            )}

            {activeTab === 'lod' && (
              <LODControls
                lod={lod}
                onChangeLOD={(newLod) => {
                  setLOD(newLod);
                  if (newLod.resolution !== lod.resolution) {
                    setHeightGrid(null);
                  }
                }}
              />
            )}
          </div>
        </div>

        {/* 3D Interactive WebGL Canvas Viewport */}
        <div className="flex-1 h-full relative bg-slate-950">
          <Viewport3D
            biome={currentBiome}
            environment={environment}
            noise={noise}
            water={water}
            lod={lod}
            sculpt={sculpt}
            heightGrid={heightGrid}
            onHeightGridUpdate={setHeightGrid}
            onStatsUpdate={setStats}
            onTerrainMeshReady={(meshGroup) => {
              terrainMeshGroupRef.current = meshGroup;
            }}
            sculptBrushRef={sculptBrushRef}
          />

          {/* Viewport Floating Help Overlay */}
          <div className="absolute bottom-4 right-4 z-10 flex items-center gap-2 bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 px-3 py-1.5 rounded-lg backdrop-blur-md">
            <span>Mouse Left Click + Drag: Rotate Camera</span>
            <span>•</span>
            <span>Scroll: Zoom</span>
            <span>•</span>
            <span>Right Click: Pan</span>
          </div>
        </div>
      </div>

      {/* Asset Export Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        terrainGroup={terrainMeshGroupRef.current}
        biome={currentBiome}
        noise={noise}
        water={water}
        heightGrid={heightGrid}
      />

      {/* Integration Documentation Modal */}
      <DocumentationModal
        isOpen={isDocOpen}
        onClose={() => setIsDocOpen(false)}
      />
    </div>
  );
}
