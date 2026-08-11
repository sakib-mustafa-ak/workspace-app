import { createContext, useContext, type Dispatch } from 'react';

export type ToolType = 'select' | 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'path' | 'text' | 'stickyNote' | 'connector';

export type CanvasObject = {
  id: string;
  type: 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'path' | 'text' | 'stickyNote' | 'connector' | 'image';
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
  points?: { x: number; y: number }[];
  zIndex: number;
  imageData?: string;
  sourceId?: string;
  targetId?: string;
};

type CanvasHistory = { past: CanvasObject[][]; future: CanvasObject[][] };

export interface CanvasState {
  zoom: number;
  pan: { x: number; y: number };
  gridVisible: boolean;
  layersOpen: boolean;
  activeTool: ToolType;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  opacity: number;
  objects: CanvasObject[];
  selectedIds: string[];
  history: CanvasHistory;
}

export type CanvasAction =
  | { type: 'SET_ZOOM'; payload: number }
  | { type: 'ZOOM_AT'; payload: { scale: number; cx: number; cy: number } }
  | { type: 'SET_PAN'; payload: { x: number; y: number } }
  | { type: 'TOGGLE_GRID' }
  | { type: 'TOGGLE_LAYERS' }
  | { type: 'SET_ACTIVE_TOOL'; payload: ToolType }
  | { type: 'SET_FILL_COLOR'; payload: string }
  | { type: 'SET_STROKE_COLOR'; payload: string }
  | { type: 'SET_STROKE_WIDTH'; payload: number }
  | { type: 'SET_OPACITY'; payload: number }
  | { type: 'ADD_OBJECT'; payload: CanvasObject; batch?: boolean }
  | { type: 'SNAPSHOT' }
  | { type: 'LOAD_OBJECTS'; payload: CanvasObject[] }
  | { type: 'UPDATE_OBJECT'; payload: Partial<CanvasObject> & { id: string }; batch?: boolean }
  | { type: 'UPDATE_OBJECTS'; payload: Partial<CanvasObject>[]; batch?: boolean }
  | { type: 'DELETE_OBJECTS'; payload: string[] }
  | { type: 'RESIZE_OBJECT'; payload: { id: string; x: number; y: number; width: number; height: number }; batch?: boolean }
  | { type: 'SELECT'; payload: string[] }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'BRING_TO_FRONT'; payload: string[] }
  | { type: 'SEND_TO_BACK'; payload: string[] }
  | { type: 'UNDO' }
  | { type: 'REDO' };

function captureHistory(state: CanvasState): CanvasHistory {
  return {
    past: [...(state.history.past.slice(-49) as CanvasObject[][]), state.objects],
    future: [],
  };
}

export function canvasReducer(state: CanvasState, action: CanvasAction): CanvasState {
  switch (action.type) {
    case 'SET_ZOOM':
      return { ...state, zoom: Math.min(4, Math.max(0.25, action.payload)) };
    case 'ZOOM_AT': {
      const scale = Math.min(4, Math.max(0.25, action.payload.scale));
      const { cx, cy } = action.payload;
      return {
        ...state,
        zoom: scale,
        pan: {
          x: cx - (cx - state.pan.x) * (scale / state.zoom),
          y: cy - (cy - state.pan.y) * (scale / state.zoom),
        },
      };
    }
    case 'SET_PAN':
      return { ...state, pan: action.payload };
    case 'TOGGLE_GRID':
      return { ...state, gridVisible: !state.gridVisible };
    case 'TOGGLE_LAYERS':
      return { ...state, layersOpen: !state.layersOpen };
    case 'SET_ACTIVE_TOOL':
      return { ...state, activeTool: action.payload };
    case 'SET_FILL_COLOR':
      return { ...state, fillColor: action.payload };
    case 'SET_STROKE_COLOR':
      return { ...state, strokeColor: action.payload };
    case 'SET_STROKE_WIDTH':
      return { ...state, strokeWidth: action.payload };
    case 'SET_OPACITY':
      return { ...state, opacity: action.payload };
    case 'ADD_OBJECT':
      return {
        ...state,
        objects: [...state.objects, action.payload],
        history: action.batch ? state.history : captureHistory(state),
      };
    case 'SNAPSHOT':
      return { ...state, history: captureHistory(state) };
    case 'LOAD_OBJECTS':
      return {
        ...state,
        objects: action.payload,
        selectedIds: [],
        history: { past: [], future: [] },
      };
    case 'UPDATE_OBJECT':
      return {
        ...state,
        objects: state.objects.map(o => o.id === action.payload.id ? { ...o, ...action.payload } : o),
        history: action.batch ? state.history : captureHistory(state),
      };
    case 'UPDATE_OBJECTS': {
      const updateMap = new Map(action.payload.map(u => [u.id, u]));
      return {
        ...state,
        objects: state.objects.map(o => updateMap.has(o.id) ? { ...o, ...updateMap.get(o.id) } : o),
        history: action.batch ? state.history : captureHistory(state),
      };
    }
    case 'DELETE_OBJECTS':
      return {
        ...state,
        objects: state.objects.filter(o => !action.payload.includes(o.id)),
        selectedIds: state.selectedIds.filter(id => !action.payload.includes(id)),
        history: captureHistory(state),
      };
    case 'RESIZE_OBJECT':
      return {
        ...state,
        objects: state.objects.map(o =>
          o.id === action.payload.id ? { ...o, x: action.payload.x, y: action.payload.y, width: action.payload.width, height: action.payload.height } : o
        ),
        history: action.batch ? state.history : captureHistory(state),
      };
    case 'SELECT':
      return { ...state, selectedIds: action.payload };
    case 'CLEAR_SELECTION':
      return { ...state, selectedIds: [] };
    case 'BRING_TO_FRONT':
      return {
        ...state,
        objects: state.objects.map(o =>
          action.payload.includes(o.id) ? { ...o, zIndex: Math.max(...state.objects.map(x => x.zIndex)) + 1 } : o
        ),
        history: captureHistory(state),
      };
    case 'SEND_TO_BACK':
      return {
        ...state,
        objects: state.objects.map(o =>
          action.payload.includes(o.id) ? { ...o, zIndex: Math.min(...state.objects.map(x => x.zIndex)) - 1 } : o
        ),
        history: captureHistory(state),
      };
    case 'UNDO': {
      if (state.history.past.length === 0) return state;
      const prev = state.history.past[state.history.past.length - 1];
      if (!prev) return state;
      return {
        ...state,
        objects: prev,
        history: {
          past: state.history.past.slice(0, -1) as CanvasObject[][],
          future: [state.objects, ...state.history.future],
        },
      };
    }
    case 'REDO': {
      if (state.history.future.length === 0) return state;
      const next = state.history.future[0];
      if (!next) return state;
      return {
        ...state,
        objects: next,
        history: {
          past: [...state.history.past, state.objects],
          future: state.history.future.slice(1) as CanvasObject[][],
        },
      };
    }
    default:
      return state;
  }
}

export const initialState: CanvasState = {
  zoom: 1,
  pan: { x: 0, y: 0 },
  gridVisible: true,
  layersOpen: false,
  activeTool: 'select',
  fillColor: '#ffffff',
  strokeColor: '#000000',
  strokeWidth: 2,
  opacity: 100,
  objects: [],
  selectedIds: [],
  history: { past: [], future: [] },
};

export const CanvasContext = createContext<{
  state: CanvasState;
  dispatch: Dispatch<CanvasAction>;
} | null>(null);

export function useCanvas() {
  const ctx = useContext(CanvasContext);
  if (!ctx) throw new Error('useCanvas must be used within CanvasProvider');
  return ctx;
}
