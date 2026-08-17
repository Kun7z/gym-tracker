import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { PrismaService } from './../src/shared/prisma/prisma.service';
import { WgerApiClient } from './../src/catalog/wger-api.client';

class DisabledWgerClient {
  get enabled(): boolean {
    return false;
  }
}

interface ErrorBody {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
}

describe('Error handling (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const email = `errors-${Date.now()}@example.com`;
  const password = 'senha-secreta-123';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(WgerApiClient)
      .useClass(DisabledWgerClient)
      .compile();

    prisma = moduleFixture.get(PrismaService);
    await prisma.user.deleteMany({ where: { email } });

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('401 sem token: guard lança e o filtro padroniza a resposta', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/catalog/exercises')
      .expect(401);

    const body = res.body as ErrorBody;
    expect(body.statusCode).toBe(401);
    expect(body.message).toBe('Token ausente');
    expect(body.error).toBe('Unauthorized');
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(body.path).toBe('/api/v1/catalog/exercises');
  });

  it('400 com DTO inválido: ValidationPipe devolve lista de mensagens', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'curta' })
      .expect(400);

    const body = res.body as ErrorBody;
    expect(body.statusCode).toBe(400);
    expect(body.error).toBe('Bad Request');
    expect(Array.isArray(body.message)).toBe(true);
    expect((body.message as string[]).join(' ')).toMatch(/mínimo 8 caracteres/);
    expect(body.timestamp).toBeDefined();
    expect(body.path).toBe('/api/v1/auth/register');
  });

  it('404 de rota inexistente: filtro global mantém o formato', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/rota-que-nao-existe')
      .expect(404);

    const body = res.body as ErrorBody;
    expect(body.statusCode).toBe(404);
    expect(body.message).toContain('Cannot GET');
    expect(body.error).toBe('Not Found');
    expect(body.timestamp).toBeDefined();
    expect(body.path).toBe('/api/v1/rota-que-nao-existe');
  });

  it('409 de conflito: exceção de negócio com formato padronizado', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password })
      .expect(409);

    const body = res.body as ErrorBody;
    expect(body.statusCode).toBe(409);
    expect(body.message).toBe('E-mail já cadastrado');
    expect(body.error).toBe('Conflict');
    expect(body.timestamp).toBeDefined();
    expect(body.path).toBe('/api/v1/auth/register');
  });
});
