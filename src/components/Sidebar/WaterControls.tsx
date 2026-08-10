import React from 'react';
import { WaterSettings, BiomeConfig } from '../../types';
import { Waves, Eye, ShieldAlert } from 'lucide-react';

interface WaterControlsProps {
  water: WaterSettings;
  biome: BiomeConfig;
  onChangeWater: (water: WaterSettings) => void;
  onChangeBiome: (biome: BiomeConfig) => void;
}

export const WaterControls: React.FC<WaterControlsProps> = ({
  water,
  biome,
  onChangeWater,
  onChangeBiome
}) => {
  const updateWater = (key: keyof WaterSettings, value: any) => {
    onChangeWater({ ...water, [key]: value });
  };

  return (
    <div className="space-y-5 text-sm text-slate-200">
      {/* Header & Toggle */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-700/60">
        <div className="flex items-center gap-2">
          <Waves className="w-4 h-4 text-cyan-400" />
          <h3 className="font-semibold text-slate-100">Realistic Custom Water Shader</h3>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={water.enabled}
            onChange={(e) => updateWater('enabled', e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
        </label>
      </div>

      {water.enabled ? (
        <>
          {/* Sea Level / Height */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Water Elevation (Sea Level)</span>
              <span className="font-mono text-cyan-300">{water.level}m</span>
            </div>
            <input
              type="range"
              min="0"
              max="60"
              step="0.5"
              value={water.level}
              onChange={(e) => updateWater('level', parseFloat(e.target.value))}
              className="w-full accent-cyan-400 bg-slate-800 rounded-lg cursor-pointer h-1.5"
            />
          </div>

          {/* Wave Speed */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Wave Speed</span>
              <span className="font-mono text-cyan-300">{water.waveSpeed}x</span>
            </div>
            <input
              type="range"
              min="0"
              max="5"
              step="0.1"
              value={water.waveSpeed}
              onChange={(e) => updateWater('waveSpeed', parseFloat(e.target.value))}
              className="w-full accent-cyan-400 bg-slate-800 rounded-lg cursor-pointer h-1.5"
            />
          </div>

          {/* Wave Height */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Wave Amplitude</span>
              <span className="font-mono text-cyan-300">{water.waveHeight}</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="3.0"
              step="0.1"
              value={water.waveHeight}
              onChange={(e) => updateWater('waveHeight', parseFloat(e.target.value))}
              className="w-full accent-cyan-400 bg-slate-800 rounded-lg cursor-pointer h-1.5"
            />
          </div>

          {/* Water Colors */}
          <div className="pt-3 border-t border-slate-700/60 space-y-3">
            <span className="text-xs font-semibold text-slate-300">Water Color Palette</span>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] text-slate-400">Ocean / Lake Body</span>
                <input
                  type="color"
                  value={biome.waterColor}
                  onChange={(e) => onChangeBiome({ ...biome, waterColor: e.target.value })}
                  className="w-full h-8 bg-slate-800 border border-slate-700 rounded cursor-pointer"
                />
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[11px] text-slate-400">Shoreline Foam</span>
                <input
                  type="color"
                  value={biome.waterFoamColor}
                  onChange={(e) => onChangeBiome({ ...biome, waterFoamColor: e.target.value })}
                  className="w-full h-8 bg-slate-800 border border-slate-700 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-8 text-slate-500 space-y-2">
          <ShieldAlert className="w-8 h-8 mx-auto text-slate-600" />
          <p className="text-xs">Water rendering is currently disabled.</p>
        </div>
      )}
    </div>
  );
};
