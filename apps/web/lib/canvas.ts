import { api } from './api';

export type CanvasObjectType =
  | 'RECTANGLE' | 'ELLIPSE' | 'TEXT' | 'STICKY_NOTE'
  | 'IMAGE' | 'ARROW' | 'LINE' | 'PATH' | 'FRAME' | 'CONNECTOR';

export type CanvasObject = {
  id: string;
  canvasId: string;
  parentId: string | null;
  type: CanvasObjectType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  fill: string | null;
  stroke: string | null;
  strokeWidth: number;
  opacity: number;
  data: Record<string, unknown> | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
};

export type Canvas = {
  id: string;
  boardId: string;
  workspaceId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  objects: CanvasObject[];
};

export type CreateCanvasObjectData = {
  type: CanvasObjectType;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  zIndex?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  data?: Record<string, unknown>;
};

export type UpdateCanvasObjectData = Partial<CreateCanvasObjectData>;

export const canvasApi = {
  getOrCreate: (boardId: string) =>
    api.get<Canvas>(`/boards/${boardId}/canvas`),

  createObject: (boardId: string, data: CreateCanvasObjectData) =>
    api.post<CanvasObject>(`/boards/${boardId}/canvas/objects`, data),

  updateObject: (boardId: string, objectId: string, data: UpdateCanvasObjectData) =>
    api.patch<CanvasObject>(`/boards/${boardId}/canvas/objects/${objectId}`, data),

  deleteObject: (boardId: string, objectId: string) =>
    api.delete(`/boards/${boardId}/canvas/objects/${objectId}`),
};
