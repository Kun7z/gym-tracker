import { Injectable, signal } from '@angular/core';

export type ToastType = 'info' | 'success' | 'error';

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly items = signal<Toast[]>([]);
  readonly toasts = this.items.asReadonly();

  private nextId = 1;

  show(message: string, type: ToastType = 'info', duration = 2400): void {
    const toast: Toast = { id: this.nextId++, message, type };
    this.items.update((list) => [...list, toast]);
    setTimeout(() => {
      this.items.update((list) => list.filter((t) => t.id !== toast.id));
    }, duration);
  }

  success(message: string): void {
    this.show(message, 'success');
  }

  error(message: string): void {
    this.show(message, 'error', 4000);
  }
}
