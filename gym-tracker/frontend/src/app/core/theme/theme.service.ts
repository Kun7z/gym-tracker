import { Injectable, signal } from '@angular/core';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'carga-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>('dark');

  private metaTheme: HTMLMetaElement | null = null;

  constructor() {
    const stored = this.readStored();
    const initial: Theme =
      stored ??
      (window.matchMedia?.('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark');
    this.theme.set(initial);
    this.apply(initial);
  }

  toggle(): void {
    this.set(this.theme() === 'dark' ? 'light' : 'dark');
  }

  set(theme: Theme): void {
    this.theme.set(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Armazenamento indisponível (ex.: testes) — segue sem persistir.
    }
    this.apply(theme);
  }

  private readStored(): Theme | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === 'light' || stored === 'dark' ? stored : null;
    } catch {
      return null;
    }
  }

  private apply(theme: Theme): void {
    document.documentElement.dataset['theme'] = theme;
    const color = theme === 'dark' ? '#030305' : '#f6f7f8';
    if (!this.metaTheme) {
      this.metaTheme = document.querySelector('meta[name="theme-color"]');
    }
    if (this.metaTheme) {
      this.metaTheme.content = color;
    }
  }
}
