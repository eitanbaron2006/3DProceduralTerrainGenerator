import React from 'react';
import { BiomeConfig, EnvironmentId, EnvironmentPreset } from '../../types';
import { BIOME_PRESETS } from '../../data/biomes';
import { Palette, Sun, Cloud, Layers } from 'lucide-react';

interface BiomeControlsProps {
  currentBiome: BiomeConfig;
  environments: EnvironmentPreset[];
  selectedEnvironmentId: EnvironmentId;
  onSelectBiome: (biome: BiomeConfig) => void;
  onSelectEnvironment: (id: EnvironmentId) => void;
  onUpdateBiome: (updatedBiome: BiomeConfig) => void;
}

export const BiomeControls: React.FC<BiomeControlsProps> = ({
  currentBiome,
  environments,
  selectedEnvironmentId,
  onSelectBiome,
  onSelectEnvironment,
  onUpdateBiome
}) => {
  const handleLayerColorChange = (index: number, newColor: string) => {
    const updatedLayers = [...currentBiome.layers];
    updatedLayers[index] = { ...updatedLayers[index], color: newColor };
    onUpdateBiome({ ...currentBiome, layers: updatedLayers });
  };

  return (
    <div className="space-y-5 text-sm text-slate-200">
      {/* Header */}
      <div className="flex items-center gap-2 pb-3 border-b border-slate-700/60">
        <Palette className="w-4 h-4 text-cyan-400" />
        <h3 className="font-semibold text-slate-100">Biome & Atmosphere Presets</h3>
      </div>

      {/* Preset Grid Cards */}
      <div className="grid grid-cols-2 gap-2">
        {BIOME_PRESETS.map((preset) => {
          const isSelected = preset.id === currentBiome.id;
          return (
            <button
              key={preset.id}
              onClick={() => onSelectBiome(preset)}
              className={`flex flex-col text-left p-2.5 rounded-lg border transition-all ${
                isSelected
                  ? 'bg-cyan-500/15 border-cyan-400 text-white shadow-md shadow-cyan-950/30'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <span className="font-semibold text-xs truncate">{preset.name}</span>
                <div
                  className="w-3 h-3 rounded-full border border-slate-700"
                  style={{ backgroundColor: preset.layers[0]?.color || '#3b7a36' }}
                />
              </div>
              <div className="flex gap-1 mt-1">
                {preset.layers.map((l, i) => (
                  <div
                    key={i}
                    className="h-1.5 flex-1 rounded-full"
                    style={{ backgroundColor: l.color }}
                  />
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Biome Description */}
      <p className="text-xs text-slate-400 bg-slate-900/80 p-2.5 rounded-md border border-slate-800 italic">
        {currentBiome.description}
      </p>

      {/* HDRI Environment Selector */}
      <div className="pt-3 border-t border-slate-700/60 space-y-3">
        <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
          <Cloud className="w-3.5 h-3.5 text-sky-300" /> HDRI Skybox
        </h4>
        <div className="grid grid-cols-2 gap-2">
          {environments.map((environment) => {
            const isSelected = environment.id === selectedEnvironmentId;
            return (
              <button
                key={environment.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelectEnvironment(environment.id)}
                className={`rounded-lg border p-2.5 text-left transition-all ${
                  isSelected
                    ? 'bg-cyan-500/15 border-cyan-400 text-white shadow-md shadow-cyan-950/30'
                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                }`}
              >
                <span className="block text-[10px] uppercase tracking-wider text-cyan-300/80">
                  {environment.timeOfDay}
                </span>
                <span className="mt-0.5 block truncate text-xs font-semibold">
                  {environment.name}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-500">
          Skybox selection stays independent from biome presets.
        </p>
      </div>

      {/* Atmosphere Color Pickers */}
      <div className="pt-3 border-t border-slate-700/60 space-y-3">
        <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
          <Sun className="w-3.5 h-3.5 text-amber-400" /> Atmosphere & Sun
        </h4>

        <div className="grid grid-cols-3 gap-2">
          {/* Sky Color */}
          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-slate-400">Sky</span>
            <input
              type="color"
              value={currentBiome.skyColor}
              onChange={(e) => onUpdateBiome({ ...currentBiome, skyColor: e.target.value })}
              className="w-full h-8 bg-slate-800 border border-slate-700 rounded cursor-pointer"
            />
          </div>

          {/* Fog Color */}
          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-slate-400">Fog</span>
            <input
              type="color"
              value={currentBiome.fogColor}
              onChange={(e) => onUpdateBiome({ ...currentBiome, fogColor: e.target.value })}
              className="w-full h-8 bg-slate-800 border border-slate-700 rounded cursor-pointer"
            />
          </div>

          {/* Sun Color */}
          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-slate-400">Sun Light</span>
            <input
              type="color"
              value={currentBiome.sunColor}
              onChange={(e) => onUpdateBiome({ ...currentBiome, sunColor: e.target.value })}
              className="w-full h-8 bg-slate-800 border border-slate-700 rounded cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Biome Layers Color Customization */}
      <div className="pt-3 border-t border-slate-700/60 space-y-3">
        <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-cyan-400" /> Biome Strata & Textures
        </h4>

        <div className="space-y-2">
          {currentBiome.layers.map((layer, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-2 bg-slate-900/60 border border-slate-800 rounded-md"
            >
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={layer.color}
                  onChange={(e) => handleLayerColorChange(index, e.target.value)}
                  className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                />
                <span className="text-xs text-slate-200 font-medium">{layer.name}</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500">
                L{index + 1} ({Math.round(layer.minHeight * 100)}%-{Math.round(layer.maxHeight * 100)}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
