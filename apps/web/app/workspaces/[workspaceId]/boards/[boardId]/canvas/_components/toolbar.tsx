'use client';

import React from 'react';
import {
  MousePointer2, Square, Circle, Minus, ArrowRight, Pencil, Type, NotebookPen,
  GitBranch, Undo2, Redo2, Grid3x3, AlignStartVertical, AlignCenterVertical,
  AlignEndVertical, AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
  Layers, ImageIcon, ZoomIn, ZoomOut, Trash2, X,
} from 'lucide-react';
import { useCanvas, type ToolType, type CanvasObject } from '../_context/canvas-state';
import { useCanvasSync } from '../_context/canvas-sync';

const toolGroups: { label: string; tools: { type: ToolType; title: string; icon: React.ComponentType<{ size?: number }> }[] }[] = [
  { label: 'Select', tools: [{ type: 'select', title: 'Select (V)', icon: MousePointer2 }] },
  {
    label: 'Shapes',
    tools: [
      { type: 'rectangle', title: 'Rectangle (R)', icon: Square },
      { type: 'ellipse', title: 'Ellipse (O)', icon: Circle },
      { type: 'line', title: 'Line (L)', icon: Minus },
      { type: 'arrow', title: 'Arrow (A)', icon: ArrowRight },
    ],
  },
  {
    label: 'Text',
    tools: [
      { type: 'text', title: 'Text (T)', icon: Type },
      { type: 'stickyNote', title: 'Sticky note (N)', icon: NotebookPen },
    ],
  },
  {
    label: 'Connector',
    tools: [{ type: 'connector', title: 'Connector (C)', icon: GitBranch }],
  },
];

const fillColors = ['#ffffff', '#f1f5f9', '#fbbf24', '#34d399', '#60a5fa', '#f87171', '#1e293b', '#0f172a'];

const iconBtn =
  'flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-30';

function canvasCenter() {
  const r = document.querySelector<HTMLCanvasElement>('canvas[data-canvas="surface"]')?.getBoundingClientRect();
  return r
    ? { cx: r.width / 2, cy: r.height / 2 }
    : { cx: window.innerWidth / 2, cy: window.innerHeight / 2 };
}

function AlignButton({ icon: Icon, title, onClick }: { icon: React.ComponentType<{ size?: number }>; title: string; onClick: () => void }) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      className="rounded-lg p-1.5 text-surface-400 transition-colors hover:bg-surface-800 hover:text-surface-200"
    >
      <Icon size={15} />
    </button>
  );
}

