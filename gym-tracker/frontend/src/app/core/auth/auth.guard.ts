import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

export async function authGuard(): Promise<boolean> {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.init();
  if (auth.isAuthenticated()) {
    return true;
  }
  return router.navigate(['/login']);
}

export async function guestGuard(): Promise<boolean> {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.init();
  if (!auth.isAuthenticated()) {
    return true;
  }
  return router.navigate(['/exercicios']);
}
