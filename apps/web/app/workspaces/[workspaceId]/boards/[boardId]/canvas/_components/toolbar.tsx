'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  MousePointer2, Square, Circle, Minus, ArrowRight, Pencil, Type, NotebookPen,
  GitBranch, Undo2, Redo2, Grid3x3, AlignStartVertical, AlignCenterVertical,
  AlignEndVertical, AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
  Layers, ImageIcon, ZoomIn, ZoomOut, Trash2, X, Eraser, Check, ChevronDown, Link2,
} from 'lucide-react';
import { useCanvas, type ToolType, type CanvasObject } from '../_context/canvas-state';
import { useCanvasSync } from '../_context/canvas-sync';

type IconType = React.ComponentType<{ size?: number; className?: string }>;

type ToolDef = {
  type: ToolType;
  label: string;
  shortcut: string;
  icon: IconType;
};

/**
 * Tool groups mirror how Office / Google Docs ribbon menus are organized:
 * Select · Draw · Shapes · Text · Connectors. The menu shows sections so a
 * power user can find a tool by category, and each row carries its shortcut.
 */
const toolGroups: { label: string; tools: ToolDef[] }[] = [
  { label: 'Select', tools: [{ type: 'select', label: 'Select', shortcut: 'V', icon: MousePointer2 }] },
  {
    label: 'Draw',
    tools: [{ type: 'path', label: 'Pencil', shortcut: 'P', icon: Pencil }, { type: 'eraser', label: 'Eraser', shortcut: 'E', icon: Eraser }],
  },
  {
    label: 'Shapes',
    tools: [
      { type: 'rectangle', label: 'Rectangle', shortcut: 'R', icon: Square },
      { type: 'ellipse', label: 'Ellipse', shortcut: 'O', icon: Circle },
      { type: 'line', label: 'Line', shortcut: 'L', icon: Minus },
      { type: 'arrow', label: 'Arrow', shortcut: 'A', icon: ArrowRight },
    ],
  },
  {
    label: 'Text',
    tools: [
      { type: 'text', label: 'Text', shortcut: 'T', icon: Type },
      { type: 'stickyNote', label: 'Sticky note', shortcut: 'N', icon: NotebookPen },
    ],
  },
  { label: 'Connect', tools: [{ type: 'connector', label: 'Connector', shortcut: 'C', icon: GitBranch }] },
];

const allTools = toolGroups.flatMap((g) => g.tools);

const fillColors = ['#ffffff', '#f1f5f9', '#fbbf24', '#34d399', '#60a5fa', '#f87171', '#1e293b', '#0f172a'];

/** Compact ribbon control: 28px, 8px corners, quiet at rest, tonal hover. */
const iconBtn =
  'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-surface-400 transition-colors duration-150 ' +
  'hover:bg-surface-800 hover:text-surface-100 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/60 ' +
  'disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-surface-400';

const divider = <div className="mx-1 h-4 w-px shrink-0 bg-surface-700/80" aria-hidden="true" />;

function canvasCenter() {
  const r = document.querySelector<HTMLCanvasElement>('canvas[data-canvas="surface"]')?.getBoundingClientRect();
  return r
    ? { cx: r.width / 2, cy: r.height / 2 }
    : { cx: window.innerWidth / 2, cy: window.innerHeight / 2 };
}

function useDismiss(onClose: () => void, insideRefs: React.RefObject<HTMLElement | null>[] = []) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function isInside(node: Node | null): boolean {
      if (!node) return false;
      if (ref.current?.contains(node)) return true;
      return insideRefs.some((r) => r.current?.contains(node));
    }
    function onDoc(e: MouseEvent) {
      if (!isInside(e.target as Node | null)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose, insideRefs]);
  return ref;
}