export function Toolbar() {
  const { state, dispatch } = useCanvas();
  const { persistUpdateMany, persistDelete, syncSnapshot } = useCanvasSync();

  function handleImageUpload() {
    window.dispatchEvent(new CustomEvent('canvas:upload-image'));
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
    const aligned = updates
      .map(u => {
        const base = selected.find(o => o.id === u.id);
        return base ? { ...base, x: u.x ?? base.x, y: u.y ?? base.y } : null;
      })
      .filter((o): o is CanvasObject => o !== null);
    dispatch({ type: 'UPDATE_OBJECTS', payload: updates });
    void persistUpdateMany(aligned);
  }

  function handleDeleteSelected() {
    if (state.selectedIds.length === 0) return;
    dispatch({ type: 'DELETE_OBJECTS', payload: state.selectedIds });
    void persistDelete(state.selectedIds);
  }

  function zoomBy(factor: number) {
    const { cx, cy } = canvasCenter();
    dispatch({ type: 'ZOOM_AT', payload: { scale: state.zoom * factor, cx, cy } });
  }

  const divider = <div className="mx-1 h-5 w-px shrink-0 bg-surface-700" />;

  return (
    <div className="pointer-events-none absolute left-1/2 top-12 z-30 max-w-[calc(100vw-1rem)] -translate-x-1/2">
      <div className="pointer-events-auto flex max-w-full items-center gap-0.5 overflow-x-auto rounded-xl border border-surface-700 bg-surface-900/95 p-1 shadow-xl backdrop-blur-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          title="Undo (Ctrl+Z)"
          aria-label="Undo (Ctrl+Z)"
          onClick={() => {
            const target = state.history.past[state.history.past.length - 1];
            if (!target) return;
            dispatch({ type: 'UNDO' });
            void syncSnapshot(state.objects, target);
          }}
          disabled={state.history.past.length === 0}
          className={`${iconBtn} text-surface-400 hover:bg-surface-800 hover:text-surface-200`}
        >
          <Undo2 size={16} />
        </button>
        <button
          title="Redo (Ctrl+Shift+Z)"
          aria-label="Redo (Ctrl+Shift+Z)"
          onClick={() => {
            const target = state.history.future[0];
            if (!target) return;
            dispatch({ type: 'REDO' });
            void syncSnapshot(state.objects, target);
          }}
          disabled={state.history.future.length === 0}
          className={`${iconBtn} text-surface-400 hover:bg-surface-800 hover:text-surface-200`}
        >
          <Redo2 size={16} />
        </button>

        {divider}

      {/* Pencil tool */}
      <span className="flex shrink-0 items-center">
        {divider}
        <button
          type="button"
          title="Pencil (P)"
          aria-label="Pencil (P)"
          aria-pressed={state.activeTool === 'path'}
          onClick={() => dispatch({ type: 'SET_ACTIVE_TOOL', payload: 'path' })}
          className={`${iconBtn} ${
            state.activeTool === 'path'
              ? 'bg-primary-600 text-white'
              : 'text-surface-400 hover:bg-surface-800 hover:text-surface-200'
          }`}
        >
          <Pencil size={16} />
        </button>
      </span>
        {toolGroups.map((group, gi) => (
          <span key={group.label} className="flex shrink-0 items-center">
            {gi > 0 && divider}
            {group.tools.map((tool) => (
              <button
                key={tool.type}
                title={tool.title}
                aria-label={tool.title}
                aria-pressed={state.activeTool === tool.type}
                onClick={() => dispatch({ type: 'SET_ACTIVE_TOOL', payload: tool.type })}
                className={`${iconBtn} ${
                  state.activeTool === tool.type
                    ? 'bg-primary-600 text-white'
                    : 'text-surface-400 hover:bg-surface-800 hover:text-surface-200'
                }`}
              >
                <tool.icon size={16} />
              </button>
            ))}
          </span>
        ))}

        {divider}

        <button
          title="Upload image"
          aria-label="Upload image"
          onClick={handleImageUpload}
          className={`${iconBtn} text-surface-400 hover:bg-surface-800 hover:text-surface-200`}
        >
          <ImageIcon size={16} />
        </button>

        {divider}

        <div className="flex shrink-0 items-center gap-1 px-1">
          {fillColors.map((color) => (
            <button
              key={color}
              title={color}
              aria-label={`Color ${color}`}
              aria-pressed={state.fillColor === color}
              onClick={() => {
                dispatch({ type: 'SET_FILL_COLOR', payload: color });
                dispatch({ type: 'SET_STROKE_COLOR', payload: color });
              }}
              className={`h-5 w-5 rounded-full border-2 transition-all ${
                state.fillColor === color ? 'scale-110 border-primary-400' : 'border-surface-600'
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>

        {divider}

        <div className="flex shrink-0 items-center gap-2 px-1.5">
          <span className="text-[10px] uppercase tracking-wider text-surface-500">Stroke</span>
          <input
            type="range"
            min={1}
            max={10}
            value={state.strokeWidth}
            onChange={(e) => dispatch({ type: 'SET_STROKE_WIDTH', payload: Number(e.target.value) })}
            className="w-14"
            title="Stroke width"
            aria-label="Stroke width"
          />
          <input
            type="range"
            min={0}
            max={100}
            value={state.opacity}
            onChange={(e) => dispatch({ type: 'SET_OPACITY', payload: Number(e.target.value) })}
            className="w-14"
            title="Opacity"
            aria-label="Opacity"
          />
        </div>

        {divider}

        <div className="flex shrink-0 items-center gap-0.5 px-1">
          <button
            title="Zoom out (Ctrl+scroll down)"
            aria-label="Zoom out"
            onClick={() => zoomBy(0.9)}
            disabled={state.zoom <= 0.25}
            className={`${iconBtn} text-surface-400 hover:bg-surface-800 hover:text-surface-200`}
          >
            <ZoomOut size={15} />
          </button>
          <button
            title="Reset zoom to 100%"
            aria-label="Reset zoom to 100%"
            onClick={() => {
              const { cx, cy } = canvasCenter();
              dispatch({ type: 'ZOOM_AT', payload: { scale: 1, cx, cy } });
            }}
            className={`${iconBtn} min-w-12 px-1 text-xs tabular-nums text-surface-300 hover:bg-surface-800 hover:text-white`}
          >
            {Math.round(state.zoom * 100)}%
          </button>
          <button
            title="Zoom in (Ctrl+scroll up)"
            aria-label="Zoom in"
            onClick={() => zoomBy(1.1)}
            disabled={state.zoom >= 4}
            className={`${iconBtn} text-surface-400 hover:bg-surface-800 hover:text-surface-200`}
          >
            <ZoomIn size={15} />
          </button>
        </div>

        <button
          title="Toggle grid"
          aria-label="Toggle grid"
          aria-pressed={state.gridVisible}
          onClick={() => dispatch({ type: 'TOGGLE_GRID' })}
          className={`${iconBtn} ${
            state.gridVisible ? 'bg-primary-600/20 text-primary-400' : 'text-surface-400 hover:text-surface-200'
          }`}
        >
          <Grid3x3 size={16} />
        </button>

        <button
          title="Toggle layers panel"
          aria-label="Toggle layers panel"
          aria-pressed={state.layersOpen}
          onClick={() => dispatch({ type: 'TOGGLE_LAYERS' })}
          className={`${iconBtn} transition-colors ${
            state.layersOpen ? 'bg-primary-600/20 text-primary-400' : 'text-surface-400 hover:text-surface-200'
          }`}
        >
          <Layers size={16} />
        </button>

        {state.selectedIds.length > 1 && (
          <>
            {divider}
            <AlignButton icon={AlignStartVertical} title="Align left" onClick={() => handleAlign('left')} />
            <AlignButton icon={AlignCenterVertical} title="Align center" onClick={() => handleAlign('center-h')} />
            <AlignButton icon={AlignEndVertical} title="Align right" onClick={() => handleAlign('right')} />
            <AlignButton icon={AlignStartHorizontal} title="Align top" onClick={() => handleAlign('top')} />
            <AlignButton icon={AlignCenterHorizontal} title="Align middle" onClick={() => handleAlign('center-v')} />
            <AlignButton icon={AlignEndHorizontal} title="Align bottom" onClick={() => handleAlign('bottom')} />
          </>
        )}

        {state.selectedIds.length > 0 && (
          <button
            title="Delete selection (Del)"
            aria-label="Delete selection (Del)"
            onClick={handleDeleteSelected}
            className={`${iconBtn} text-red-400/90 hover:bg-red-500/10 hover:text-red-300`}
          >
            <Trash2 size={15} />
          </button>
        )}

        {state.selectedIds.length > 0 && (
          <button
            title="Clear selection (Esc)"
            aria-label="Clear selection (Esc)"
            onClick={() => dispatch({ type: 'CLEAR_SELECTION' })}
            className={`${iconBtn} text-surface-400 hover:bg-surface-800 hover:text-surface-200`}
          >
            <X size={15} />
          </button>
        )}
      </div>
    </div>
  );
}