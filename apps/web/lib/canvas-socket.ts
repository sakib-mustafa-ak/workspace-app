import { io, Socket } from 'socket.io-client';

const API_ORIGIN =
  typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}`
    : 'http://localhost';

const API_URL = process.env.NEXT_PUBLIC_API_URL || `${API_ORIGIN}:4000/api/v1`;
const SOCKET_URL = API_URL.replace('/api/v1', '');

export function createCanvasSocket(boardId: string): Socket {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const socket = io(`${SOCKET_URL}/canvas`, {
    auth: { token },
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => {
    socket.emit('board:join', { boardId });
  });

  socket.on('disconnect', () => {
    socket.emit('board:leave', { boardId });
  });

  return socket;
}
