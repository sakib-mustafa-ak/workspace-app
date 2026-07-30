# Phase 5: Canvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a full-featured canvas editor with toolbar, object manipulation, zoom/pan, context menu, undo/redo, and advanced tools (connector, image upload, sticky notes, ruler).

**Architecture:** Single-page canvas app under `apps/web/app/workspaces/[workspaceId]/boards/[boardId]/canvas/`. Canvas state managed via React context + useReducer. Imperative rendering on an HTML5 Canvas or SVG overlay. Toolbar is a floating React component.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, lucide-react, HTML Canvas API / SVG

## Global Constraints

- No new npm dependencies beyond lucide-react and Tailwind
- Canvas interactions must feel responsive (< 16ms frame budget for pointer events)
- Undo/redo stack capped at 50 actions, stored in React state (no persistence)
- All toolbar buttons must have `title` attribute for tooltip
- Zoom range: 25%–400%, default 100%
- No canvas library (fabric.js, konva) — build with raw Canvas API

---

### Task 1: Canvas infrastructure — context, zoom, pan, grid

**Files:**
- Create: `apps/web/app/workspaces/[workspaceId]/boards/[boardId]/canvas/_context/canvas-state.ts`
- Create: `apps/web/app/workspaces/[workspaceId]/boards/[boardId]/canvas/_context/canvas-provider.tsx`
- Create: `apps/web/app/workspaces/[workspaceId]/boards/[boardId]/canvas/_components/canvas-surface.tsx`
- Create: `apps/web/app/workspaces/[workspaceId]/boards/[boardId]/canvas/page.tsx`

- [ ] **Step 1: Create canvas state context (useReducer)**

```tsx
// canvas-state.ts
type CanvasAction =
  | { type: 'ZOOM_IN' }
  | { type: 'ZOOM_OUT' }
  | { type: 'SET_ZOOM'; payload: number }
  | { type: 'SET_PAN'; payload: { x: number; y: number } }
  | { type: 'TOGGLE_GRID' }
  | { type: 'SET_ACTIVE_TOOL'; payload: ToolType };

interface CanvasState {
  zoom: number;
  pan: { x: number; y: number };
  gridVisible: boolean;
  snapToGrid: boolean;
  activeTool: ToolType;
  objects: CanvasObject[];
  selectedIds: string[];
  history: { past: CanvasObject[][]; future: CanvasObject[][] };
}

function canvasReducer(state: CanvasState, action: CanvasAction): CanvasState {
  // zoom clamped 0.25–4.0, snap to 0.05 increments
  // pan offset tracked in pixels
  // history push on any object mutation, capped at 50
}
```

Define `ToolType` as a union: `'select' | 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'text' | 'stickyNote' | 'connector'`.

- [ ] **Step 2: Create CanvasProvider wrapping context**

```tsx
// canvas-provider.tsx
'use client';

export function CanvasProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(canvasReducer, initialState);
  return (
    <CanvasContext.Provider value={{ state, dispatch }}>
      {children}
    </CanvasContext.Provider>
  );
}
```

- [ ] **Step 3: Create canvas surface with zoom/pan**

```tsx
// canvas-surface.tsx
// Renders a div with overflow-hidden, onWheel for Ctrl+Scroll zoom
// Middle-mouse drag or Space+left drag for pan
// Render canvas background with grid pattern (dashed lines at intervals scaled by zoom)
// Holds an <svg> overlay for objects or a <canvas> element
```

Zoom via Ctrl+Scroll: `dispatch({ type: 'SET_ZOOM', payload: clamp(state.zoom * (e.deltaY > 0 ? 0.9 : 1.1), 0.25, 4) })`.

Pan: track mousedown with middle button or Space held, compute delta, update `state.pan`.

- [ ] **Step 4: Create page.tsx with CanvasProvider + layout**

```tsx
<CanvasProvider>
  <div className="flex h-full flex-col">
    {/* Toolbar will go here */}
    <CanvasSurface />
  </div>
</CanvasProvider>
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/workspaces/*/boards/*/canvas/
git commit -m "feat(canvas): add canvas context, zoom/pan, grid background, page layout"
```

