import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { StatsService } from './stats.service';

describe('StatsService', () => {
  let service: StatsService;

  const prismaMock = {
    exercise: { findFirst: jest.fn() },
    $queryRaw: jest.fn(),
  };

  const exercise = { id: 'ex-1', name: 'Leg Press', wgerUuid: 'w1' };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get(StatsService);
  });

  it('history lança NotFoundException para exercício inexistente', async () => {
    prismaMock.exercise.findFirst.mockResolvedValue(null);

    await expect(service.history('user-1', 'ex-1', {})).rejects.toThrow(
      NotFoundException,
    );
  });

  it('history mapeia a agregação por dia', async () => {
    prismaMock.exercise.findFirst.mockResolvedValue(exercise);
    prismaMock.$queryRaw.mockResolvedValue([
      {
        day: new Date('2026-01-10T00:00:00Z'),
        maxWeightKg: 120,
        volumeKg: 2400,
        maxE1rmKg: 160,
        setsCount: 2,
      },
    ]);

    const result = await service.history('user-1', 'ex-1', { tz: 'UTC' });

    expect(result.exercise.name).toBe('Leg Press');
    expect(result.tz).toBe('UTC');
    expect(result.points).toEqual([
      {
        date: '2026-01-10',
        maxWeightKg: 120,
        volumeKg: 2400,
        maxE1rmKg: 160,
        setsCount: 2,
      },
    ]);
  });

  it('summary mapeia o resumo e calcula daysSinceLastUse', async () => {
    prismaMock.exercise.findFirst.mockResolvedValue(exercise);
    prismaMock.$queryRaw.mockResolvedValue([
      {
        bestWeightKg: 140,
        bestE1rmKg: 177.33,
        totalSets: 3,
        lastUsedAt: new Date(),
        firstBestWeightKg: 120,
        lastBestWeightKg: 140,
      },
    ]);

    const result = await service.summary('user-1', 'ex-1');

    expect(result.totalSets).toBe(3);
    expect(result.bestWeightKg).toBe(140);
    expect(result.firstBestWeightKg).toBe(120);
    expect(result.lastBestWeightKg).toBe(140);
    expect(result.daysSinceLastUse).toBe(0);
  });

  it('summary retorna vazio quando não há séries', async () => {
    prismaMock.exercise.findFirst.mockResolvedValue(exercise);
    prismaMock.$queryRaw.mockResolvedValue([
      {
        bestWeightKg: null,
        bestE1rmKg: null,
        totalSets: 0,
        lastUsedAt: null,
        firstBestWeightKg: null,
        lastBestWeightKg: null,
      },
    ]);

    const result = await service.summary('user-1', 'ex-1');

    expect(result.totalSets).toBe(0);
    expect(result.lastUsedAt).toBeNull();
    expect(result.daysSinceLastUse).toBeNull();
  });
});
