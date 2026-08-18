import { Component, input, model, output } from '@angular/core';

@Component({
  selector: 'app-stepper',
  templateUrl: './stepper.html',
  styleUrl: './stepper.scss',
})
export class Stepper {
  value = model<number>(0);
  step = input(1);
  min = input(0);
  max = input(1000);
  decimals = input(1);
  /** Texto pequeno sob o valor (ex.: "kg"). */
  unit = input('');

  changed = output<number>();

  /** Formata o valor sem depender de locale (ex.: 2,5). */
  protected fmt(): string {
    const v = this.value();
    return Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ',');
  }

  private repeatTimer: ReturnType<typeof setInterval> | null = null;
  private repeatDelay: ReturnType<typeof setTimeout> | null = null;

  add(): void {
    this.bump(this.step());
  }

  sub(): void {
    this.bump(-this.step());
  }

  private bump(delta: number): void {
    const next = this.clamp(Number((this.value() + delta).toFixed(2)));
    this.value.set(next);
    this.changed.emit(next);
  }

  private clamp(v: number): number {
    return Math.min(this.max(), Math.max(this.min(), v));
  }

  startRepeat(direction: 1 | -1): void {
    this.stopRepeat();
    this.repeatDelay = setTimeout(() => {
      this.repeatTimer = setInterval(() => {
        this.bump(this.step() * direction);
      }, 90);
    }, 380);
  }

  stopRepeat(): void {
    if (this.repeatDelay) {
      clearTimeout(this.repeatDelay);
      this.repeatDelay = null;
    }
    if (this.repeatTimer) {
      clearInterval(this.repeatTimer);
      this.repeatTimer = null;
    }
  }
}
