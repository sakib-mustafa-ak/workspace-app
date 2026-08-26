import { UploadsService } from './uploads.service';

describe('UploadsService', () => {
  const membership = { role: 'EDITOR' } as never;
  const upload = {
    id: 'upload-1',
    workspaceId: 'workspace-1',
    boardId: 'board-1',
    userId: 'user-1',
    originalName: 'image.png',
    mimeType: 'image/png',
    size: 10,
    storageKey: 'workspace-1/image.png',
    url: '/uploads/workspace-1/image.png',
    provider: 'local',
  } as never;

  function createService() {
    const uploadsRepo = {
      create: jest.fn().mockResolvedValue(upload),
      findByBoard: jest.fn().mockResolvedValue([upload]),
      findByWorkspace: jest.fn().mockResolvedValue([upload]),
    };
    const boardsRepo = {
      findById: jest.fn().mockResolvedValue({
        id: 'board-1',
        workspaceId: 'workspace-1',
      }),
    };
    const membersRepo = {
      findByWorkspaceAndUser: jest.fn().mockResolvedValue(membership),
    };
    const eventBus = { publishFileUploaded: jest.fn() };
    const policy = {
      canUpload: jest.fn().mockReturnValue(true),
      canView: jest.fn().mockReturnValue(true),
      canManage: jest.fn().mockReturnValue(true),
    };
    const storage = {
      save: jest.fn().mockResolvedValue({
        storageKey: 'workspace-1/image.png',
      }),
      getDownloadUrl: jest
        .fn()
        .mockResolvedValue('https://signed.example.com/workspace-1/image.png'),
    };

    return {
      service: new UploadsService(
        uploadsRepo as never,
        boardsRepo as never,
        membersRepo as never,
        eventBus as never,
        policy as never,
        storage as never,
      ),
      uploadsRepo,
      boardsRepo,
      membersRepo,
      storage,
    };
  }

  it('checks membership using workspace then user IDs', async () => {
    const { service, membersRepo } = createService();

    await service.upload('workspace-1', 'user-1', 'board-1', {
      buffer: Buffer.from('image'),
      originalname: 'image.png',
      mimetype: 'image/png',
      size: 10,
    });

    expect(membersRepo.findByWorkspaceAndUser).toHaveBeenCalledWith(
      'workspace-1',
      'user-1',
    );
  });

  it('rejects a board from a different workspace', async () => {
    const { service, boardsRepo, storage } = createService();
    boardsRepo.findById.mockResolvedValue({
      id: 'board-1',
      workspaceId: 'other-workspace',
    });

    await expect(
      service.upload('workspace-1', 'user-1', 'board-1', {
        buffer: Buffer.from('image'),
        originalname: 'image.png',
        mimetype: 'image/png',
        size: 10,
      }),
    ).rejects.toThrow('does not belong to workspace');
    expect(storage.save).not.toHaveBeenCalled();
  });

  it('checks membership correctly when listing by board (arg order regression)', async () => {
    const { service, membersRepo } = createService();

    // Regression: listByBoard used to call findByWorkspaceAndUser(userId,
    // workspaceId) — swapped — so the lookup always missed and every
    // request, even from a real member, threw NOT_A_MEMBER.
    await service.listByBoard('board-1', 'user-1');

    expect(membersRepo.findByWorkspaceAndUser).toHaveBeenCalledWith(
      'workspace-1',
      'user-1',
    );
  });

  it('lists by workspace only for members (arg order regression)', async () => {
    const { service, membersRepo } = createService();

    await service.listByWorkspace('workspace-1', 'user-1');

    expect(membersRepo.findByWorkspaceAndUser).toHaveBeenCalledWith(
      'workspace-1',
      'user-1',
    );
  });

  it('rejects SVG uploads (stored-XSS vector)', async () => {
    const { service, storage } = createService();

    await expect(
      service.upload('workspace-1', 'user-1', undefined, {
        buffer: Buffer.from('<svg onload="alert(1)"></svg>'),
        originalname: 'evil.svg',
        mimetype: 'image/svg+xml',
        size: 30,
      }),
    ).rejects.toThrow('File type is not allowed');
    expect(storage.save).not.toHaveBeenCalled();
  });

  it('returns a fresh download URL instead of the stored url column', async () => {
    const { service } = createService();

    const result = await service.upload('workspace-1', 'user-1', undefined, {
      buffer: Buffer.from('png'),
      originalname: 'image.png',
      mimetype: 'image/png',
      size: 3,
    });

    expect(result.downloadUrl).toBe(
      'https://signed.example.com/workspace-1/image.png',
    );
  });
});
