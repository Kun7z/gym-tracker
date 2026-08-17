import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../shared/prisma/prisma.service';
import { CatalogService } from './catalog.service';

interface ListArgs {
  where: {
    isActive: boolean;
    OR?: { name: { contains: string; mode: string } }[];
    equipment?: { some: { id: number } };
    muscles?: { some: { id: number } };
    categoryId?: number;
  };
}

describe('CatalogService', () => {
  let service: CatalogService;

  const prismaMock = {
    exercise: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    equipment: { findMany: jest.fn() },
    muscle: { findMany: jest.fn() },
    exerciseCategory: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };

  const exerciseRow = {
    id: 'ex-1',
    wgerUuid: 'w1',
    name: 'Leg Press',
    nameEn: 'Leg Press',
    variationGroup: null,
    imageUrl: null,
    licenseAuthor: null,
    category: { id: 1, name: 'Legs' },
    equipment: [
      { id: 2, name: 'Leg press machine', slug: 'leg-press-machine' },
    ],
    muscles: [{ id: 1, name: 'Quadriceps', nameEn: 'Quadriceps' }],
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get(CatalogService);
  });

  it('lista exercícios ativos com busca e filtros', async () => {
    let listArgs: ListArgs | undefined;
    prismaMock.exercise.findMany.mockImplementation((args: ListArgs) => {
      listArgs = args;
      return Promise.resolve([exerciseRow]);
    });
    prismaMock.exercise.count.mockResolvedValue(1);
    prismaMock.$transaction.mockImplementation(
      (operations: Promise<unknown>[]) => Promise.all(operations),
    );

    const result = await service.listExercises({
      q: 'leg',
      equipment: 2,
      muscle: 1,
      category: 1,
      limit: 50,
      offset: 0,
    });

    expect(result.total).toBe(1);
    expect(result.items[0].name).toBe('Leg Press');
    expect(listArgs?.where.isActive).toBe(true);
    expect(listArgs?.where.OR).toHaveLength(2);
    expect(listArgs?.where.equipment).toEqual({ some: { id: 2 } });
    expect(listArgs?.where.muscles).toEqual({ some: { id: 1 } });
    expect(listArgs?.where.categoryId).toBe(1);
  });

  it('retorna exercício pelo id com relacionamentos', async () => {
    prismaMock.exercise.findFirst.mockResolvedValue(exerciseRow);

    const result = await service.getExercise('ex-1');

    expect(result.category.name).toBe('Legs');
    expect(result.equipment[0].slug).toBe('leg-press-machine');
  });

  it('lança NotFoundException para exercício inativo ou inexistente', async () => {
    prismaMock.exercise.findFirst.mockResolvedValue(null);

    await expect(service.getExercise('ex-1')).rejects.toThrow(
      NotFoundException,
    );
  });
});
