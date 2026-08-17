import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../shared/prisma/prisma.service';
import { HistoryQueryDto } from './dto/history-query.dto';

interface DayStatRow {
  day: Date;
  maxWeightKg: number | null;
  volumeKg: number | null;
  maxE1rmKg: number | null;
  setsCount: number;
}

interface SummaryRow {
  bestWeightKg: number | null;
  bestE1rmKg: number | null;
  totalSets: number;
  lastUsedAt: Date | null;
  firstBestWeightKg: number | null;
  lastBestWeightKg: number | null;
}

export interface HistoryPoint {
  date: string;
  maxWeightKg: number | null;
  volumeKg: number | null;
  maxE1rmKg: number | null;
  setsCount: number;
}

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async history(
    userId: string,
    exerciseId: string,
    query: HistoryQueryDto,
  ): Promise<{
    exercise: { id: string; name: string; wgerUuid: string };
    tz: string;
    points: HistoryPoint[];
  }> {
    const exercise = await this.prisma.exercise.findFirst({
      where: { id: exerciseId },
      select: { id: true, name: true, wgerUuid: true },
    });
    if (!exercise) {
      throw new NotFoundException('Exercício não encontrado no catálogo');
    }

    const tz = query.tz ?? 'UTC';
    const from = query.from ? new Date(query.from) : null;
    const to = query.to ? new Date(query.to) : null;

    const rows = await this.prisma.$queryRaw<DayStatRow[]>(Prisma.sql`
      SELECT
        date_trunc('day', ws."performedAt" AT TIME ZONE ${tz})::date AS "day",
        MAX(ws."weightKg")::float8 AS "maxWeightKg",
        SUM(ws."weightKg" * ws."reps")::float8 AS "volumeKg",
        MAX(ws."weightKg" * (1 + ws."reps"::float8 / 30))::float8 AS "maxE1rmKg",
        COUNT(*)::int4 AS "setsCount"
      FROM "WorkoutSet" AS ws
      WHERE ws."userId" = ${userId}
        AND ws."exerciseId" = ${exerciseId}
        ${from ? Prisma.sql`AND ws."performedAt" >= ${from}` : Prisma.empty}
        ${to ? Prisma.sql`AND ws."performedAt" <= ${to}` : Prisma.empty}
      GROUP BY 1
      ORDER BY 1 ASC
    `);

    return {
      exercise,
      tz,
      points: rows.map((row) => ({
        date: row.day.toISOString().slice(0, 10),
        maxWeightKg: row.maxWeightKg,
        volumeKg: row.volumeKg,
        maxE1rmKg: row.maxE1rmKg,
        setsCount: row.setsCount,
      })),
    };
  }

  async summary(
    userId: string,
    exerciseId: string,
  ): Promise<{
    exercise: { id: string; name: string; wgerUuid: string };
    totalSets: number;
    lastUsedAt: Date | null;
    daysSinceLastUse: number | null;
    bestWeightKg: number | null;
    bestE1rmKg: number | null;
    firstBestWeightKg: number | null;
    lastBestWeightKg: number | null;
  }> {
    const exercise = await this.prisma.exercise.findFirst({
      where: { id: exerciseId },
      select: { id: true, name: true, wgerUuid: true },
    });
    if (!exercise) {
      throw new NotFoundException('Exercício não encontrado no catálogo');
    }

    const rows = await this.prisma.$queryRaw<SummaryRow[]>(Prisma.sql`
      WITH day_agg AS (
        SELECT
          date_trunc('day', ws."performedAt" AT TIME ZONE 'UTC')::date AS day,
          MAX(ws."weightKg")::float8 AS best
        FROM "WorkoutSet" AS ws
        WHERE ws."userId" = ${userId}
          AND ws."exerciseId" = ${exerciseId}
          AND ws."isBodyweight" = false
        GROUP BY 1
      )
      SELECT
        MAX(ws."weightKg")::float8 AS "bestWeightKg",
        MAX(ws."weightKg" * (1 + ws."reps"::float8 / 30))::float8 AS "bestE1rmKg",
        COUNT(*)::int4 AS "totalSets",
        MAX(ws."performedAt") AS "lastUsedAt",
        (SELECT best FROM day_agg ORDER BY day ASC LIMIT 1) AS "firstBestWeightKg",
        (SELECT best FROM day_agg ORDER BY day DESC LIMIT 1) AS "lastBestWeightKg"
      FROM "WorkoutSet" AS ws
      WHERE ws."userId" = ${userId}
        AND ws."exerciseId" = ${exerciseId}
        AND ws."isBodyweight" = false
    `);

    const row = rows[0] ?? null;
    const lastUsedAt = row?.lastUsedAt ?? null;
    const daysSinceLastUse =
      lastUsedAt === null
        ? null
        : Math.max(
            0,
            Math.floor((Date.now() - lastUsedAt.getTime()) / 86_400_000),
          );

    return {
      exercise,
      totalSets: row?.totalSets ?? 0,
      lastUsedAt,
      daysSinceLastUse,
      bestWeightKg: row?.bestWeightKg ?? null,
      bestE1rmKg: row?.bestE1rmKg ?? null,
      firstBestWeightKg: row?.firstBestWeightKg ?? null,
      lastBestWeightKg: row?.lastBestWeightKg ?? null,
    };
  }
}
