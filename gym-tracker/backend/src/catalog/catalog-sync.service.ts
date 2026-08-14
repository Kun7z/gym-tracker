import {
  ConflictException,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WgerApiClient } from './wger-api.client';
import {
  WgerCategory,
  WgerDeletionLog,
  WgerEquipment,
  WgerExerciseInfo,
  WgerLanguage,
  WgerMuscle,
  WgerTranslationInfo,
} from './wger.types';

export interface SyncResult {
  equipment: number;
  muscles: number;
  categories: number;
  exercises: number;
  exercisesActive: number;
  deleted: number;
  syncedAt: Date;
}

function slugify(input: string): string {
  return (
    input
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'sem-nome'
  );
}

@Injectable()
export class CatalogSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CatalogSyncService.name);
  private syncing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly wger: WgerApiClient,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.wger.enabled) return;
    try {
      const count = await this.prisma.exercise.count();
      if (count === 0) {
        this.logger.log('Catálogo vazio — executando primeira sincronização');
        await this.runSync();
      }
    } catch (error) {
      this.logger.warn(
        `Primeira sincronização falhou (vai tentar de novo no agendamento): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async runSync(): Promise<SyncResult> {
    if (!this.wger.enabled) {
      throw new ServiceUnavailableException('WGER_BASE_URL não configurado');
    }
    if (this.syncing) {
      throw new ConflictException('Sincronização já em andamento');
    }

    this.syncing = true;
    try {
      const [equipment, muscles, categories, languages, exercises, deletions] =
        await Promise.all([
          this.wger.fetchAll<WgerEquipment>('/equipment/'),
          this.wger.fetchAll<WgerMuscle>('/muscle/'),
          this.wger.fetchAll<WgerCategory>('/exercisecategory/'),
          this.wger.fetchAll<WgerLanguage>('/language/'),
          this.wger.fetchAll<WgerExerciseInfo>('/exerciseinfo/'),
          this.wger.fetchAll<WgerDeletionLog>('/deletion-log/'),
        ]);

      const langById = new Map(
        languages.map((lang) => [lang.id, lang.short_name]),
      );
      const deletedUuids = new Set(deletions.map((d) => d.uuid));

      await this.upsertLookups(equipment, muscles, categories);
      await this.upsertExercises(exercises, deletedUuids, langById);

      if (deletedUuids.size > 0) {
        await this.prisma.exercise.updateMany({
          where: { wgerUuid: { in: [...deletedUuids] }, isActive: true },
          data: { isActive: false },
        });
      }

      const exercisesActive = await this.prisma.exercise.count({
        where: { isActive: true },
      });
      const syncedAt = new Date();
      await this.prisma.catalogSyncState.upsert({
        where: { id: 1 },
        update: { lastSyncedAt: syncedAt, exercisesCount: exercisesActive },
        create: {
          id: 1,
          lastSyncedAt: syncedAt,
          exercisesCount: exercisesActive,
        },
      });

      return {
        equipment: equipment.length,
        muscles: muscles.length,
        categories: categories.length,
        exercises: exercises.length,
        exercisesActive,
        deleted: deletedUuids.size,
        syncedAt,
      };
    } finally {
      this.syncing = false;
    }
  }

  async status() {
    return this.prisma.catalogSyncState.findUnique({ where: { id: 1 } });
  }

  private async upsertLookups(
    equipment: WgerEquipment[],
    muscles: WgerMuscle[],
    categories: WgerCategory[],
  ): Promise<void> {
    const taken = new Set<string>();
    const uniqueSlug = (name: string): string => {
      const base = slugify(name);
      let slug = base;
      let n = 2;
      while (taken.has(slug)) {
        slug = `${base}-${n++}`;
      }
      taken.add(slug);
      return slug;
    };

    for (const item of equipment) {
      const slug = uniqueSlug(item.name);
      await this.prisma.equipment.upsert({
        where: { id: item.id },
        update: { name: item.name, slug },
        create: {
          id: item.id,
          name: item.name,
          slug,
        },
      });
    }
    for (const item of muscles) {
      await this.prisma.muscle.upsert({
        where: { id: item.id },
        update: {
          name: item.name,
          nameEn: item.name_en || null,
          isFront: item.is_front,
        },
        create: {
          id: item.id,
          name: item.name,
          nameEn: item.name_en || null,
          isFront: item.is_front,
        },
      });
    }
    for (const item of categories) {
      const slug = uniqueSlug(item.name);
      await this.prisma.exerciseCategory.upsert({
        where: { id: item.id },
        update: { name: item.name, slug },
        create: {
          id: item.id,
          name: item.name,
          slug,
        },
      });
    }
  }

  private async upsertExercises(
    exercises: WgerExerciseInfo[],
    deletedUuids: Set<string>,
    langById: Map<number, string>,
  ): Promise<void> {
    for (const exercise of exercises) {
      if (deletedUuids.has(exercise.uuid)) continue;

      const { name, nameEn } = this.pickNames(exercise.translations, langById);
      const equipmentIds = exercise.equipment.map((e) => ({ id: e.id }));
      const muscleIds = [
        ...exercise.muscles,
        ...exercise.muscles_secondary,
      ].map((m) => ({ id: m.id }));

      const base = {
        name,
        nameEn,
        variationGroup: exercise.variation_group,
        imageUrl: this.mainImage(exercise),
        licenseAuthor: exercise.license_author,
        isActive: true,
        lastSyncedAt: new Date(),
      };

      await this.prisma.exercise.upsert({
        where: { wgerUuid: exercise.uuid },
        update: {
          ...base,
          category: { connect: { id: exercise.category.id } },
          equipment: { set: equipmentIds },
          muscles: { set: muscleIds },
        },
        create: {
          wgerUuid: exercise.uuid,
          ...base,
          category: { connect: { id: exercise.category.id } },
          equipment: { connect: equipmentIds },
          muscles: { connect: muscleIds },
        },
      });
    }
  }

  private pickNames(
    translations: WgerTranslationInfo[],
    langById: Map<number, string>,
  ): { name: string; nameEn: string } {
    const byLang = new Map<string, WgerTranslationInfo>();
    for (const translation of translations) {
      const shortName = langById.get(translation.language);
      if (shortName && !byLang.has(shortName)) {
        byLang.set(shortName, translation);
      }
    }
    const pt = byLang.get('pt');
    const en = byLang.get('en');
    const fallback = translations[0];
    const name = pt?.name ?? en?.name ?? fallback?.name ?? 'Sem nome';
    const nameEn = en?.name ?? pt?.name ?? fallback?.name ?? name;
    return { name, nameEn };
  }

  private mainImage(exercise: WgerExerciseInfo): string | null {
    const images = exercise.images;
    if (images.length === 0) return null;
    return images.find((img) => img.is_main)?.image ?? images[0].image ?? null;
  }
}
