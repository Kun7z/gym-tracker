import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { WgerApiClient } from './../src/catalog/wger-api.client';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { PrismaService } from './../src/prisma/prisma.service';

interface SetsResponse {
  body: { sets: { id: string; clientUuid: string }[] };
}

interface ListResponse {
  body: { items: { id: string }[]; total: number };
}

describe('Sets (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let accessToken: string;
  let otherToken: string;
  let exerciseId: string;
  let categoryId: number;
  const email = `sets-${Date.now()}@example.com`;
  const otherEmail = `sets-outro-${Date.now()}@example.com`;
  const uuid = () => crypto.randomUUID();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(WgerApiClient)
      .useValue({ enabled: false, fetchAll: () => Promise.resolve([]) })
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const register = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'senha-secreta-123' })
      .expect(201);
    accessToken = (register.body as { accessToken: string }).accessToken;

    const other = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: otherEmail, password: 'senha-secreta-123' })
      .expect(201);
    otherToken = (other.body as { accessToken: string }).accessToken;

    const category = await prisma.exerciseCategory.create({
      data: {
        id: Math.floor(100000 + Math.random() * 899999),
        name: 'Pernas',
        slug: `pernas-${Date.now()}`,
      },
    });
    categoryId = category.id;
    const exercise = await prisma.exercise.create({
      data: {
        wgerUuid: uuid(),
        name: 'Leg Press',
        categoryId,
      },
    });
    exerciseId = exercise.id;
  });

  afterAll(async () => {
    await prisma.workoutSet.deleteMany({
      where: { user: { email: { in: [email, otherEmail] } } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [email, otherEmail] } },
    });
    await prisma.exercise.deleteMany({ where: { id: exerciseId } });
    await prisma.exerciseCategory.deleteMany({ where: { id: categoryId } });
    await app.close();
  });

  it('cria séries em batch e responde com os registros', async () => {
    const res = (await request(app.getHttpServer())
      .post('/api/v1/sets')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        sets: [
          { clientUuid: uuid(), exerciseId, weightKg: 100, reps: 12 },
          { clientUuid: uuid(), exerciseId, weightKg: 120, reps: 10 },
        ],
      })
      .expect(201)) as SetsResponse;

    expect(res.body.sets).toHaveLength(2);
    expect(res.body.sets[0].id).toBeDefined();
  });

  it('é idempotente: reenviar o mesmo clientUuid não duplica', async () => {
    const clientUuid = uuid();
    const payload = {
      sets: [{ clientUuid, exerciseId, weightKg: 140, reps: 8 }],
    };

    await request(app.getHttpServer())
      .post('/api/v1/sets')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(payload)
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/v1/sets')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(payload)
      .expect(201);

    const list = (await request(app.getHttpServer())
      .get(`/api/v1/sets?exerciseId=${exerciseId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)) as ListResponse;

    expect(list.body.total).toBe(3);
  });

  it('filtra por período e pagina', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/sets')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        sets: [
          {
            clientUuid: uuid(),
            exerciseId,
            weightKg: 50,
            reps: 10,
            performedAt: '2020-01-01T10:00:00.000Z',
          },
        ],
      })
      .expect(201);

    const recent = (await request(app.getHttpServer())
      .get(
        `/api/v1/sets?exerciseId=${exerciseId}&from=2026-01-01T00:00:00Z&to=2026-12-31T23:59:59Z`,
      )
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)) as ListResponse;
    expect(recent.body.total).toBe(3);

    const old = (await request(app.getHttpServer())
      .get(
        `/api/v1/sets?exerciseId=${exerciseId}&from=2019-01-01T00:00:00Z&to=2020-12-31T23:59:59Z`,
      )
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)) as ListResponse;
    expect(old.body.total).toBe(1);
  });

  it('rejeita séries de exercício inexistente', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/sets')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        sets: [
          { clientUuid: uuid(), exerciseId: uuid(), weightKg: 100, reps: 10 },
        ],
      })
      .expect(404);
  });

  it('exige autenticação', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/sets')
      .send({ sets: [] })
      .expect(401);
    await request(app.getHttpServer()).get('/api/v1/sets').expect(401);
  });

  it('deleta série do próprio usuário e impede deleção cruzada', async () => {
    const created = (await request(app.getHttpServer())
      .post('/api/v1/sets')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        sets: [{ clientUuid: uuid(), exerciseId, weightKg: 90, reps: 10 }],
      })
      .expect(201)) as SetsResponse;
    const setId = created.body.sets[0].id;

    await request(app.getHttpServer())
      .delete(`/api/v1/sets/${setId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/api/v1/sets/${setId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const list = (await request(app.getHttpServer())
      .get(`/api/v1/sets?exerciseId=${exerciseId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)) as ListResponse;
    expect(list.body.total).toBe(4);
  });
});
