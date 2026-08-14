import { Injectable, NotFoundException } from '@nestjs/common';
import { Exercise, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogListQueryDto } from './dto/catalog-list-query.dto';

export interface CatalogExerciseDto {
  id: string;
  wgerUuid: string;
  name: string;
  nameEn: string | null;
  variationGroup: string | null;
  imageUrl: string | null;
  licenseAuthor: string | null;
  category: { id: number; name: string };
  equipment: { id: number; name: string; slug: string }[];
  muscles: { id: number; name: string; nameEn: string | null }[];
}

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listExercises(
    query: CatalogListQueryDto,
  ): Promise<{ items: CatalogExerciseDto[]; total: number }> {
    const where: Prisma.ExerciseWhereInput = {
      isActive: true,
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { nameEn: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.equipment
        ? { equipment: { some: { id: query.equipment } } }
        : {}),
      ...(query.muscle ? { muscles: { some: { id: query.muscle } } } : {}),
      ...(query.category ? { categoryId: query.category } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.exercise.findMany({
        where,
        include: {
          category: true,
          equipment: true,
          muscles: true,
        },
        orderBy: { name: 'asc' },
        take: query.limit ?? 100,
        skip: query.offset ?? 0,
      }),
      this.prisma.exercise.count({ where }),
    ]);

    return { items: items.map((e) => this.toDto(e)), total };
  }

  async getExercise(id: string): Promise<CatalogExerciseDto> {
    const exercise = await this.prisma.exercise.findFirst({
      where: { id, isActive: true },
      include: { category: true, equipment: true, muscles: true },
    });
    if (!exercise) {
      throw new NotFoundException('Exercício não encontrado no catálogo');
    }
    return this.toDto(exercise);
  }

  async listEquipment() {
    return this.prisma.equipment.findMany({ orderBy: { name: 'asc' } });
  }

  async listMuscles() {
    return this.prisma.muscle.findMany({ orderBy: { name: 'asc' } });
  }

  async listCategories() {
    return this.prisma.exerciseCategory.findMany({ orderBy: { name: 'asc' } });
  }

  private toDto(
    exercise: Exercise & {
      category: { id: number; name: string };
      equipment: { id: number; name: string; slug: string }[];
      muscles: { id: number; name: string; nameEn: string | null }[];
    },
  ): CatalogExerciseDto {
    return {
      id: exercise.id,
      wgerUuid: exercise.wgerUuid,
      name: exercise.name,
      nameEn: exercise.nameEn,
      variationGroup: exercise.variationGroup,
      imageUrl: exercise.imageUrl,
      licenseAuthor: exercise.licenseAuthor,
      category: exercise.category,
      equipment: exercise.equipment,
      muscles: exercise.muscles,
    };
  }
}
