import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { WgerApiClient } from './../src/catalog/wger-api.client';
import { PrismaService } from './../src/shared/prisma/prisma.service';

class StubWgerClient {
  get enabled(): boolean {
    return true;
  }

  fetchAll<T>(path: string): Promise<T[]> {
    const data: Record<string, unknown[]> = {
      '/equipment/': [
        { id: 1, name: 'Barbell' },
        { id: 2, name: 'Leg press machine' },
      ],
      '/muscle/': [
        { id: 1, name: 'Quadriceps', name_en: 'Quadriceps', is_front: true },
      ],
      '/exercisecategory/': [{ id: 1, name: 'Legs' }],
      '/language/': [
        { id: 1, short_name: 'en', full_name: 'English' },
        { id: 2, short_name: 'pt', full_name: 'Portuguese' },
      ],
      '/exerciseinfo/': [
        {
          id: 101,
          uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          category: { id: 1, name: 'Legs' },
          muscles: [
            {
              id: 1,
              name: 'Quadriceps',
              name_en: 'Quadriceps',
              is_front: true,
            },
          ],
          muscles_secondary: [],
          equipment: [{ id: 2, name: 'Leg press machine' }],
          license_author: null,
          variation_group: null,
          images: [],
          translations: [
            { id: 1, uuid: 't1', name: 'Leg Press', language: 1 },
            { id: 2, uuid: 't2', name: 'Leg Press', language: 2 },
          ],
        },
        {
          id: 102,
          uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          category: { id: 1, name: 'Legs' },
          muscles: [],
          muscles_secondary: [],
          equipment: [],
          license_author: null,
          variation_group: null,
          images: [],
          translations: [
            { id: 3, uuid: 't3', name: 'Leg Extension', language: 1 },
          ],
        },
      ],
      '/deletion-log/': [
        {
          model_type: 'exercise',
          uuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
          replaced_by: null,
          timestamp: '2026-01-01T00:00:00Z',
          comment: null,
        },
      ],
    };
    return Promise.resolve(data[path] as T[]);
  }
}

interface ExerciseList {
  body: {
    items: { id: string; name: string; category: { name: string } }[];
    total: number;
  };
}

describe('Catalog (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let accessToken: string;
  const email = `catalog-${Date.now()}@example.com`;

  const FIXTURE_UUIDS = [
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  ];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(WgerApiClient)
      .useClass(StubWgerClient)
      .compile();

    prisma = moduleFixture.get(PrismaService);
    await prisma.exercise.deleteMany({
      where: { wgerUuid: { in: FIXTURE_UUIDS } },
    });
    await prisma.exerciseCategory.deleteMany({ where: { id: 1 } });
    await prisma.equipment.deleteMany({ where: { id: { in: [1, 2] } } });
    await prisma.muscle.deleteMany({ where: { id: 1 } });
    await prisma.user.deleteMany({ where: { email } });

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    const register = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'senha-secreta-123' })
      .expect(201);
    accessToken = (register.body as { accessToken: string }).accessToken;
  });

  afterAll(async () => {
    await prisma.exercise.deleteMany({
      where: { wgerUuid: { in: FIXTURE_UUIDS } },
    });
    await prisma.exerciseCategory.deleteMany({ where: { id: 1 } });
    await prisma.equipment.deleteMany({ where: { id: { in: [1, 2] } } });
    await prisma.muscle.deleteMany({ where: { id: 1 } });
    await prisma.workoutSet.deleteMany({ where: { user: { email } } });
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('sincroniza no boot e lista exercícios', async () => {
    const res = (await request(app.getHttpServer())
      .get('/api/v1/catalog/exercises')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)) as ExerciseList;

    expect(res.body.total).toBe(2);
    const names = res.body.items.map((e) => e.name);
    expect(names).toContain('Leg Press');
    // Sem tradução pt-BR no wger → dicionário curado
    expect(names).toContain('Cadeira extensora');
    expect(res.body.items[0].category.name).toBe('Pernas');
  });

  it('busca por nome com filtro', async () => {
    const res = (await request(app.getHttpServer())
      .get('/api/v1/catalog/exercises?q=extension')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)) as ExerciseList;

    // A busca cobre o nome pt-BR (name) e o original (nameEn)
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].name).toBe('Cadeira extensora');
  });

  it('filtra por equipment', async () => {
    const res = (await request(app.getHttpServer())
      .get('/api/v1/catalog/exercises?equipment=2')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)) as ExerciseList;

    expect(res.body.total).toBe(1);
    expect(res.body.items[0].name).toBe('Leg Press');
  });

  it('retorna detalhe do exercício com relacionamentos', async () => {
    const list = (await request(app.getHttpServer())
      .get('/api/v1/catalog/exercises?q=leg%20press')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)) as ExerciseList;
    const id = list.body.items[0].id;

    const res = await request(app.getHttpServer())
      .get(`/api/v1/catalog/exercises/${id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const body = res.body as {
      name: string;
      equipment: { name: string }[];
      muscles: { name: string }[];
    };
    expect(body.name).toBe('Leg Press');
    expect(body.equipment[0].name).toBe('Máquina de leg press');
    expect(body.muscles[0].name).toBe('Quadríceps');
  });

  it('lista equipment, muscles e categories', async () => {
    const equipment = await request(app.getHttpServer())
      .get('/api/v1/catalog/equipment')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(equipment.body as { id: number }[]).toHaveLength(2);

    const muscles = await request(app.getHttpServer())
      .get('/api/v1/catalog/muscles')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(muscles.body as { id: number }[]).toHaveLength(1);

    const categories = await request(app.getHttpServer())
      .get('/api/v1/catalog/categories')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(categories.body as { id: number }[]).toHaveLength(1);
  });

  it('permite re-sincronizar manualmente (idempotente) e consultar o status', async () => {
    const sync = await request(app.getHttpServer())
      .post('/api/v1/catalog/sync')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect((sync.body as { exercises: number }).exercises).toBe(2);

    const status = await request(app.getHttpServer())
      .get('/api/v1/catalog/sync/status')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect((status.body as { exercisesCount: number }).exercisesCount).toBe(2);
  });
});
