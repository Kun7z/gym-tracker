import { Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api/api.service';
import { ToastService } from '../../core/toast/toast.service';
import { Chart, type ChartMetric } from '../../shared/components/chart/chart';
import { LogSheet } from '../log/log-sheet';
import type {
  CatalogExercise,
  ExerciseHistory,
  ExerciseSummary,
  WorkoutSet,
} from '../../shared/models';
import {
  apiErrorMessage,
  daysAgoLabel,
  formatTime,
  formatWeight,
  localDayKey,
} from '../../shared/utils';

interface SetGroup {
  date: string;
  label: string;
  sets: WorkoutSet[];
}

@Component({
  selector: 'app-exercise-detail',
  templateUrl: './exercise-detail.html',
  styleUrl: './exercise-detail.scss',
  imports: [RouterLink, Chart, LogSheet],
})
export class ExerciseDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  readonly id = signal<string | null>(null);
  readonly exercise = signal<CatalogExercise | null>(null);
  readonly summary = signal<ExerciseSummary | null>(null);
  readonly history = signal<ExerciseHistory | null>(null);
  readonly sets = signal<WorkoutSet[]>([]);
  readonly metric = signal<ChartMetric>('weight');
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly showLog = signal(false);
  readonly confirmingDelete = signal<string | null>(null);

  readonly groups = computed<SetGroup[]>(() => {
    const map = new Map<string, WorkoutSet[]>();
    for (const set of this.sets()) {
      const key = localDayKey(set.performedAt);
      const list = map.get(key) ?? [];
      list.push(set);
      map.set(key, list);
    }
    return [...map.entries()].map(([date, sets]) => ({
      date,
      label: this.dayLabel(date),
      sets,
    }));
  });

  readonly isRecord = computed(() => {
    const s = this.summary();
    if (!s) return false;
    return (
      s.bestWeightKg !== null &&
      s.bestWeightKg > 0 &&
      s.lastBestWeightKg !== null &&
      s.lastBestWeightKg >= s.bestWeightKg
    );
  });

  readonly defaultWeight = computed(() => {
    const s = this.summary();
    return s?.bestWeightKg ?? this.sets()[0]?.weightKg ?? 20;
  });

  readonly defaultReps = computed(() => {
    return this.sets()[0]?.reps ?? 10;
  });

  private confirmTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.route.params.subscribe((params) => {
      const id = params['id'] as string;
      this.id.set(id);
      void this.loadAll(id);
    });
  }

  protected formatWeight = formatWeight;
  protected daysAgoLabel = daysAgoLabel;
  protected formatTime = formatTime;

  setMetric(m: ChartMetric): void {
    this.metric.set(m);
  }

  openLog(): void {
    this.showLog.set(true);
  }

  closeLog(): void {
    this.showLog.set(false);
  }

  onSaved(): void {
    const id = this.id();
    if (!id) return;
    void this.loadSets(id);
    void this.refreshStats(id);
  }

  requestDelete(setId: string): void {
    if (this.confirmingDelete() === setId) {
      void this.deleteSet(setId);
      return;
    }
    this.confirmingDelete.set(setId);
    if (this.confirmTimer) clearTimeout(this.confirmTimer);
    this.confirmTimer = setTimeout(() => this.confirmingDelete.set(null), 3200);
  }

  protected timezone(): string {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return 'UTC';
    }
  }

  protected async loadAll(id: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [ex, sum, hist] = await Promise.all([
        firstValueFrom(this.api.get<CatalogExercise>(`/catalog/exercises/${id}`)),
        firstValueFrom(this.api.get<ExerciseSummary>(`/exercises/${id}/summary`)),
        firstValueFrom(
          this.api.get<ExerciseHistory>(`/exercises/${id}/history`, {
            tz: this.timezone(),
          }),
        ),
      ]);
      this.exercise.set(ex);
      this.summary.set(sum);
      this.history.set(hist);
      await this.loadSets(id);
    } catch (err) {
      this.error.set(apiErrorMessage(err));
    } finally {
      this.loading.set(false);
    }
  }

  private async loadSets(id: string): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.api.get<{ items: WorkoutSet[]; total: number }>('/sets', {
          exerciseId: id,
          limit: 200,
        }),
      );
      this.sets.set(res.items);
    } catch (err) {
      this.error.set(apiErrorMessage(err));
    }
  }

  private async refreshStats(id: string): Promise<void> {
    try {
      const [sum, hist] = await Promise.all([
        firstValueFrom(this.api.get<ExerciseSummary>(`/exercises/${id}/summary`)),
        firstValueFrom(
          this.api.get<ExerciseHistory>(`/exercises/${id}/history`, {
            tz: this.timezone(),
          }),
        ),
      ]);
      this.summary.set(sum);
      this.history.set(hist);
    } catch {
      // Stats são secundárias; o histórico de séries já foi atualizado.
    }
  }

  private async deleteSet(setId: string): Promise<void> {
    try {
      await firstValueFrom(this.api.delete(`/sets/${setId}`));
      this.sets.update((list) => list.filter((s) => s.id !== setId));
      this.toast.success('Série removida');
      const id = this.id();
      if (id) void this.refreshStats(id);
    } catch (err) {
      this.toast.error(apiErrorMessage(err));
    }
  }

  private dayLabel(dateKey: string): string {
    const d = new Date(dateKey + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.round(
      (today.getTime() - d.getTime()) / 86_400_000,
    );
    if (diffDays === 0) return 'Hoje';
    if (diffDays === 1) return 'Ontem';
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
}
