import { api } from './api';

export type UploadedFile = {
  id: string;
  workspaceId: string;
  boardId: string | null;
  userId: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  provider: string;
  createdAt: string;
};

export const uploadsApi = {
  upload: async (workspaceId: string, file: File, boardId?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (boardId) formData.append('boardId', boardId);
    return api.postFormData<UploadedFile>(`/workspaces/${workspaceId}/uploads`, formData);
  },
  listByBoard: (workspaceId: string, boardId: string) =>
    api.get<UploadedFile[]>(`/workspaces/${workspaceId}/uploads/boards/${boardId}`),
  delete: (workspaceId: string, uploadId: string) =>
    api.delete<void>(`/workspaces/${workspaceId}/uploads/${uploadId}`),
};
