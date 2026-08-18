import { Component, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/theme/theme.service';
import type {
  CatalogEquipment,
  CatalogExercise,
  Paginated,
  WorkoutSet,
} from '../../shared/models';
import {
  apiErrorMessage,
  formatDayLabel,
  formatWeight,
  localDayKey,
} from '../../shared/utils';

interface RecentExercise {
  exerciseId: string;
  name: string;
  weightKg: number;
  reps: number;
  performedAt: string;
}

const PAGE_SIZE = 100;

@Component({
  selector: 'app-home',
  templateUrl: './home.html',
  styleUrl: './home.scss',
  imports: [RouterLink],
})
export class Home {
  readonly equipment = signal<CatalogEquipment[]>([]);
  readonly exercises = signal<CatalogExercise[]>([]);
  readonly recents = signal<RecentExercise[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly loadingMore = signal(false);
  readonly error = signal<string | null>(null);
  readonly query = signal('');
  readonly equipmentId = signal<number | null>(null);

  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly themeService = inject(ThemeService);

  readonly theme = this.themeService.theme;

  private offset = 0;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    void this.loadEquipment();
    void this.loadRecents();
    void this.loadExercises();
  }

  onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.query.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      void this.loadExercises();
    }, 300);
  }

  selectEquipment(id: number | null): void {
    this.equipmentId.set(id);
    void this.loadExercises();
  }

  async logout(): Promise<void> {
    await this.auth.logout();
  }

  toggleTheme(): void {
    this.themeService.toggle();
  }

  protected formatWeight = formatWeight;

  protected dayLabel(iso: string): string {
    return formatDayLabel(localDayKey(iso));
  }

  private async loadEquipment(): Promise<void> {
    try {
      const items = await firstValueFrom(
        this.api.get<CatalogEquipment[]>('/catalog/equipment'),
      );
      this.equipment.set(items);
    } catch {
      // Filtro é opcional — segue sem ele.
    }
  }

  private async loadRecents(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.api.get<Paginated<WorkoutSet>>('/sets', { limit: 40 }),
      );
      const latestByExercise = new Map<string, WorkoutSet>();
      for (const set of res.items) {
        const prev = latestByExercise.get(set.exerciseId);
        if (!prev || set.performedAt > prev.performedAt) {
          latestByExercise.set(set.exerciseId, set);
        }
      }
      const recents: RecentExercise[] = [...latestByExercise.values()]
        .sort((a, b) => b.performedAt.localeCompare(a.performedAt))
        .slice(0, 6)
        .map((set) => ({
          exerciseId: set.exerciseId,
          name: set.exercise?.name ?? 'Exercício',
          weightKg: set.weightKg,
          reps: set.reps,
          performedAt: set.performedAt,
        }));
      this.recents.set(recents);
    } catch {
      // Recentes são opcionais.
    }
  }

  protected async loadExercises(reset = true): Promise<void> {
    if (reset) {
      this.offset = 0;
      this.loading.set(true);
    } else {
      this.loadingMore.set(true);
    }
    this.error.set(null);
    try {
      const params: Record<string, string | number> = {
        limit: PAGE_SIZE,
        offset: this.offset,
      };
      if (this.query()) params['q'] = this.query();
      if (this.equipmentId() !== null) params['equipment'] = this.equipmentId()!;

      const res = await firstValueFrom(
        this.api.get<Paginated<CatalogExercise>>('/catalog/exercises', params),
      );
      this.exercises.update((prev) =>
        reset ? res.items : [...prev, ...res.items],
      );
      this.total.set(res.total);
      this.offset += res.items.length;
    } catch (err) {
      this.error.set(apiErrorMessage(err));
    } finally {
      this.loading.set(false);
      this.loadingMore.set(false);
    }
  }

  protected loadMore(): void {
    void this.loadExercises(false);
  }

  protected hasMore(): boolean {
    return this.exercises().length < this.total();
  }
}
