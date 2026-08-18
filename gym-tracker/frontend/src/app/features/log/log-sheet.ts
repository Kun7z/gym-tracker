import { Component, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { ToastService } from '../../core/toast/toast.service';
import { Sheet } from '../../shared/components/sheet/sheet';
import { Stepper } from '../../shared/components/stepper/stepper';
import type { WorkoutSet } from '../../shared/models';
import { apiErrorMessage, uuid } from '../../shared/utils';

const WEIGHT_STEPS = [1, 2.5, 5];

@Component({
  selector: 'app-log-sheet',
  templateUrl: './log-sheet.html',
  styleUrl: './log-sheet.scss',
  imports: [Sheet, Stepper],
})
export class LogSheet {
  exerciseId = input.required<string>();
  exerciseName = input.required<string>();
  defaultWeight = input(20);
  defaultReps = input(10);

  saved = output<void>();
  close = output<void>();

  readonly weight = signal(20);
  readonly reps = signal(10);
  readonly step = signal(2.5);
  readonly isBodyweight = signal(false);
  readonly saving = signal(false);
  readonly justSaved = signal(false);

  protected readonly steps = WEIGHT_STEPS;

  private pendingUuid: string | null = null;
  private successTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly api: ApiService,
    private readonly toast: ToastService,
  ) {
    this.weight.set(this.defaultWeight() > 0 ? this.defaultWeight() : 20);
    this.reps.set(this.defaultReps() > 0 ? this.defaultReps() : 10);
  }

  setStep(step: number): void {
    this.step.set(step);
  }

  toggleBodyweight(): void {
    this.isBodyweight.update((v) => !v);
  }

  async save(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    const clientUuid = this.pendingUuid ?? uuid();

    const set = {
      clientUuid,
      exerciseId: this.exerciseId(),
      reps: this.reps(),
      isBodyweight: this.isBodyweight(),
      ...(this.isBodyweight() ? {} : { weightKg: this.weight() }),
      performedAt: new Date().toISOString(),
    };

    try {
      await firstValueFrom(
        this.api.post<{ sets: WorkoutSet[] }>('/sets', { sets: [set] }),
      );
      this.pendingUuid = null;
      this.justSaved.set(true);
      if (this.successTimer) clearTimeout(this.successTimer);
      this.successTimer = setTimeout(() => this.justSaved.set(false), 1600);
      this.toast.success('Série salva');
      this.saved.emit();
    } catch (err) {
      // Reutiliza o mesmo clientUuid no retry para evitar duplicatas.
      this.pendingUuid = clientUuid;
      this.toast.error(apiErrorMessage(err));
    } finally {
      this.saving.set(false);
    }
  }
}
