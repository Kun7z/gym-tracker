import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { WgerApiClient } from './../src/catalog/wger-api.client';

interface AuthResponse {
  body: {
    accessToken: string;
    user: { email: string };
  };
}

describe('App (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(WgerApiClient)
      .useValue({ enabled: false, fetchAll: () => Promise.resolve([]) })
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/api/v1/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect((res) => {
        expect((res.body as { status: string }).status).toBe('ok');
      });
  });

  describe('Auth', () => {
    const email = `e2e-${Date.now()}@example.com`;
    const password = 'senha-secreta-123';

    it('registra, acessa /me, renova o token e faz logout', async () => {
      const agent = request.agent(app.getHttpServer());
      const register = (await agent
        .post('/api/v1/auth/register')
        .send({ email, password, displayName: 'Teste' })
        .expect(201)) as AuthResponse;

      expect(register.body.accessToken).toBeDefined();
      expect(register.body.user.email).toBe(email);

      const me = await agent
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${register.body.accessToken}`)
        .expect(200);
      expect((me.body as { user: { email: string } }).user.email).toBe(email);

      const refresh = (await agent
        .post('/api/v1/auth/refresh')
        .expect(200)) as AuthResponse;
      expect(refresh.body.accessToken).toBeDefined();

      await agent.post('/api/v1/auth/logout').expect(200);
    });

    it('rejeita senha incorreta no login', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: 'senha-errada' })
        .expect(401);
    });

    it('rejeita /me sem token', async () => {
      await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    });
  });
});
