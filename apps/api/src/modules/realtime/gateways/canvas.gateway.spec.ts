import { Test, TestingModule } from '@nestjs/testing';
import { CanvasGateway } from './canvas.gateway';
import { CanvasEventBus } from '../../canvas/events/canvas.events';

describe('CanvasGateway', () => {
  let gateway: CanvasGateway;
  let eventBus: jest.Mocked<CanvasEventBus>;

  beforeEach(async () => {
    eventBus = {
      onObjectCreated: jest.fn(),
      onObjectUpdated: jest.fn(),
      onObjectDeleted: jest.fn(),
      publishObjectCreated: jest.fn(),
      publishObjectUpdated: jest.fn(),
      publishObjectDeleted: jest.fn(),
    } as unknown as jest.Mocked<CanvasEventBus>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CanvasGateway,
        { provide: CanvasEventBus, useValue: eventBus },
      ],
    }).compile();

    gateway = module.get<CanvasGateway>(CanvasGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  it('should subscribe to all three canvas events on afterInit', () => {
    gateway.afterInit();

    expect(eventBus.onObjectCreated).toHaveBeenCalled();
    expect(eventBus.onObjectUpdated).toHaveBeenCalled();
    expect(eventBus.onObjectDeleted).toHaveBeenCalled();
  });
});
