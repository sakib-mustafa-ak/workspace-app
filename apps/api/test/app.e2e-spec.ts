import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import {
  API_DEFAULT_VERSION,
  API_PREFIX,
} from '../src/common/constants/api.constants';

describe('App (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix(API_PREFIX);
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: API_DEFAULT_VERSION,
    });
    await app.init();
  });

  it('serves the health endpoint under the versioned prefix', () => {
    return request(app.getHttpServer())
      .get(`/${API_PREFIX}/v${API_DEFAULT_VERSION}/health`)
      .expect(200)
      .expect((res) => {
        expect(res.body).toMatchObject({
          status: 'ok',
          service: 'workspace-api',
        });
      });
  });

  it('rejects unknown routes with 404', () => {
    return request(app.getHttpServer())
      .get('/definitely-not-a-route')
      .expect(404);
  });

  afterEach(async () => {
    await app.close();
  });
});
