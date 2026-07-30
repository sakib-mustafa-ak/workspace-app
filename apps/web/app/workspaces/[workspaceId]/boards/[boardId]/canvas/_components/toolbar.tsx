'use client';

import React, { useRef, useState } from 'react';
import {
  MousePointer2, Square, Circle, Minus, ArrowRight, Type, StickyNote,
  GitBranch, Undo2, Redo2, Grid3x3, AlignStartVertical, AlignCenterVertical,
  AlignEndVertical, AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
  Layers, ImageIcon,
} from 'lucide-react';
import { useCanvas, type ToolType, type CanvasObject } from '../_context/canvas-state';

const toolGroups: { label: string; tools: { type: ToolType; icon: React.ComponentType<{ size?: number }> }[] }[] = [
  { label: 'Select', tools: [{ type: 'select', icon: MousePointer2 }] },
  {
    label: 'Shapes',
    tools: [
      { type: 'rectangle', icon: Square },
      { type: 'ellipse', icon: Circle },
      { type: 'line', icon: Minus },
      { type: 'arrow', icon: ArrowRight },
    ],
  },
  {
    label: 'Text',
    tools: [
      { type: 'text', icon: Type },
      { type: 'stickyNote', icon: StickyNote },
    ],
  },
  {
    label: 'Connect',
    tools: [{ type: 'connector', icon: GitBranch }],
  },
];

const fillColors = ['#ffffff', '#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#9b59b6', '#000000'];

function AlignButton({ icon: Icon, title, onClick }: { icon: React.ComponentType<{ size?: number }>; title: string; onClick: () => void }) {
  return (
    <button title={title} onClick={onClick} className="rounded-lg p-2 text-surface-400 transition-colors hover:bg-surface-800 hover:text-surface-200">
      <Icon size={16} />
    </button>
  );
}

