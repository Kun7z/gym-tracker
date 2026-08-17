import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { WgerApiClient } from './../src/catalog/wger-api.client';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { PrismaService } from './../src/shared/prisma/prisma.service';

interface HistoryResponse {
  body: {
    exercise: { id: string; name: string };
    tz: string;
    points: {
      date: string;
      maxWeightKg: number;
      volumeKg: number;
      maxE1rmKg: number;
      setsCount: number;
    }[];
  };
}

interface SummaryResponse {
  body: {
    exercise: { id: string; name: string };
    totalSets: number;
    lastUsedAt: string;
    bestWeightKg: number;
    bestE1rmKg: number;
    firstBestWeightKg: number;
    lastBestWeightKg: number;
  };
}

describe('Stats (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let accessToken: string;
  let exerciseId: string;
  let categoryId: number;
  const email = `stats-${Date.now()}@example.com`;
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

    const category = await prisma.exerciseCategory.create({
      data: {
        id: Math.floor(100000 + Math.random() * 899999),
        name: 'Pernas',
        slug: `pernas-${Date.now()}`,
      },
    });
    categoryId = category.id;
    const exercise = await prisma.exercise.create({
      data: { wgerUuid: uuid(), name: 'Leg Press', categoryId },
    });
    exerciseId = exercise.id;

    await request(app.getHttpServer())
      .post('/api/v1/sets')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        sets: [
          {
            clientUuid: uuid(),
            exerciseId,
            weightKg: 100,
            reps: 12,
            performedAt: '2026-01-10T10:00:00.000Z',
          },
          {
            clientUuid: uuid(),
            exerciseId,
            weightKg: 120,
            reps: 10,
            performedAt: '2026-01-10T11:00:00.000Z',
          },
          {
            clientUuid: uuid(),
            exerciseId,
            weightKg: 140,
            reps: 8,
            performedAt: '2026-02-05T10:00:00.000Z',
          },
        ],
      })
      .expect(201);
  });

  afterAll(async () => {
    await prisma.workoutSet.deleteMany({ where: { user: { email } } });
    await prisma.user.deleteMany({ where: { email } });
    await prisma.exercise.deleteMany({ where: { id: exerciseId } });
    await prisma.exerciseCategory.deleteMany({ where: { id: categoryId } });
    await app.close();
  });

  it('agrega as três métricas por dia', async () => {
    const res = (await request(app.getHttpServer())
      .get(`/api/v1/exercises/${exerciseId}/history?tz=UTC`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)) as HistoryResponse;

    expect(res.body.exercise.name).toBe('Leg Press');
    expect(res.body.points).toHaveLength(2);

    const [day1, day2] = res.body.points;
    expect(day1.date).toBe('2026-01-10');
    expect(day1.maxWeightKg).toBe(120);
    expect(day1.volumeKg).toBe(2400);
    expect(day1.maxE1rmKg).toBeCloseTo(160, 5);
    expect(day1.setsCount).toBe(2);

    expect(day2.date).toBe('2026-02-05');
    expect(day2.maxWeightKg).toBe(140);
    expect(day2.volumeKg).toBe(1120);
    expect(day2.maxE1rmKg).toBeCloseTo(140 * (1 + 8 / 30), 5);
    expect(day2.setsCount).toBe(1);
  });

  it('filtra por período', async () => {
    const res = (await request(app.getHttpServer())
      .get(
        `/api/v1/exercises/${exerciseId}/history?from=2026-02-01T00:00:00Z&to=2026-02-28T23:59:59Z`,
      )
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)) as HistoryResponse;

    expect(res.body.points).toHaveLength(1);
    expect(res.body.points[0].date).toBe('2026-02-05');
  });

  it('retorna o resumo com antes/agora e PRs', async () => {
    const res = (await request(app.getHttpServer())
      .get(`/api/v1/exercises/${exerciseId}/summary`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)) as SummaryResponse;

    expect(res.body.totalSets).toBe(3);
    expect(res.body.bestWeightKg).toBe(140);
    expect(res.body.bestE1rmKg).toBeCloseTo(140 * (1 + 8 / 30), 5);
    expect(res.body.firstBestWeightKg).toBe(120);
    expect(res.body.lastBestWeightKg).toBe(140);
    expect(res.body.lastUsedAt).toContain('2026-02-05');
  });

  it('isola os dados por usuário', async () => {
    const other = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `stats-outro-${Date.now()}@example.com`,
        password: 'senha-secreta-123',
      })
      .expect(201);
    const otherToken = (other.body as { accessToken: string }).accessToken;

    const res = (await request(app.getHttpServer())
      .get(`/api/v1/exercises/${exerciseId}/history`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(200)) as HistoryResponse;

    expect(res.body.points).toHaveLength(0);
  });

  it('rejeita exercício inexistente e requisição sem token', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/exercises/${uuid()}/history`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/v1/exercises/${exerciseId}/history`)
      .expect(401);
  });
});
