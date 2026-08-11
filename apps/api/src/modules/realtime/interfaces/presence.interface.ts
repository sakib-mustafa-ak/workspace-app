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
};