export function Toolbar() {
  const { state, dispatch } = useCanvas();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [showLayers, setShowLayers] = useState(false);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const obj: CanvasObject = {
          id: crypto.randomUUID(),
          type: 'image',
          x: 50, y: 50,
          width: img.width, height: img.height,
          rotation: 0, fill: '#fff', stroke: '#000', strokeWidth: 0, opacity: 1,
          imageData: dataUrl,
          zIndex: state.objects.length,
        };
        dispatch({ type: 'ADD_OBJECT', payload: obj });
        dispatch({ type: 'SELECT', payload: [obj.id] });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function handleAlign(dir: 'left' | 'center-h' | 'right' | 'top' | 'center-v' | 'bottom') {
    const selected = state.objects.filter(o => state.selectedIds.includes(o.id));
    if (selected.length < 2) return;
    const ref = selected[0];
    if (!ref) return;
    const updates = selected.map(o => {
      if (o.id === ref.id) return { id: o.id };
      switch (dir) {
        case 'left': return { id: o.id, x: ref.x };
        case 'center-h': return { id: o.id, x: ref.x + ref.width / 2 - o.width / 2 };
        case 'right': return { id: o.id, x: ref.x + ref.width - o.width };
        case 'top': return { id: o.id, y: ref.y };
        case 'center-v': return { id: o.id, y: ref.y + ref.height / 2 - o.height / 2 };
        case 'bottom': return { id: o.id, y: ref.y + ref.height - o.height };
      }
    });
    dispatch({ type: 'UPDATE_OBJECTS', payload: updates });
  }

  return (
    <div className="pointer-events-none absolute left-1/2 top-12 z-50 -translate-x-1/2">
      <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-surface-700 bg-surface-900/95 p-1 shadow-xl backdrop-blur-sm">
        <button
          title="Undo (Ctrl+Z)"
          onClick={() => dispatch({ type: 'UNDO' })}
          disabled={state.history.past.length === 0}
          className="rounded-lg p-2 text-surface-400 transition-colors hover:bg-surface-800 hover:text-surface-200 disabled:opacity-30"
        >
          <Undo2 size={18} />
        </button>
        <button
          title="Redo (Ctrl+Shift+Z)"
          onClick={() => dispatch({ type: 'REDO' })}
          disabled={state.history.future.length === 0}
          className="rounded-lg p-2 text-surface-400 transition-colors hover:bg-surface-800 hover:text-surface-200 disabled:opacity-30"
        >
          <Redo2 size={18} />
        </button>

        <div className="mx-1 h-6 w-px bg-surface-700" />

        {toolGroups.map((group, gi) => (
          <span key={group.label}>
            {gi > 0 && <div className="mx-1 h-6 w-px bg-surface-700" />}
            {group.tools.map((tool) => (
              <button
                key={tool.type}
                title={tool.type}
                onClick={() => dispatch({ type: 'SET_ACTIVE_TOOL', payload: tool.type })}
                className={`rounded-lg p-2 transition-colors ${
                  state.activeTool === tool.type
                    ? 'bg-primary-600 text-white'
                    : 'text-surface-400 hover:bg-surface-800 hover:text-surface-200'
                }`}
              >
                <tool.icon size={18} />
              </button>
            ))}
          </span>
        ))}

        <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
        <button title="Upload image" onClick={() => imageInputRef.current?.click()} className="rounded-lg p-2 text-surface-400 transition-colors hover:bg-surface-800 hover:text-surface-200">
          <ImageIcon size={18} />
        </button>

        {state.activeTool === 'stickyNote' && (
          <>
            <div className="mx-1 h-6 w-px bg-surface-700" />
            <div className="flex items-center gap-1 px-1">
              {['#ffd93d', '#6bcb77', '#4d96ff', '#ff6b6b', '#ff9ff3', '#ffa502', '#ffffff'].map(color => (
                <button
                  key={color}
                  title={color}
                  onClick={() => dispatch({ type: 'SET_FILL_COLOR', payload: color })}
                  className={`h-5 w-5 rounded-full border-2 ${state.fillColor === color ? 'scale-125 border-primary-400' : 'border-surface-600'}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </>
        )}

        <div className="mx-1 h-6 w-px bg-surface-700" />

        <button
          title="Toggle layers panel"
          onClick={() => setShowLayers((p) => !p)}
          className={`rounded-lg p-2 transition-colors hover:bg-surface-800 hover:text-surface-200 ${showLayers ? 'text-primary-400 bg-surface-800' : 'text-surface-400'}`}
        >
          <Layers size={18} />
        </button>

        <div className="mx-1 h-6 w-px bg-surface-700" />

        {state.selectedIds.length > 1 && (
          <>
            <AlignButton icon={AlignStartVertical} title="Align left" onClick={() => handleAlign('left')} />
            <AlignButton icon={AlignCenterVertical} title="Align center" onClick={() => handleAlign('center-h')} />
            <AlignButton icon={AlignEndVertical} title="Align right" onClick={() => handleAlign('right')} />
            <AlignButton icon={AlignStartHorizontal} title="Align top" onClick={() => handleAlign('top')} />
            <AlignButton icon={AlignCenterHorizontal} title="Align middle" onClick={() => handleAlign('center-v')} />
            <AlignButton icon={AlignEndHorizontal} title="Align bottom" onClick={() => handleAlign('bottom')} />
            <div className="mx-1 h-6 w-px bg-surface-700" />
          </>
        )}

        <button
          title="Toggle grid"
          onClick={() => dispatch({ type: 'TOGGLE_GRID' })}
          className={`rounded-lg p-2 transition-colors ${
            state.gridVisible ? 'bg-primary-600/20 text-primary-400' : 'text-surface-400 hover:text-surface-200'
          }`}
        >
          <Grid3x3 size={18} />
        </button>

        <div className="mx-1 h-6 w-px bg-surface-700" />

        <div className="flex items-center gap-1 px-1">
          {fillColors.map((color) => (
            <button
              key={color}
              title={color}
              onClick={() => dispatch({ type: 'SET_FILL_COLOR', payload: color })}
              className={`h-5 w-5 rounded-full border-2 transition-transform ${
                state.fillColor === color ? 'scale-125 border-primary-400' : 'border-surface-600'
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>

        <div className="mx-1 h-6 w-px bg-surface-700" />

        <input
          type="range"
          min={1}
          max={10}
          value={state.strokeWidth}
          onChange={(e) => dispatch({ type: 'SET_STROKE_WIDTH', payload: Number(e.target.value) })}
          className="w-16"
          title="Stroke width"
        />

        <input
          type="range"
          min={0}
          max={100}
          value={state.opacity}
          onChange={(e) => dispatch({ type: 'SET_OPACITY', payload: Number(e.target.value) })}
          className="w-16"
          title="Opacity"
        />

        <span className="ml-1 text-xs text-surface-500">{Math.round(state.zoom * 100)}%</span>
      </div>
    </div>
  );
}
