export type PresenceUser = {
  userId: string;
  displayName: string;
  cursor?: { x: number; y: number };
  joinedAt: Date;
};

export type BoardPresence = {
  boardId: string;
  users: Map<string, PresenceUser>;
};

export type ObjectLock = {
  objectId: string;
  userId: string;
  displayName: string;
  expiresAt: number;
  /** The socket that holds this lock — a user with several tabs only
   *  releases the locks owned by the socket that actually disconnected. */
  socketId: string;
};
