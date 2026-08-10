import React from 'react';
import { BookOpen, X, Code, Layers, ShieldCheck, ExternalLink } from 'lucide-react';

interface DocumentationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DocumentationModal: React.FC<DocumentationModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-cyan-400" />
            <h2 className="font-semibold text-slate-100 text-base">Game Engine Integration Documentation</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-300">
          {/* Section 1: Overview */}
          <div className="space-y-2">
            <h3 className="font-semibold text-slate-100 text-base flex items-center gap-2">
              <Code className="w-4 h-4 text-cyan-400" /> 1. Three.js & WebGL Integration
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              This generator outputs standard high-performance GLTF/GLB meshes with indexed vertex buffers and pre-calculated normals. You can load the exported <code className="text-cyan-300 font-mono">.glb</code> file using Three.js's standard <code className="text-cyan-300 font-mono">GLTFLoader</code> or use the exported heightmap texture for vertex displacement in a custom shader material.
            </p>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-md font-mono text-xs text-slate-300 space-y-1">
              <p className="text-slate-500">// Example importing GLB in Three.js</p>
              <p><span className="text-cyan-400">import</span> &#123; GLTFLoader &#125; <span className="text-cyan-400">from</span> <span className="text-emerald-400">'three/addons/loaders/GLTFLoader.js'</span>;</p>
              <p><span className="text-cyan-400">const</span> loader = <span className="text-cyan-400">new</span> GLTFLoader();</p>
              <p>loader.load(<span className="text-emerald-400">'terrain.glb'</span>, (gltf) =&gt; &#123;</p>
              <p className="pl-4">scene.add(gltf.scene);</p>
              <p>&#125;);</p>
            </div>
          </div>

          {/* Section 2: Heightmap & Splatmap Shading */}
          <div className="space-y-2">
            <h3 className="font-semibold text-slate-100 text-base flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" /> 2. Biome Splatmap & Material Blending
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              The exported Splatmap PNG uses the Red, Green, and Blue channels to define texture layer weights across the terrain surface:
            </p>
            <ul className="list-disc list-inside text-xs text-slate-400 space-y-1 pl-2">
              <li><strong className="text-red-400">Red Channel (R):</strong> Flat Valley / Grass / Sand Layer</li>
              <li><strong className="text-emerald-400">Green Channel (G):</strong> Steep Cliff / Rock Texture</li>
              <li><strong className="text-fuchsia-400">Blue Channel (B):</strong> High Altitude Snow / Summit Layer</li>
            </ul>
          </div>

          {/* Section 3: Unity & Unreal Engine */}
          <div className="space-y-2">
            <h3 className="font-semibold text-slate-100 text-base flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-400" /> 3. Unity & Unreal Engine Setup
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              For Unity Terrain or Unreal Engine Landscape system, download the <strong>Heightmap PNG</strong>. In Unity, create a new Terrain object, open Terrain Settings &rarr; Import Heightmap (select 8-bit/16-bit PNG). In Unreal Engine, use the Landscape tool &rarr; Import from File and select the heightmap.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
