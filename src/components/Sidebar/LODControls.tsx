import React from 'react';
import { LODSettings } from '../../types';
import { Cpu, Grid3X3, Eye } from 'lucide-react';

interface LODControlsProps {
  lod: LODSettings;
  onChangeLOD: (lod: LODSettings) => void;
}

export const LODControls: React.FC<LODControlsProps> = ({ lod, onChangeLOD }) => {
  const updateLOD = (key: keyof LODSettings, value: any) => {
    onChangeLOD({ ...lod, [key]: value });
  };

  const resolutions = [
    { value: 64, label: '64 x 64 (Fast)' },
    { value: 128, label: '128 x 128 (Balanced)' },
    { value: 256, label: '256 x 256 (High Ultra)' }
  ];

  return (
    <div className="space-y-5 text-sm text-slate-200">
      {/* Header */}
      <div className="flex items-center gap-2 pb-3 border-b border-slate-700/60">
        <Cpu className="w-4 h-4 text-cyan-400" />
        <h3 className="font-semibold text-slate-100">Performance & Level of Detail (LOD)</h3>
      </div>

      {/* Grid Resolution */}
      <div className="space-y-2">
        <span className="text-xs font-semibold text-slate-300">Base Mesh Resolution</span>
        <div className="space-y-1.5">
          {resolutions.map((r) => (
            <button
              key={r.value}
              onClick={() => updateLOD('resolution', r.value)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-md border text-xs font-medium transition-all ${
                lod.resolution === r.value
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300'
              }`}
            >
              <span>{r.label}</span>
              <span className="font-mono text-[11px] text-slate-400">
                {(r.value * r.value).toLocaleString()} Verts
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Wireframe Toggle */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-700/60">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <Grid3X3 className="w-4 h-4 text-cyan-400" />
          <span>Wireframe Overlay</span>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={lod.wireframe}
            onChange={(e) => updateLOD('wireframe', e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
        </label>
      </div>

      {/* Bounding Box Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <Eye className="w-4 h-4 text-cyan-400" />
          <span>Show Chunk Bounding Box</span>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={lod.showChunkBounds}
            onChange={(e) => updateLOD('showChunkBounds', e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
        </label>
      </div>
    </div>
  );
};
