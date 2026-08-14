import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogSyncService } from './catalog-sync.service';
import { WgerApiClient } from './wger-api.client';
import { WgerExerciseInfo } from './wger.types';

const exercises: WgerExerciseInfo[] = [
  {
    id: 101,
    uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    category: { id: 1, name: 'Legs' },
    muscles: [
      { id: 1, name: 'Quadriceps', name_en: 'Quadriceps', is_front: true },
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
    license_author: 'Autor Teste',
    variation_group: null,
    images: [],
    translations: [{ id: 3, uuid: 't3', name: 'Leg Extension', language: 1 }],
  },
];

interface ExerciseUpsertArgs {
  create: {
    wgerUuid: string;
    name: string;
    nameEn: string;
    category: { connect: { id: number } };
    equipment: { connect: { id: number }[] };
    muscles: { connect: { id: number }[] };
  };
}

describe('CatalogSyncService', () => {
  let service: CatalogSyncService;
  let exerciseUpserts: ExerciseUpsertArgs[];

  const prismaMock = {
    equipment: { upsert: jest.fn() },
    muscle: { upsert: jest.fn() },
    exerciseCategory: { upsert: jest.fn() },
    exercise: {
      count: jest.fn(),
      upsert: jest.fn(),
      updateMany: jest.fn(),
    },
    catalogSyncState: { upsert: jest.fn() },
  };

  const wgerMock = {
    enabled: true,
    fetchAll: jest.fn(),
  };

  const lookupData = {
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
    '/exerciseinfo/': exercises,
    '/deletion-log/': [
      {
        model_type: 'exercise',
        uuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        replaced_by: null,
        timestamp: '2026-01-01T00:00:00Z',
        comment: null,
      },
    ],
  } as Record<string, unknown[]>;

  beforeEach(async () => {
    jest.clearAllMocks();
    wgerMock.fetchAll.mockImplementation((path: string) =>
      Promise.resolve(lookupData[path]),
    );
    prismaMock.equipment.upsert.mockResolvedValue({});
    prismaMock.muscle.upsert.mockResolvedValue({});
    prismaMock.exerciseCategory.upsert.mockResolvedValue({});
    exerciseUpserts = [];
    prismaMock.exercise.upsert.mockImplementation(
      (args: ExerciseUpsertArgs) => {
        exerciseUpserts.push(args);
        return Promise.resolve({});
      },
    );
    prismaMock.exercise.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.exercise.count.mockResolvedValue(2);
    prismaMock.catalogSyncState.upsert.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogSyncService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: WgerApiClient, useValue: wgerMock },
      ],
    }).compile();

    service = module.get(CatalogSyncService);
  });

  it('sincroniza lookups, exercícios e estado do catálogo', async () => {
    const result = await service.runSync();

    expect(wgerMock.fetchAll).toHaveBeenCalledTimes(6);
    expect(prismaMock.equipment.upsert).toHaveBeenCalledTimes(2);
    expect(prismaMock.muscle.upsert).toHaveBeenCalledTimes(1);
    expect(prismaMock.exerciseCategory.upsert).toHaveBeenCalledTimes(1);
    expect(prismaMock.exercise.upsert).toHaveBeenCalledTimes(2);
    expect(prismaMock.exercise.updateMany).toHaveBeenCalledWith({
      where: {
        wgerUuid: { in: ['dddddddd-dddd-4ddd-8ddd-dddddddddddd'] },
        isActive: true,
      },
      data: { isActive: false },
    });
    expect(prismaMock.catalogSyncState.upsert).toHaveBeenCalled();
    expect(result.exercises).toBe(2);
    expect(result.exercisesActive).toBe(2);
    expect(result.deleted).toBe(1);
  });

  it('prioriza a tradução pt-BR e guarda o nome em inglês', async () => {
    await service.runSync();

    expect(exerciseUpserts[0].create.wgerUuid).toBe(exercises[0].uuid);
    expect(exerciseUpserts[0].create.name).toBe('Leg Press');
    expect(exerciseUpserts[1].create.name).toBe('Leg Extension');
    expect(exerciseUpserts[1].create.nameEn).toBe('Leg Extension');
  });

  it('conecta exercícios a equipment e muscles existentes', async () => {
    await service.runSync();

    expect(exerciseUpserts[0].create.category.connect).toEqual({ id: 1 });
    expect(exerciseUpserts[0].create.equipment.connect).toEqual([{ id: 2 }]);
    expect(exerciseUpserts[0].create.muscles.connect).toEqual([{ id: 1 }]);
  });

  it('lança ServiceUnavailable quando o wger não está configurado', async () => {
    const disabled = {
      enabled: false,
      fetchAll: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogSyncService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: WgerApiClient, useValue: disabled },
      ],
    }).compile();
    const disabledService = module.get(CatalogSyncService);

    await expect(disabledService.runSync()).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
