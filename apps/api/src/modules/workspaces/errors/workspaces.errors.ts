import { HttpException } from '@nestjs/common';

export const WorkspacesErrorCode = {
  WORKSPACE_NOT_FOUND: 'WORKSPACE.NOT_FOUND',
  SLUG_ALREADY_TAKEN: 'WORKSPACE.SLUG_ALREADY_TAKEN',
  NOT_A_MEMBER: 'WORKSPACE.NOT_A_MEMBER',
  INSUFFICIENT_ROLE: 'WORKSPACE.INSUFFICIENT_ROLE',
  CANNOT_REMOVE_OWNER: 'WORKSPACE.CANNOT_REMOVE_OWNER',
  MEMBERSHIP_NOT_FOUND: 'WORKSPACE.MEMBERSHIP_NOT_FOUND',
  INVITATION_NOT_FOUND: 'WORKSPACE.INVITATION_NOT_FOUND',
  INVITATION_EXPIRED: 'WORKSPACE.INVITATION_EXPIRED',
  INVITATION_ALREADY_ACCEPTED: 'WORKSPACE.INVITATION_ALREADY_ACCEPTED',
  INVITATION_REVOKED: 'WORKSPACE.INVITATION_REVOKED',
  ALREADY_A_MEMBER: 'WORKSPACE.ALREADY_A_MEMBER',
  TRANSFER_SAME_USER: 'WORKSPACE.TRANSFER_SAME_USER',
  WORKSPACE_ARCHIVED: 'WORKSPACE.ARCHIVED',
} as const;

export type WorkspacesErrorCode =
  (typeof WorkspacesErrorCode)[keyof typeof WorkspacesErrorCode];

const STATUS_BY_CODE: Readonly<Record<WorkspacesErrorCode, number>> = {
  [WorkspacesErrorCode.WORKSPACE_NOT_FOUND]: 404,
  [WorkspacesErrorCode.SLUG_ALREADY_TAKEN]: 409,
  [WorkspacesErrorCode.NOT_A_MEMBER]: 403,
  [WorkspacesErrorCode.INSUFFICIENT_ROLE]: 403,
  [WorkspacesErrorCode.CANNOT_REMOVE_OWNER]: 422,
  [WorkspacesErrorCode.MEMBERSHIP_NOT_FOUND]: 404,
  [WorkspacesErrorCode.INVITATION_NOT_FOUND]: 404,
  [WorkspacesErrorCode.INVITATION_EXPIRED]: 410,
  [WorkspacesErrorCode.INVITATION_ALREADY_ACCEPTED]: 409,
  [WorkspacesErrorCode.INVITATION_REVOKED]: 410,
  [WorkspacesErrorCode.ALREADY_A_MEMBER]: 409,
  [WorkspacesErrorCode.TRANSFER_SAME_USER]: 422,
  [WorkspacesErrorCode.WORKSPACE_ARCHIVED]: 423,
};

export class WorkspacesException extends HttpException {
  constructor(code: WorkspacesErrorCode, message: string) {
    super({ code, message }, STATUS_BY_CODE[code]);
  }
}
