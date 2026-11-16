import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { DevMailController } from './dev-mail.controller';
import { RecordingMailProvider } from '../mail/mail.provider';

describe('local inbox security boundary', () => {
  function setup(
    env = 'development',
    enabled = true,
    peer = '127.0.0.1',
    provider = 'recorder',
  ) {
    const recorder = new RecordingMailProvider();
    const controller = new DevMailController(
      new ConfigService({
        app: { nodeEnv: env, publicBaseUrl: 'http://localhost:3000' },
        mail: { devInbox: enabled, provider },
      }),
      recorder,
    );
    const setHeader = jest.fn();
    const request = {
      socket: { remoteAddress: peer },
      headers: { host: 'localhost:4000' } as Record<string, string>,
      res: { setHeader },
    } as unknown as Request;
    return { controller, request, recorder, setHeader };
  }
  it('allows only explicit local development and never returns HTML', async () => {
    const { controller, request, recorder, setHeader } = setup();
    await recorder.send({
      to: 'test@example.test',
      subject: 'Verification',
      text: 'Local test',
      html: '<script>bad()</script>',
    });
    expect(controller.list(request)).toEqual({
      simulated: true,
      messages: [
        {
          to: 'test@example.test',
          subject: 'Verification',
          text: 'Local test',
        },
      ],
    });
    expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });
  it.each([
    ['production', true, '127.0.0.1', 'recorder'],
    ['development', false, '127.0.0.1', 'recorder'],
    ['development', true, '203.0.113.1', 'recorder'],
    ['development', true, '127.0.0.1', 'resend'],
  ])(
    'hides the inbox for %s, enabled=%s, peer=%s, provider=%s',
    (env, enabled, peer, provider) => {
      const { controller, request } = setup(
        String(env),
        Boolean(enabled),
        String(peer),
        String(provider),
      );
      expect(() => controller.list(request)).toThrow();
    },
  );
  it('does not trust spoofed forwarded headers from remote peers', () => {
    const { controller, request } = setup('development', true, '203.0.113.1');
    request.headers['x-forwarded-for'] = '127.0.0.1';
    expect(() => controller.list(request)).toThrow();
  });
  it.each([
    { origin: 'https://attacker.example' },
    { host: 'attacker.example:4000' },
    { 'sec-fetch-site': 'cross-site' },
  ])('blocks cross-origin access and DNS rebinding %j', (headers) => {
    const { controller, request } = setup();
    Object.assign(request.headers, headers);
    expect(() => controller.list(request)).toThrow();
  });
  it('bounds the recording transport to the latest 100 messages', async () => {
    const { recorder } = setup();
    for (let index = 0; index < 101; index++)
      await recorder.send({
        to: 'test@example.test',
        subject: String(index),
        text: 'Test',
      });
    expect(recorder.snapshot()).toHaveLength(100);
    expect(recorder.snapshot()[0]?.subject).toBe('1');
  });
});
