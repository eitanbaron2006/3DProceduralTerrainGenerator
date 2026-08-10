import React from 'react';
import { SculptBrush } from '../../types';
import { Paintbrush, ArrowUp, ArrowDown, Sparkles, Minus, Hand } from 'lucide-react';

interface SculptControlsProps {
  sculpt: SculptBrush;
  onChangeSculpt: (sculpt: SculptBrush) => void;
  onResetHeights: () => void;
}

export const SculptControls: React.FC<SculptControlsProps> = ({
  sculpt,
  onChangeSculpt,
  onResetHeights
}) => {
  const updateSculpt = (key: keyof SculptBrush, value: any) => {
    onChangeSculpt({ ...sculpt, [key]: value });
  };

  const modes: { id: SculptBrush['mode']; label: string; icon: React.ReactNode }[] = [
    { id: 'raise', label: 'Raise Mountain', icon: <ArrowUp className="w-3.5 h-3.5" /> },
    { id: 'lower', label: 'Lower Valley', icon: <ArrowDown className="w-3.5 h-3.5" /> },
    { id: 'smooth', label: 'Smooth Slopes', icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: 'flatten', label: 'Flatten Mesa', icon: <Minus className="w-3.5 h-3.5" /> }
  ];

  return (
    <div className="space-y-5 text-sm text-slate-200">
      {/* Header & Activate Toggle */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-700/60">
        <div className="flex items-center gap-2">
          <Paintbrush className="w-4 h-4 text-cyan-400" />
          <h3 className="font-semibold text-slate-100">Interactive 3D Sculpting Brush</h3>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={sculpt.active}
            onChange={(e) => updateSculpt('active', e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
        </label>
      </div>

      {sculpt.active ? (
        <>
          <p className="text-xs text-cyan-300 bg-cyan-950/40 p-2 rounded border border-cyan-800/50">
            Click & drag directly on the 3D terrain canvas to sculpt the landscape in real time.
          </p>

          {/* Brush Mode Selection */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-300">Brush Mode</span>
            <div className="grid grid-cols-2 gap-2">
              {modes.map((m) => {
                const isActive = sculpt.mode === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => updateSculpt('mode', m.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md border text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    {m.icon}
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Radius Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Brush Radius</span>
              <span className="font-mono text-cyan-300">{sculpt.radius}m</span>
            </div>
            <input
              type="range"
              min="2"
              max="40"
              step="1"
              value={sculpt.radius}
              onChange={(e) => updateSculpt('radius', parseFloat(e.target.value))}
              className="w-full accent-cyan-400 bg-slate-800 rounded-lg cursor-pointer h-1.5"
            />
          </div>

          {/* Strength Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Brush Strength</span>
              <span className="font-mono text-cyan-300">{Math.round(sculpt.strength * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.05"
              max="1.0"
              step="0.05"
              value={sculpt.strength}
              onChange={(e) => updateSculpt('strength', parseFloat(e.target.value))}
              className="w-full accent-cyan-400 bg-slate-800 rounded-lg cursor-pointer h-1.5"
            />
          </div>

          {/* Reset Custom Sculpting */}
          <div className="pt-3 border-t border-slate-700/60">
            <button
              onClick={onResetHeights}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md text-xs font-medium transition-all"
            >
              Reset Custom Sculpting to Noise Base
            </button>
          </div>
        </>
      ) : (
        <div className="text-center py-8 text-slate-500 space-y-2">
          <Hand className="w-8 h-8 mx-auto text-slate-600" />
          <p className="text-xs">Enable brush sculpting above to alter vertex heights directly.</p>
        </div>
      )}
    </div>
  );
};