---

### Task 2: Floating toolbar

**Files:**
- Create: `apps/web/app/workspaces/[workspaceId]/boards/[boardId]/canvas/_components/toolbar.tsx`

- [ ] **Step 1: Build toolbar with tool groups**

```tsx
// toolbar.tsx
const toolGroups = [
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
    tools: [{ type: 'connector', icon: GitForkHorizontal }],
  },
];
```

Render as a floating horizontal bar centered above the canvas:

```tsx
<div className="pointer-events-none absolute left-1/2 top-3 z-50 -translate-x-1/2">
  <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-surface-700 bg-surface-900/95 p-1 shadow-xl backdrop-blur-sm">
    {toolGroups.map((group, gi) => (
      <React.Fragment key={group.label}>
        {gi > 0 && <div className="mx-1 h-6 w-px bg-surface-700" />}
        {group.tools.map((tool) => (
          <button
            key={tool.type}
            title={tool.label}
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
      </React.Fragment>
    ))}
  </div>
</div>
```

- [ ] **Step 2: Color picker and stroke controls**

Add a secondary row or dropdown panel in the toolbar for:

```tsx
// Color swatches
const fillColors = ['#ffffff', '#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#9b59b6', '#000000'];
const strokeColors = ['#000000', '#333333', '#666666', '#999999', '#cccccc'];

// Stroke width slider (1-10)
<input type="range" min={1} max={10} value={strokeWidth} onChange={...} />

// Opacity slider (0-100)
<input type="range" min={0} max={100} value={opacity} onChange={...} />
```

Store `fillColor`, `strokeColor`, `strokeWidth`, `opacity` in canvas state as tool properties.

- [ ] **Step 3: Add toolbar to page.tsx**

Insert `<Toolbar />` above `<CanvasSurface />` inside the flex container.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/workspaces/*/boards/*/canvas/_components/toolbar.tsx
git commit -m "feat(canvas): add floating toolbar with shape tools, color picker, stroke controls"
```

---

### Task 3: Object creation and rendering

**Files:**
- Create: `apps/web/app/workspaces/[workspaceId]/boards/[boardId]/canvas/_components/canvas-renderer.ts`
- Modify: `apps/web/app/workspaces/[workspaceId]/boards/[boardId]/canvas/_components/canvas-surface.tsx`

- [ ] **Step 1: Define CanvasObject type**

Add to `canvas-state.ts`:

```ts
type CanvasObject = {
  id: string;
  type: 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'text' | 'stickyNote' | 'connector';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  text?: string;
  zIndex: number;
};
```

Include an `addObject` action in the reducer that assigns a unique `crypto.randomUUID()` id and increments `zIndex`.

- [ ] **Step 2: Pointer handlers for drawing**

In `CanvasSurface`, on mousedown (when activeTool !== 'select'):
- Create object with mousedown x/y
- On mousemove, update width/height = delta from origin
- On mouseup, finalize and push to history

```tsx
function handlePointerDown(e: React.PointerEvent) {
  if (state.activeTool === 'select') return; // handled by selection logic
  const pos = screenToCanvas(e.clientX, e.clientY, state.pan, state.zoom);
  const id = crypto.randomUUID();
  dispatch({ type: 'ADD_OBJECT', payload: { id, type: state.activeTool, x: pos.x, y: pos.y, width: 0, height: 0, ...defaultProps } });
  drawingRef.current = id;
}

function handlePointerMove(e: React.PointerEvent) {
  if (!drawingRef.current) return;
  const pos = screenToCanvas(e.clientX, e.clientY, state.pan, state.zoom);
  dispatch({ type: 'UPDATE_OBJECT', payload: { id: drawingRef.current, width: pos.x - origin.x, height: pos.y - origin.y } });
}
```

- [ ] **Step 3: Canvas renderer loop**

Use `requestAnimationFrame` to render objects on a `<canvas>` element:

```ts
// canvas-renderer.ts
export function renderFrame(ctx: CanvasRenderingContext2D, state: CanvasState) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.save();
  ctx.translate(state.pan.x, state.pan.y);
  ctx.scale(state.zoom, state.zoom);

  // Draw grid if visible
  if (state.gridVisible) drawGrid(ctx, state.pan, state.zoom);

  // Draw objects sorted by zIndex
  for (const obj of state.objects) {
    ctx.save();
    ctx.globalAlpha = obj.opacity / 100;
    ctx.translate(obj.x, obj.y);
    ctx.rotate((obj.rotation * Math.PI) / 180);

    renderObject(ctx, obj);

    ctx.restore();
  }

  ctx.restore();
}

