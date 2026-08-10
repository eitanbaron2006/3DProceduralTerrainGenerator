import React from 'react';
import { BiomeConfig, PerformanceStats } from '../types';
import { BIOME_PRESETS } from '../data/biomes';
import { Mountain, Download, BookOpen, Dices, Cpu, Sparkles } from 'lucide-react';

interface HeaderProps {
  currentBiome: BiomeConfig;
  onSelectBiome: (biome: BiomeConfig) => void;
  onRandomizeSeed: () => void;
  onOpenExportModal: () => void;
  onOpenDocModal: () => void;
  stats: PerformanceStats;
}

export const Header: React.FC<HeaderProps> = ({
  currentBiome,
  onSelectBiome,
  onRandomizeSeed,
  onOpenExportModal,
  onOpenDocModal,
  stats
}) => {
  return (
    <header className="h-14 bg-slate-950/90 border-b border-slate-800/80 px-4 flex items-center justify-between z-20 shrink-0 backdrop-blur-md">
      {/* App Branding */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-950/50">
          <Mountain className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-slate-100 text-sm tracking-tight flex items-center gap-2">
            3D Terrain Studio
            <span className="px-2 py-0.5 text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded-full font-mono">
              Three.js GLSL
            </span>
          </h1>
          <p className="text-[11px] text-slate-400 hidden sm:block">
            Procedural Heightmaps, Biomes & WebGL Shaders
          </p>
        </div>
      </div>

      {/* Biome Quick Selector Pills */}
      <div className="hidden lg:flex items-center gap-1.5 bg-slate-900/80 p-1 border border-slate-800/80 rounded-lg">
        {BIOME_PRESETS.slice(0, 4).map((p) => {
          const isSelected = p.id === currentBiome.id;
          return (
            <button
              key={p.id}
              onClick={() => onSelectBiome(p)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                isSelected
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {p.name.split(' ')[0]}
            </button>
          );
        })}
      </div>

      {/* Performance Stats Badge */}
      <div className="hidden md:flex items-center gap-3 text-xs font-mono text-slate-400 bg-slate-900/60 border border-slate-800 px-3 py-1 rounded-lg">
        <div className="flex items-center gap-1 text-emerald-400">
          <Cpu className="w-3.5 h-3.5" />
          <span>{stats.fps} FPS</span>
        </div>
        <span className="text-slate-700">|</span>
        <span>{(stats.triangles / 1000).toFixed(1)}k Tris</span>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={onRandomizeSeed}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg transition-all active:scale-95"
          title="Randomize terrain seed"
        >
          <Dices className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">Randomize</span>
        </button>

        <button
          onClick={onOpenDocModal}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg transition-all active:scale-95"
        >
          <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">Docs</span>
        </button>

        <button
          onClick={onOpenExportModal}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium rounded-lg shadow-lg shadow-cyan-950/40 transition-all active:scale-95"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Assets</span>
        </button>
      </div>
    </header>
  );
};
