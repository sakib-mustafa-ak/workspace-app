import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'node:events';

export type UserProfileUpdatedPayload = {
  userId: string;
  displayName?: string;
  avatarUrl?: string | null;
  bio?: string | null;
  timezone?: string | null;
  locale?: string | null;
};

export type UserAvatarUpdatedPayload = {
  userId: string;
  avatarUrl: string | null;
};

export type UserAccountDeletedPayload = {
  userId: string;
};

export const USERS_EVENTS = {
  userProfileUpdated: 'UserProfileUpdated',
  userAvatarUpdated: 'UserAvatarUpdated',
  userAccountDeleted: 'UserAccountDeleted',
} as const;

export type UsersEventName = (typeof USERS_EVENTS)[keyof typeof USERS_EVENTS];

@Injectable()
export class UsersEventBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(50);
  }

  publishUserProfileUpdated(payload: UserProfileUpdatedPayload): void {
    this.emit(USERS_EVENTS.userProfileUpdated, payload);
  }

  onUserProfileUpdated(
    listener: (payload: UserProfileUpdatedPayload) => void,
  ): void {
    this.emitter.on(USERS_EVENTS.userProfileUpdated, listener);
  }

  publishUserAvatarUpdated(payload: UserAvatarUpdatedPayload): void {
    this.emit(USERS_EVENTS.userAvatarUpdated, payload);
  }

  onUserAvatarUpdated(
    listener: (payload: UserAvatarUpdatedPayload) => void,
  ): void {
    this.emitter.on(USERS_EVENTS.userAvatarUpdated, listener);
  }

  publishUserAccountDeleted(payload: UserAccountDeletedPayload): void {
    this.emit(USERS_EVENTS.userAccountDeleted, payload);
  }

  onUserAccountDeleted(
    listener: (payload: UserAccountDeletedPayload) => void,
  ): void {
    this.emitter.on(USERS_EVENTS.userAccountDeleted, listener);
  }

  private emit(name: UsersEventName, payload: unknown): void {
    this.emitter.emit(name, payload);
  }
}
