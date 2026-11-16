import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../decorators/public.decorator';
import { RecordingMailProvider } from '../mail/mail.provider';

@ApiExcludeController()
@Controller({ path: 'dev/mail', version: '1' })
export class DevMailController {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(RecordingMailProvider)
    private readonly recorder: RecordingMailProvider,
  ) {}

  @Public()
  @Get()
  list(@Req() request: Request) {
    const peer = request.socket.remoteAddress;
    const origin = request.headers.origin;
    const host = request.headers.host ?? '';
    const allowedOrigin = this.config.get<string>('app.publicBaseUrl');
    if (
      this.config.get('app.nodeEnv') !== 'development' ||
      this.config.get('mail.devInbox') !== true ||
      this.config.get('mail.provider') !== 'recorder' ||
      !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(peer ?? '') ||
      !/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host) ||
      (origin && origin !== allowedOrigin && origin !== `http://${host}`) ||
      request.headers['sec-fetch-site'] === 'cross-site'
    )
      throw new NotFoundException();
    request.res?.setHeader('Cache-Control', 'no-store');
    return {
      simulated: true,
      messages: [...this.recorder.snapshot()].reverse().map((message) => ({
        to: message.to,
        subject: message.subject,
        text: message.text,
      })),
    };
  }
}