/** The ribbon menu trigger: label + icon + chevron, matches Office's compact buttons. */
function Dropdown({
  label,
  icon: Icon,
  children,
  align = 'left',
  className = '',
}: {
  label: string;
  icon?: IconType;
  children: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const ref = useDismiss(() => setOpen(false), [menuRef]);

  // The ribbon scrolls with overflow-x-auto, which clips absolutely-positioned
  // children. Render the menu through a portal to <body> and position it from
  // the trigger's bounding rect so it always floats above the canvas.
  useEffect(() => {
    if (!open) return;
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    setPos({
      top: rect.bottom + 6,
      left: rect.left,
      right: window.innerWidth - rect.right,
    });
    function onScroll() {
      if (menuRef.current && menuRef.current.contains(document.activeElement)) return;
      setOpen(false);
    }
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        ref={btnRef}
        type="button"
        title={label}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`flex h-7 items-center gap-1.5 rounded-lg px-2 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/60 ${
          open
            ? 'bg-surface-800 text-surface-100'
            : 'text-surface-300 hover:bg-surface-800/70 hover:text-surface-100'
        } ${className}`}
      >
        {Icon && <Icon size={15} className={open ? 'text-primary-400' : ''} />}
        <span className="max-w-24 truncate whitespace-nowrap">{label}</span>
        <ChevronDown size={12} className={`text-surface-500 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={label}
            style={{
              top: pos.top,
              left: align === 'right' ? undefined : pos.left,
              right: align === 'right' ? pos.right : undefined,
            }}
            className="fixed z-[100] min-w-52 rounded-xl border border-surface-700/80 bg-surface-900/95 p-1.5 shadow-xl shadow-black/40 backdrop-blur-sm"
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </div>,
          document.body,
        )}
    </div>
  );
}

function MenuSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-1 last:mb-0">
      <p className="px-2 pb-1 pt-2 text-[10px] font-medium uppercase tracking-[0.08em] text-surface-500 first:pt-0.5">
        {label}
      </p>
      <div>{children}</div>
    </div>
  );
}

function ToolRow({ tool, active, onPick }: { tool: ToolDef; active: boolean; onPick: () => void }) {
  const Icon = tool.icon;
  return (
    <button
      role="menuitemradio"
      aria-checked={active}
      onClick={onPick}
      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/60 ${
        active
          ? 'bg-primary-600/15 text-primary-200'
          : 'text-surface-300 hover:bg-surface-800 hover:text-surface-100'
      }`}
    >
      <Icon size={15} className={active ? 'text-primary-400' : 'text-surface-500'} />
      <span className="flex-1">{tool.label}</span>
      {active && <Check size={13} className="text-primary-400" />}
      {!active && <span className="text-[10px] tabular-nums text-surface-600">{tool.shortcut}</span>}
    </button>
  );
}

function AlignButton({ icon: Icon, title, onClick }: { icon: IconType; title: string; onClick: () => void }) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`${iconBtn}`}
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
    const selected = state.objects.filter((o) => state.selectedIds.includes(o.id));
    if (selected.length < 2) return;
    const ref = selected[0];
    if (!ref) return;
    const updates = selected.map((o) => {
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
      .map((u) => {
        const base = selected.find((o) => o.id === u.id);
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

  const activeTool = allTools.find((t) => t.type === state.activeTool) ?? allTools[0]!;
  const ActiveIcon = activeTool.icon;

  const hasSelection = state.selectedIds.length > 0;
  const multiSelect = state.selectedIds.length > 1;

  return (
    <div className="pointer-events-none absolute left-1/2 top-12 z-30 max-w-[calc(100vw-0.75rem)] -translate-x-1/2">
      <div className="pointer-events-auto flex max-w-full items-center gap-0.5 overflow-x-auto rounded-xl border border-surface-700/80 bg-surface-900/95 p-1 shadow-xl shadow-black/25 backdrop-blur-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* History */}
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
          className={iconBtn}
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
          className={iconBtn}
        >
          <Redo2 size={16} />
        </button>

        {divider}

        {/* Tools */}
        <Dropdown label={activeTool.label} icon={ActiveIcon}>
          {toolGroups.map((group) => (
            <MenuSection key={group.label} label={group.label}>
              {group.tools.map((tool) => (
                <ToolRow
                  key={tool.type}
                  tool={tool}
                  active={state.activeTool === tool.type}
                  onPick={() => dispatch({ type: 'SET_ACTIVE_TOOL', payload: tool.type })}
                />
              ))}
            </MenuSection>
          ))}
        </Dropdown>

        {/* Insert */}
        <button
          title="Upload image"
          aria-label="Upload image"
          onClick={handleImageUpload}
          className={iconBtn}
        >
          <ImageIcon size={16} />
        </button>

        {divider}

        {/* Color: separated Fill / Stroke slots + palette */}
        <Dropdown label="Color" align="right" className="pr-1.5">
          <div className="w-56 px-2 py-1">
            <div className="mb-2 flex items-center gap-2">
              <div className="flex flex-1 items-center gap-1.5 rounded-lg bg-surface-800/60 px-1.5 py-1">
                <span
                  className="h-4 w-4 shrink-0 rounded-full border border-surface-600 shadow-inner"
                  style={{ backgroundColor: state.fillColor }}
                />
                <span className="text-[10px] uppercase tracking-wider text-surface-400">Fill</span>
              </div>
              <div className="flex flex-1 items-center gap-1.5 rounded-lg bg-surface-800/60 px-1.5 py-1">
                <span
                  className="h-4 w-4 shrink-0 rounded-full border border-surface-600 shadow-inner"
                  style={{ backgroundColor: state.strokeColor }}
                />
                <span className="text-[10px] uppercase tracking-wider text-surface-400">Stroke</span>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {fillColors.map((color) => (
                <button
                  key={color}
                  title={color}
                  aria-label={`Color ${color}`}
                  aria-pressed={state.fillColor === color && state.strokeColor === color}
                  onClick={() => {
                    dispatch({ type: 'SET_FILL_COLOR', payload: color });
                    dispatch({ type: 'SET_STROKE_COLOR', payload: color });
                  }}
                  className={`flex h-6 items-center justify-center rounded-md border-2 transition-all duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/60 ${
                    state.fillColor === color || state.strokeColor === color
                      ? 'scale-105 border-primary-400'
                      : 'border-surface-700 hover:border-surface-500'
                  }`}
                  style={{ backgroundColor: color }}
                >
                  {(state.fillColor === color || state.strokeColor === color) && (
                    <Check size={12} className={isLightColor(color) ? 'text-surface-900' : 'text-white'} />
                  )}
                </button>
              ))}
            </div>
            <p className="mt-2 flex items-center gap-1 px-0.5 text-[10px] text-surface-600">
              <Link2 size={10} />
              Applies to fill and stroke
            </p>
          </div>
        </Dropdown>

        {/* Stroke */}
        <Dropdown label={`${state.strokeWidth}px`} align="right" className="pr-1.5">
          <div className="w-60 px-3 py-2">
            <div className="mb-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase tracking-wider text-surface-500">Stroke width</span>
                <span className="text-xs tabular-nums text-surface-300">{state.strokeWidth}px</span>
              </div>
              {/* Live stroke preview: a real line at the selected width and color */}
              <div className="mb-2 flex h-10 items-center justify-center rounded-lg border border-surface-800 bg-surface-950">
                <span
                  className="block w-4/5 rounded-full"
                  style={{
                    height: Math.max(Math.min(state.strokeWidth * 2.4, 32), 1),
                    backgroundColor: state.strokeColor,
                    boxShadow: `0 0 0 1px rgba(148,163,184,0.25)`,
                  }}
                />
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={state.strokeWidth}
                onChange={(e) => dispatch({ type: 'SET_STROKE_WIDTH', payload: Number(e.target.value) })}
                className="w-full accent-primary-500"
                title="Stroke width"
                aria-label="Stroke width"
              />
              <div className="mt-1 flex justify-between px-0.5 text-[10px] tabular-nums text-surface-600">
                <span>1</span>
                <span>5</span>
                <span>10</span>
              </div>
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase tracking-wider text-surface-500">Opacity</span>
                <span className="text-xs tabular-nums text-surface-300">{state.opacity}%</span>
              </div>
              {/* Checkerboard transparency preview at the current opacity */}
              <div
                className="mb-2 h-8 rounded-lg border border-surface-800 bg-surface-950"
                style={{
                  backgroundImage:
                    'conic-gradient(rgba(148,163,184,0.35) 25%, transparent 0 50%, rgba(148,163,184,0.35) 0 75%, transparent 0)',
                  backgroundSize: '10px 10px',
                }}
              >
                <div
                  className="h-full w-full rounded-[7px]"
                  style={{ backgroundColor: state.strokeColor, opacity: state.opacity / 100 }}
                />
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={state.opacity}
                onChange={(e) => dispatch({ type: 'SET_OPACITY', payload: Number(e.target.value) })}
                className="w-full accent-primary-500"
                title="Opacity"
                aria-label="Opacity"
              />
              <div className="mt-1 flex justify-between px-0.5 text-[10px] tabular-nums text-surface-600">
                <span>0</span>
                <span>50</span>
                <span>100</span>
              </div>
            </div>
          </div>
        </Dropdown>

        {divider}

        {/* Zoom */}
        <div className="flex shrink-0 items-center">
          <button
            title="Zoom out (Ctrl+scroll down)"
            aria-label="Zoom out"
            onClick={() => zoomBy(0.9)}
            disabled={state.zoom <= 0.25}
            className={iconBtn}
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
            className="h-7 min-w-11 shrink-0 rounded-lg px-1 text-center text-xs tabular-nums text-surface-300 transition-colors duration-150 hover:bg-surface-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/60"
          >
            {Math.round(state.zoom * 100)}%
          </button>
          <button
            title="Zoom in (Ctrl+scroll up)"
            aria-label="Zoom in"
            onClick={() => zoomBy(1.1)}
            disabled={state.zoom >= 4}
            className={iconBtn}
          >
            <ZoomIn size={15} />
          </button>
        </div>

        <div className="mx-0.5 h-4 w-px shrink-0 bg-surface-700/80" aria-hidden="true" />

        {/* View toggles */}
        <button
          title="Toggle grid"
          aria-label="Toggle grid"
          aria-pressed={state.gridVisible}
          onClick={() => dispatch({ type: 'TOGGLE_GRID' })}
          className={`${iconBtn} ${
            state.gridVisible ? 'bg-primary-600/15 text-primary-400' : ''
          }`}
        >
          <Grid3x3 size={16} />
        </button>
        <button
          title="Toggle layers panel"
          aria-label="Toggle layers panel"
          aria-pressed={state.layersOpen}
          onClick={() => dispatch({ type: 'TOGGLE_LAYERS' })}
          className={`${iconBtn} ${
            state.layersOpen ? 'bg-primary-600/15 text-primary-400' : ''
          }`}
        >
          <Layers size={16} />
        </button>

        {/* Contextual actions — fixed slots so they never shift the ribbon */}
        {multiSelect && (
          <>
            {divider}
            <div className="flex shrink-0 items-center">
              <AlignButton icon={AlignStartVertical} title="Align left" onClick={() => handleAlign('left')} />
              <AlignButton icon={AlignCenterVertical} title="Align center" onClick={() => handleAlign('center-h')} />
              <AlignButton icon={AlignEndVertical} title="Align right" onClick={() => handleAlign('right')} />
              <AlignButton icon={AlignStartHorizontal} title="Align top" onClick={() => handleAlign('top')} />
              <AlignButton icon={AlignCenterHorizontal} title="Align middle" onClick={() => handleAlign('center-v')} />
              <AlignButton icon={AlignEndHorizontal} title="Align bottom" onClick={() => handleAlign('bottom')} />
            </div>
          </>
        )}

        {hasSelection && (
          <>
            {divider}
            <button
              title="Delete selection (Del)"
              aria-label="Delete selection (Del)"
              onClick={handleDeleteSelected}
              className={`${iconBtn} text-red-400/90 hover:bg-red-500/10 hover:text-red-300 focus-visible:ring-red-500/60`}
            >
              <Trash2 size={15} />
            </button>
            <button
              title="Clear selection (Esc)"
              aria-label="Clear selection (Esc)"
              onClick={() => dispatch({ type: 'CLEAR_SELECTION' })}
              className={iconBtn}
            >
              <X size={15} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function isLightColor(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}
