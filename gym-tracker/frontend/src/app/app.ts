import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastService } from './core/toast/toast.service';
import { ThemeService } from './core/theme/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly toast = inject(ToastService);
  // Inicializa o tema (dark/light) antes de qualquer renderização.
  private readonly theme = inject(ThemeService);

  protected readonly toasts = this.toast.toasts;
}
