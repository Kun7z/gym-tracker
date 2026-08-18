import { Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';
import { ApiService } from '../api/api.service';
import type { AuthResponse, MeResponse, PublicUser } from '../../shared/models';

/**
 * Guarda o access token apenas em memória. O refresh token vive em cookie
 * httpOnly no backend, então a sessão sobrevive a reloads sem expor o token
 * ao XSS.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly user = signal<PublicUser | null>(null);
  readonly ready = signal(false);

  private accessToken: string | null = null;
  private refreshPromise: Promise<boolean> | null = null;

  constructor(
    private readonly api: ApiService,
    private readonly router: Router,
  ) {}

  get token(): string | null {
    return this.accessToken;
  }

  isAuthenticated(): boolean {
    return this.accessToken !== null;
  }

  /** Tenta restaurar a sessão via refresh cookie. Chamado uma vez no boot. */
  async init(): Promise<void> {
    if (this.accessToken) {
      this.ready.set(true);
      return;
    }
    await this.tryRefresh();
    this.ready.set(true);
  }

  async login(email: string, password: string): Promise<void> {
    const res = await firstValueFrom(
      this.api.post<AuthResponse>('/auth/login', { email, password }),
    );
    this.applySession(res);
  }

  async register(
    email: string,
    password: string,
    displayName?: string,
  ): Promise<void> {
    const res = await firstValueFrom(
      this.api.post<AuthResponse>('/auth/register', {
        email,
        password,
        ...(displayName ? { displayName } : {}),
      }),
    );
    this.applySession(res);
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.api.post('/auth/logout'));
    } finally {
      this.clearSession();
      this.router.navigate(['/login']);
    }
  }

  async refresh(): Promise<boolean> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.doRefresh().finally(() => {
        this.refreshPromise = null;
      });
    }
    return this.refreshPromise;
  }

  private async tryRefresh(): Promise<boolean> {
    const ok = await this.refresh();
    if (!ok) {
      this.clearSession();
    }
    return ok;
  }

  private async doRefresh(): Promise<boolean> {
    try {
      const res = await firstValueFrom(
        this.api.post<AuthResponse>('/auth/refresh'),
      );
      this.applySession(res);
      return true;
    } catch {
      return false;
    }
  }

  private async fetchMe(): Promise<void> {
    try {
      const res = await firstValueFrom(this.api.get<MeResponse>('/auth/me'));
      this.user.set(res.user);
    } catch {
      this.clearSession();
    }
  }

  private applySession(res: AuthResponse): void {
    this.accessToken = res.accessToken;
    this.user.set(res.user);
    void this.fetchMe();
  }

  clearSession(): void {
    this.accessToken = null;
    this.user.set(null);
  }
}
