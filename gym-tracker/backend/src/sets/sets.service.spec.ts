import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSetsDto } from './dto/create-sets.dto';
import { SetsService } from './sets.service';

interface UpsertArgs {
  where: { userId_clientUuid: { userId: string; clientUuid: string } };
  create: {
    clientUuid: string;
    weightKg: number;
    reps: number;
    isBodyweight: boolean;
  };
}

interface ListArgs {
  where: {
    userId: string;
    exerciseId?: string;
    performedAt?: { gte: Date; lte: Date };
  };
}

describe('SetsService', () => {
  let service: SetsService;

  const prismaMock = {
    exercise: { findMany: jest.fn() },
    workoutSet: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaMock.$transaction.mockImplementation(
      (operations: Promise<unknown>[]) => Promise.all(operations),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SetsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get(SetsService);
  });

  const EXERCISE_ID = '11111111-1111-4111-8111-111111111111';

  const batch = (
    overrides: Partial<CreateSetsDto['sets'][number]>[] = [],
  ): CreateSetsDto => ({
    sets: overrides.map((o, i) => ({
      clientUuid: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      exerciseId: EXERCISE_ID,
      weightKg: 100,
      reps: 10,
      ...o,
    })),
  });

  const mockUpsert = (captured: UpsertArgs[]): void => {
    prismaMock.workoutSet.upsert.mockImplementation((args: UpsertArgs) => {
      captured.push(args);
      return Promise.resolve({
        id: `set-${args.create.clientUuid}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...args.create,
      });
    });
  };

  it('cria séries em batch com upsert idempotente', async () => {
    prismaMock.exercise.findMany.mockResolvedValue([{ id: EXERCISE_ID }]);
    const upserts: UpsertArgs[] = [];
    mockUpsert(upserts);

    const result = await service.create('user-1', batch([{}, {}]));

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.workoutSet.upsert).toHaveBeenCalledTimes(2);
    expect(upserts[0].where.userId_clientUuid.userId).toBe('user-1');
    expect(typeof upserts[0].where.userId_clientUuid.clientUuid).toBe('string');
    expect(result).toHaveLength(2);
    expect(result[0].weightKg).toBe(100);
  });

  it('rejeita lote com exercício inexistente', async () => {
    prismaMock.exercise.findMany.mockResolvedValue([]);

    await expect(service.create('user-1', batch([{}]))).rejects.toThrow(
      NotFoundException,
    );
    expect(prismaMock.workoutSet.upsert).not.toHaveBeenCalled();
  });

  it('exige weightKg para exercício com carga', async () => {
    prismaMock.exercise.findMany.mockResolvedValue([{ id: EXERCISE_ID }]);

    await expect(
      service.create('user-1', batch([{ weightKg: undefined }])),
    ).rejects.toThrow(BadRequestException);
  });

  it('permite série sem weightKg quando isBodyweight é true', async () => {
    prismaMock.exercise.findMany.mockResolvedValue([{ id: EXERCISE_ID }]);
    const upserts: UpsertArgs[] = [];
    mockUpsert(upserts);

    const result = await service.create(
      'user-1',
      batch([{ weightKg: undefined, isBodyweight: true }]),
    );

    expect(upserts[0].create.weightKg).toBe(0);
    expect(upserts[0].create.isBodyweight).toBe(true);
    expect(result[0].weightKg).toBe(0);
  });

  it('lista séries com filtros e total', async () => {
    let listArgs: ListArgs | undefined;
    prismaMock.workoutSet.findMany.mockImplementation((args: ListArgs) => {
      listArgs = args;
      return Promise.resolve([
        {
          id: 'set-1',
          clientUuid: '00000000-0000-4000-8000-000000000000',
          exerciseId: EXERCISE_ID,
          exercise: { id: EXERCISE_ID, name: 'Leg Press', wgerUuid: 'w1' },
          weightKg: 100,
          reps: 10,
          rpe: null,
          notes: null,
          isBodyweight: false,
          performedAt: new Date('2026-08-14T10:00:00Z'),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
    });
    prismaMock.workoutSet.count.mockResolvedValue(7);

    const result = await service.list('user-1', {
      exerciseId: EXERCISE_ID,
      from: '2026-01-01T00:00:00Z',
      to: '2026-12-31T23:59:59Z',
      limit: 50,
      offset: 0,
    });

    expect(result.total).toBe(7);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].exercise?.name).toBe('Leg Press');
    expect(listArgs?.where.userId).toBe('user-1');
    expect(listArgs?.where.exerciseId).toBe(EXERCISE_ID);
    expect(listArgs?.where.performedAt?.gte).toEqual(
      new Date('2026-01-01T00:00:00Z'),
    );
  });

  it('remove apenas séries do próprio usuário', async () => {
    prismaMock.workoutSet.findFirst.mockResolvedValue(null);

    await expect(service.remove('user-1', 'set-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(prismaMock.workoutSet.delete).not.toHaveBeenCalled();

    prismaMock.workoutSet.findFirst.mockResolvedValue({ id: 'set-1' });
    await service.remove('user-1', 'set-1');
    expect(prismaMock.workoutSet.delete).toHaveBeenCalledWith({
      where: { id: 'set-1' },
    });
  });
});
