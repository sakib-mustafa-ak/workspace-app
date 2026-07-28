import { Module } from '@nestjs/common';

import { CanvasModule } from '../canvas/canvas.module';
import { CanvasGateway } from './gateways/canvas.gateway';

@Module({
  imports: [CanvasModule],
  providers: [CanvasGateway],
  exports: [CanvasGateway],
})
export class RealtimeModule {}
