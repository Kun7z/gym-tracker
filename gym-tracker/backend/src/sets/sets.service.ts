import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, WorkoutSet } from '@prisma/client';
import { PrismaService } from '../shared/prisma/prisma.service';
import { CreateSetDto } from './dto/create-set.dto';
import { CreateSetsDto } from './dto/create-sets.dto';
import { ListSetsQueryDto } from './dto/list-sets-query.dto';

export interface WorkoutSetDto {
  id: string;
  clientUuid: string;
  exerciseId: string;
  exercise: { id: string; name: string; wgerUuid: string } | null;
  weightKg: number;
  reps: number;
  rpe: number | null;
  notes: string | null;
  isBodyweight: boolean;
  performedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class SetsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateSetsDto): Promise<WorkoutSetDto[]> {
    const exerciseIds = [...new Set(dto.sets.map((s) => s.exerciseId))];
    const exercises = await this.prisma.exercise.findMany({
      where: { id: { in: exerciseIds }, isActive: true },
      select: { id: true },
    });
    const found = new Set(exercises.map((e) => e.id));
    const missing = exerciseIds.filter((id) => !found.has(id));
    if (missing.length > 0) {
      throw new NotFoundException(
        `Exercício(s) não encontrado(s) no catálogo: ${missing.join(', ')}`,
      );
    }

    const payloads = dto.sets.map((set) => this.toPayload(userId, set));

    const created = await this.prisma.$transaction(
      payloads.map((data) =>
        this.prisma.workoutSet.upsert({
          where: { userId_clientUuid: { userId, clientUuid: data.clientUuid } },
          update: data,
          create: data,
        }),
      ),
    );

    return created.map((set) => this.toDto(set, null));
  }

  async list(
    userId: string,
    query: ListSetsQueryDto,
  ): Promise<{ items: WorkoutSetDto[]; total: number }> {
    const where: Prisma.WorkoutSetWhereInput = {
      userId,
      ...(query.exerciseId ? { exerciseId: query.exerciseId } : {}),
      ...(query.isBodyweight !== undefined
        ? { isBodyweight: query.isBodyweight }
        : {}),
      ...(query.from || query.to
        ? {
            performedAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.workoutSet.findMany({
        where,
        include: {
          exercise: { select: { id: true, name: true, wgerUuid: true } },
        },
        orderBy: { performedAt: 'desc' },
        take: query.limit ?? 100,
        skip: query.offset ?? 0,
      }),
      this.prisma.workoutSet.count({ where }),
    ]);

    return {
      items: items.map((set) => this.toDto(set, set.exercise)),
      total,
    };
  }

  async remove(userId: string, id: string): Promise<void> {
    const set = await this.prisma.workoutSet.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!set) {
      throw new NotFoundException('Série não encontrada');
    }
    await this.prisma.workoutSet.delete({ where: { id } });
  }

  private toPayload(
    userId: string,
    set: CreateSetDto,
  ): Prisma.WorkoutSetUncheckedCreateInput {
    if (!set.isBodyweight && set.weightKg === undefined) {
      throw new BadRequestException(
        `weightKg é obrigatório para a série ${set.clientUuid} (ou marque isBodyweight)`,
      );
    }
    return {
      clientUuid: set.clientUuid,
      userId,
      exerciseId: set.exerciseId,
      weightKg: set.weightKg ?? 0,
      reps: set.reps,
      rpe: set.rpe ?? null,
      notes: set.notes ?? null,
      isBodyweight: set.isBodyweight ?? false,
      performedAt: set.performedAt ? new Date(set.performedAt) : new Date(),
    };
  }

  private toDto(
    set: WorkoutSet,
    exercise: WorkoutSetDto['exercise'],
  ): WorkoutSetDto {
    return {
      id: set.id,
      clientUuid: set.clientUuid,
      exerciseId: set.exerciseId,
      exercise,
      weightKg: Number(set.weightKg),
      reps: set.reps,
      rpe: set.rpe === null ? null : Number(set.rpe),
      notes: set.notes,
      isBodyweight: set.isBodyweight,
      performedAt: set.performedAt,
      createdAt: set.createdAt,
      updatedAt: set.updatedAt,
    };
  }
}
