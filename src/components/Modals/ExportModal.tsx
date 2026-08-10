import React, { useState } from 'react';
import * as THREE from 'three';
import { BiomeConfig, NoiseSettings, WaterSettings } from '../../types';
import { exportToGLTF, exportToUSDZ, generateThreeJsCodeSnippet, downloadBlob } from '../../utils/exportUtils';
import { generateHeightmapCanvas, generateNormalMapCanvas, generateSplatmapCanvas } from '../../utils/mapGenerator';
import { Download, FileCode, X, Copy, Check, Box, Image, Sparkles } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  terrainGroup: THREE.Group | null;
  biome: BiomeConfig;
  noise: NoiseSettings;
  water: WaterSettings;
  heightGrid: Float32Array | null;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  terrainGroup,
  biome,
  noise,
  water,
  heightGrid
}) => {
  const [activeTab, setActiveTab] = useState<'3d' | 'textures' | 'code'>('3d');
  const [copiedCode, setCopiedCode] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const handleExportGLTF = async () => {
    if (!terrainGroup) return;
    setIsExporting(true);
    try {
      await exportToGLTF(terrainGroup, `${biome.id}_terrain.glb`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportUSDZ = async () => {
    if (!terrainGroup) return;
    setIsExporting(true);
    try {
      await exportToUSDZ(terrainGroup, `${biome.id}_terrain.usdz`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadHeightmap = () => {
    const { dataUrl } = generateHeightmapCanvas(512, noise, 200, heightGrid || undefined);
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${biome.id}_heightmap_512x512.png`;
    link.click();
  };

  const handleDownloadNormalMap = () => {
    const { dataUrl } = generateNormalMapCanvas(512, noise, 200, 2.0, heightGrid || undefined);
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${biome.id}_normalmap_512x512.png`;
    link.click();
  };

  const handleDownloadSplatmap = () => {
    const { dataUrl } = generateSplatmapCanvas(512, noise, 200, heightGrid || undefined);
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${biome.id}_splatmap_512x512.png`;
    link.click();
  };

  const codeSnippet = generateThreeJsCodeSnippet(biome, noise, water);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(codeSnippet);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-cyan-400" />
            <h2 className="font-semibold text-slate-100 text-base">Export Game Assets & Code</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/50 p-1 gap-1">
          <button
            onClick={() => setActiveTab('3d')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-lg transition-all ${
              activeTab === '3d'
                ? 'bg-slate-800 text-cyan-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Box className="w-4 h-4" /> 3D Models (glTF / USDZ)
          </button>
          <button
            onClick={() => setActiveTab('textures')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-lg transition-all ${
              activeTab === 'textures'
                ? 'bg-slate-800 text-cyan-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Image className="w-4 h-4" /> Height & Normal Maps
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-lg transition-all ${
              activeTab === 'code'
                ? 'bg-slate-800 text-cyan-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-4 h-4" /> Three.js Integration Code
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {activeTab === '3d' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">
                Export high-density low-drawcall 3D terrain meshes directly into glTF/GLB or Apple USDZ format for standard WebGL engines, Unity, Unreal, or AR preview.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleExportGLTF}
                  disabled={isExporting}
                  className="flex flex-col items-center justify-center p-5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-xl gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] group"
                >
                  <Box className="w-8 h-8 text-cyan-400 group-hover:scale-110 transition-transform" />
                  <span className="font-semibold text-sm text-slate-100">Export Binary glTF (.GLB)</span>
                  <span className="text-[11px] text-slate-400 text-center">
                    Industry standard format for Three.js, Babylon.js, Unity & Unreal Engine.
                  </span>
                </button>

                <button
                  onClick={handleExportUSDZ}
                  disabled={isExporting}
                  className="flex flex-col items-center justify-center p-5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-xl gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] group"
                >
                  <Sparkles className="w-8 h-8 text-amber-400 group-hover:scale-110 transition-transform" />
                  <span className="font-semibold text-sm text-slate-100">Export Apple USDZ (.USDZ)</span>
                  <span className="text-[11px] text-slate-400 text-center">
                    Optimized format for iOS QuickLook AR and Pixar Universal Scene Description.
                  </span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'textures' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">
                Generate 512x512 PNG heightmaps, tangent-space normal maps, and splatmasks for custom game engine shader material blending.
              </p>

              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={handleDownloadHeightmap}
                  className="flex flex-col items-center p-4 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 rounded-lg gap-2 text-center transition-all"
                >
                  <Download className="w-6 h-6 text-cyan-400" />
                  <span className="font-semibold text-xs text-slate-100">Heightmap PNG</span>
                  <span className="text-[10px] text-slate-400">Grayscale 0..255 Elevation</span>
                </button>

                <button
                  onClick={handleDownloadNormalMap}
                  className="flex flex-col items-center p-4 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 rounded-lg gap-2 text-center transition-all"
                >
                  <Download className="w-6 h-6 text-emerald-400" />
                  <span className="font-semibold text-xs text-slate-100">Normal Map PNG</span>
                  <span className="text-[10px] text-slate-400">Tangent Space Tangent RGB</span>
                </button>

                <button
                  onClick={handleDownloadSplatmap}
                  className="flex flex-col items-center p-4 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 rounded-lg gap-2 text-center transition-all"
                >
                  <Download className="w-6 h-6 text-fuchsia-400" />
                  <span className="font-semibold text-xs text-slate-100">Splatmap Mask</span>
                  <span className="text-[10px] text-slate-400">RGB Biome Layer Blend</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'code' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Ready-to-run HTML/Three.js boilerplate reproducing current terrain parameters & custom GLSL shaders:
                </span>
                <button
                  onClick={handleCopyCode}
                  className="flex items-center gap-1.5 px-3 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-md text-xs font-medium transition-all"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedCode ? 'Copied!' : 'Copy Code'}
                </button>
              </div>

              <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-[11px] font-mono text-cyan-300 overflow-x-auto max-h-64 select-all leading-relaxed">
                {codeSnippet}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
