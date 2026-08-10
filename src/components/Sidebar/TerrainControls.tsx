import React from 'react';
import { NoiseSettings, ErosionSettings } from '../../types';
import { Sparkles, Dices, RefreshCw, Layers, Mountain, Waves } from 'lucide-react';

interface TerrainControlsProps {
  noise: NoiseSettings;
  erosion: ErosionSettings;
  onChangeNoise: (newNoise: NoiseSettings) => void;
  onChangeErosion: (newErosion: ErosionSettings) => void;
  onRunErosion: () => void;
  onRandomizeSeed: () => void;
  isEroding: boolean;
}

export const TerrainControls: React.FC<TerrainControlsProps> = ({
  noise,
  erosion,
  onChangeNoise,
  onChangeErosion,
  onRunErosion,
  onRandomizeSeed,
  isEroding
}) => {
  const updateNoise = (key: keyof NoiseSettings, value: any) => {
    onChangeNoise({ ...noise, [key]: value });
  };

  const updateErosion = (key: keyof ErosionSettings, value: any) => {
    onChangeErosion({ ...erosion, [key]: value });
  };

  return (
    <div className="space-y-5 text-sm text-slate-200">
      {/* Header & Seed */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-700/60">
        <div className="flex items-center gap-2">
          <Mountain className="w-4 h-4 text-cyan-400" />
          <h3 className="font-semibold text-slate-100">Procedural Noise Stack</h3>
        </div>
        <button
          onClick={onRandomizeSeed}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-md transition-all active:scale-95"
        >
          <Dices className="w-3.5 h-3.5" />
          Random Seed
        </button>
      </div>

      {/* Seed Input */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-slate-400">
          <span>Seed ID</span>
          <span className="font-mono text-cyan-300">{noise.seed}</span>
        </div>
        <input
          type="number"
          value={noise.seed}
          onChange={(e) => updateNoise('seed', parseInt(e.target.value) || 0)}
          className="w-full bg-slate-900/80 border border-slate-700/80 rounded-md px-3 py-1.5 text-xs text-slate-100 font-mono focus:border-cyan-500 focus:outline-none"
        />
      </div>

      {/* Height Multiplier */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-slate-400">
          <span>Height Amplitude</span>
          <span className="font-mono text-cyan-300">{noise.heightMultiplier}m</span>
        </div>
        <input
          type="range"
          min="5"
          max="120"
          step="1"
          value={noise.heightMultiplier}
          onChange={(e) => updateNoise('heightMultiplier', parseFloat(e.target.value))}
          className="w-full accent-cyan-400 bg-slate-800 rounded-lg cursor-pointer h-1.5"
        />
      </div>

      {/* Noise Scale */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-slate-400">
          <span>Noise Frequency Scale</span>
          <span className="font-mono text-cyan-300">{noise.scale}</span>
        </div>
        <input
          type="range"
          min="1"
          max="20"
          step="0.5"
          value={noise.scale}
          onChange={(e) => updateNoise('scale', parseFloat(e.target.value))}
          className="w-full accent-cyan-400 bg-slate-800 rounded-lg cursor-pointer h-1.5"
        />
      </div>

      {/* Octaves */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-slate-400">
          <span>Octaves (Detail Layers)</span>
          <span className="font-mono text-cyan-300">{noise.octaves}</span>
        </div>
        <input
          type="range"
          min="1"
          max="8"
          step="1"
          value={noise.octaves}
          onChange={(e) => updateNoise('octaves', parseInt(e.target.value))}
          className="w-full accent-cyan-400 bg-slate-800 rounded-lg cursor-pointer h-1.5"
        />
      </div>

      {/* Ridge Noise Weight */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-slate-400">
          <span>Ridge Sharpening</span>
          <span className="font-mono text-cyan-300">{Math.round(noise.ridgeWeight * 100)}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={noise.ridgeWeight}
          onChange={(e) => updateNoise('ridgeWeight', parseFloat(e.target.value))}
          className="w-full accent-cyan-400 bg-slate-800 rounded-lg cursor-pointer h-1.5"
        />
      </div>

      {/* Terraces */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-slate-400">
          <span>Terrace Steps</span>
          <span className="font-mono text-cyan-300">{noise.terraces === 0 ? 'Off' : `${noise.terraces} Steps`}</span>
        </div>
        <input
          type="range"
          min="0"
          max="16"
          step="1"
          value={noise.terraces}
          onChange={(e) => updateNoise('terraces', parseInt(e.target.value))}
          className="w-full accent-cyan-400 bg-slate-800 rounded-lg cursor-pointer h-1.5"
        />
      </div>

      {/* Island Falloff Toggle */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-slate-300">Island Radial Falloff</span>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={noise.islandGradient}
            onChange={(e) => updateNoise('islandGradient', e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
        </label>
      </div>

      {/* Hydraulic Erosion Pass */}
      <div className="pt-4 border-t border-slate-700/60 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-slate-200">
            <Waves className="w-4 h-4 text-cyan-400" />
            <span className="font-semibold text-xs">Hydraulic Erosion Simulation</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Rain Droplet Count</span>
            <span className="font-mono text-cyan-300">{erosion.droplets}</span>
          </div>
          <input
            type="range"
            min="2000"
            max="40000"
            step="2000"
            value={erosion.droplets}
            onChange={(e) => updateErosion('droplets', parseInt(e.target.value))}
            className="w-full accent-cyan-400 bg-slate-800 rounded-lg cursor-pointer h-1.5"
          />
        </div>

        <button
          onClick={onRunErosion}
          disabled={isEroding}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-md font-medium text-xs shadow-lg shadow-cyan-950/40 transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {isEroding ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Simulating Water Flow & Sediment...
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              Run Hydraulic Erosion Pass
            </>
          )}
        </button>
      </div>
    </div>
  );
};
