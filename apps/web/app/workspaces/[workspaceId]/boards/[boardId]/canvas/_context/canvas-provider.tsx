'use client';

import { useReducer, type ReactNode } from 'react';
import { CanvasContext, canvasReducer, initialState } from './canvas-state';

export function CanvasProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(canvasReducer, initialState);
  return (
    <CanvasContext.Provider value={{ state, dispatch }}>
      {children}
    </CanvasContext.Provider>
  );
}