function renderObject(ctx: CanvasRenderingContext2D, obj: CanvasObject) {
  switch (obj.type) {
    case 'rectangle':
      ctx.fillStyle = obj.fill;
      ctx.fillRect(0, 0, obj.width, obj.height);
      ctx.strokeStyle = obj.stroke;
      ctx.lineWidth = obj.strokeWidth;
      ctx.strokeRect(0, 0, obj.width, obj.height);
      break;
    case 'ellipse':
      ctx.beginPath();
      ctx.ellipse(obj.width / 2, obj.height / 2, obj.width / 2, obj.height / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    case 'line':
    case 'arrow':
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(obj.width, obj.height);
      ctx.stroke();
      if (obj.type === 'arrow') drawArrowhead(ctx, obj.width, obj.height);
      break;
    case 'text':
      ctx.font = '16px sans-serif';
      ctx.fillStyle = obj.fill;
      ctx.fillText(obj.text || '', 0, 16);
      break;
    case 'stickyNote':
      // Rounded rect with slight rotation
      ctx.fillStyle = obj.fill || '#ffd93d';
      roundRect(ctx, 0, 0, obj.width, obj.height, 4);
      ctx.fill();
      ctx.fillStyle = '#333';
      ctx.font = '14px sans-serif';
      ctx.fillText(obj.text || '', 8, 20);
      break;
    case 'connector':
      // Two endpoints with bezier curve
      ctx.beginPath();
      ctx.moveTo(obj.x1, obj.y1);
      ctx.bezierCurveTo(...);
      ctx.stroke();
      break;
  }
}
```

- [ ] **Step 4: Wire up canvas ref + animation loop in CanvasSurface**

```tsx
const canvasRef = useRef<HTMLCanvasElement>(null);

useEffect(() => {
  const canvas = canvasRef.current;
  if (!canvas) return;
  const ctx = canvas.getContext('2d')!;
  let rafId: number;

  function loop() {
    renderFrame(ctx, state);
    rafId = requestAnimationFrame(loop);
  }
  loop();
  return () => cancelAnimationFrame(rafId);
}, [state]);
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/workspaces/*/boards/*/canvas/_components/canvas-renderer.ts
git commit -m "feat(canvas): add object creation via pointer events, canvas rendering with shape types"
```

---

### Task 4: Selection, manipulation, and resize handles

**Files:**
- Create: `apps/web/app/workspaces/[workspaceId]/boards/[boardId]/canvas/_components/selection-manager.ts`
- Modify: `apps/web/app/workspaces/[workspaceId]/boards/[boardId]/canvas/_components/canvas-surface.tsx`

- [ ] **Step 1: Hit detection and selection**

```ts
function hitTest(point: { x: number; y: number }, obj: CanvasObject): boolean {
  // Check if point is inside rotated bounding box
  // For rectangles/ellipses: point-in-rect/ellipse check
  // For lines/arrows: distance-to-line-segment < threshold
  // For text/sticky: bounding box
  // Return highest zIndex match
}
```

Implement in `selection-manager.ts`. Called on mousedown when `activeTool === 'select'`.

- [ ] **Step 2: Drag-selection rectangle (multi-select)**

When pointer down on empty canvas with select tool, start drawing a blue selection rectangle. Objects intersecting the rect get added to `selectedIds`.

- [ ] **Step 3: Move and resize**

When dragging a selected object (no handle hit):
- Track delta from mousedown to current pos
- Dispatch `MOVE_OBJECTS` with delta for all selected ids

8 resize handles per selected object (corners + midpoints). On handle drag:
- Dispatch `RESIZE_OBJECT` with new width/height and adjusted x/y based on which handle

Rotation handle: circle above top-center handle. Drag to update `rotation`.

- [ ] **Step 4: Render selection overlay**

On canvas, after drawing objects, draw selection indicators:
- Blue dashed border around selected objects
- Small white squares at 8 resize points
- Small circle above top-center for rotation
- Rotation line from center to rotation handle

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/workspaces/*/boards/*/canvas/_components/selection-manager.ts
git commit -m "feat(canvas): add selection, hit detection, move/resize/rotate handles"
```

---

### Task 5: Context menu, align tools, layer panel

**Files:**
- Create: `apps/web/app/workspaces/[workspaceId]/boards/[boardId]/canvas/_components/context-menu.tsx`
- Create: `apps/web/app/workspaces/[workspaceId]/boards/[boardId]/canvas/_components/layer-panel.tsx`
- Modify: `apps/web/app/workspaces/[workspaceId]/boards/[boardId]/canvas/_components/canvas-surface.tsx`

- [ ] **Step 1: Right-click context menu**

```tsx
// context-menu.tsx
'use client';

export function ContextMenu({ x, y, objectIds, onClose }: Props) {
  const items = [
    { label: 'Copy', shortcut: 'Ctrl+C', action: () => {} },
    { label: 'Paste', shortcut: 'Ctrl+V', action: () => {} },
    { separator: true },
    { label: 'Delete', shortcut: 'Del', action: () => dispatch({ type: 'DELETE_OBJECTS', payload: objectIds }) },
    { separator: true },
    { label: 'Bring to Front', action: () => dispatch({ type: 'BRING_TO_FRONT', payload: objectIds }) },
    { label: 'Send to Back', action: () => dispatch({ type: 'SEND_TO_BACK', payload: objectIds }) },
  ];

  return (
    <div
      className="fixed z-50 min-w-[160px] rounded-xl border border-surface-700 bg-surface-900 py-1 shadow-2xl"
      style={{ left: x, top: y }}
    >
      {items.map((item, i) =>
        item.separator ? (
          <div key={i} className="my-1 border-t border-surface-700" />
        ) : (
          <button
            key={i}
            onClick={item.action}
            className="flex w-full items-center justify-between px-3 py-1.5 text-xs text-surface-300 hover:bg-surface-800"
          >
            {item.label}
            {item.shortcut && <span className="text-surface-600">{item.shortcut}</span>}
          </button>
        )
      )}
    </div>
  );
}
```

Prevent browser context menu on canvas: `onContextMenu={(e) => e.preventDefault()}`.

- [ ] **Step 2: Align and distribute tools**

Add buttons to toolbar (or a dropdown) for:
- Align Left/Center/Right (based on bounding box of all selected objects)
- Align Top/Middle/Bottom
- Distribute Horizontally/Vertically

Implement as utility functions that compute new positions and dispatch `UPDATE_OBJECTS`.

- [ ] **Step 3: Layer panel**

```tsx
// layer-panel.tsx
// Collapsible panel on the right side of the canvas
// Lists all objects sorted by zIndex (top-most first)
// Each item: type icon + truncated label
// Drag to reorder (changes zIndex)
// Click to select, double-click to rename
```

- [ ] **Step 4: Keyboard shortcuts**

```tsx
useEffect(() => {
  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Delete' || e.key === 'Backspace') dispatch({ type: 'DELETE_SELECTED' });
    if (e.ctrlKey && e.key === 'z') dispatch({ type: 'UNDO' });
    if (e.ctrlKey && e.key === 'Z') dispatch({ type: 'REDO' });
    if (e.ctrlKey && e.key === 'c') copySelected();
    if (e.ctrlKey && e.key === 'v') paste();
    if (e.key === 'Escape') dispatch({ type: 'CLEAR_SELECTION' });
  }
  window.addEventListener('keydown', handleKey);
  return () => window.removeEventListener('keydown', handleKey);
}, [state.selectedIds]);
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/workspaces/*/boards/*/canvas/_components/context-menu.tsx apps/web/app/workspaces/*/boards/*/canvas/_components/layer-panel.tsx
git commit -m "feat(canvas): add context menu, align/distribute tools, layer panel, keyboard shortcuts"
```

---

### Task 6: Undo/redo stack

**Files:**
- Modify: `apps/web/app/workspaces/[workspaceId]/boards/[boardId]/canvas/_context/canvas-state.ts`

- [ ] **Step 1: Implement history in reducer**

The reducer maintains `history: { past: CanvasObject[][]; future: CanvasObject[][] }`.

On any mutation action (ADD, UPDATE, DELETE, MOVE, RESIZE, etc.), snapshot `objects` and push to `past`, truncating at 50:

```ts
case 'ADD_OBJECT':
  return {
    ...state,
    objects: [...state.objects, action.payload],
    history: {
      past: [...state.history.past.slice(-49), state.objects],
      future: [],
    },
  };
```

UNDO: pop from past, push current to future, restore snapshot.
REDO: pop from future, push current to past, restore snapshot.

- [ ] **Step 2: Undo/redo buttons in toolbar**

Add undo/redo buttons to the toolbar (leftmost side):

```tsx
<button title="Undo (Ctrl+Z)" onClick={() => dispatch({ type: 'UNDO' })} disabled={state.history.past.length === 0}>
  <Undo2 size={18} />
</button>
<button title="Redo (Ctrl+Shift+Z)" onClick={() => dispatch({ type: 'REDO' })} disabled={state.history.future.length === 0}>
  <Redo2 size={18} />
</button>
```

Add `Undo2, Redo2` to lucide-react imports.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/workspaces/*/boards/*/canvas/_context/canvas-state.ts
git commit -m "feat(canvas): add undo/redo stack with toolbar buttons and keyboard shortcuts"
```

---

### Task 7: Image upload and remaining tools

**Files:**
- Modify: `apps/web/app/workspaces/[workspaceId]/boards/[boardId]/canvas/_components/toolbar.tsx`
- Modify: `apps/web/app/workspaces/[workspaceId]/boards/[boardId]/canvas/_components/canvas-surface.tsx`

- [ ] **Step 1: Image upload**

Add an image upload button to the toolbar:

```tsx
<label title="Upload image">
  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
  <ImageIcon size={18} />
</label>
```

`handleImageUpload`: read file as data URL, create object with type 'image', store `imageData` (the data URL) on the object, render via `drawImage`.

Add 'image' to CanvasObject type and add image rendering in `canvas-renderer.ts`.

- [ ] **Step 2: Connector tool**

Connector objects have two endpoint IDs (bound to other objects). On mousedown:
- Select source object (hit test)
- On mousemove, draw temporary line from source anchor to cursor
- On mouseup, if over target object, create connector

Connector rendering: bezier curve from source center to target center. Recalculate on object move.

Store connectors in a separate `connectors` array or as part of objects with `sourceId`, `targetId`.

- [ ] **Step 3: Inline text editing**

When double-clicking a text or sticky note object, enter edit mode:
- Overlay a `<textarea>` positioned at the object's canvas coordinates
- On blur or Enter (for single-line), commit text to object

```tsx
function handleDoubleClick(e: React.PointerEvent) {
  const hit = hitTest(pos, state.objects);
  if (hit && (hit.type === 'text' || hit.type === 'stickyNote')) {
    setEditingId(hit.id);
    setEditingText(hit.text || '');
  }
}
```

- [ ] **Step 4: Sticky note colors**

Add color presets specifically for sticky notes (yellow, green, blue, pink, orange, purple). Show as color swatches in toolbar when sticky note tool is active.

- [ ] **Step 5: Measurement/ruler tool**

Add a ruler tool button. When active, clicking and dragging shows a line with:
- Distance in pixels (scaled to zoom)
- Angle indicator

Render the measurement line and label on the canvas overlay. Remove on Escape.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/workspaces/*/boards/*/canvas/
git commit -m "feat(canvas): add image upload, connector tool, inline text editing, sticky note colors, ruler tool"
```
