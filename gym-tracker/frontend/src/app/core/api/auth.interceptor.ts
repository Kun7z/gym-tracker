import {
  HttpErrorResponse,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';

const RETRY_MARKER = 'x-carga-retried';

function isAuthUrl(url: string): boolean {
  return url.includes('/auth/');
}

/** Anexa o Bearer token e renova o access token uma vez quando recebe 401. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const token = auth.token;
  const withAuth = token
    ? req.clone({
        setHeaders: { Authorization: `Bearer ${token}` },
      })
    : req;

  return next(withAuth).pipe(
    catchError((error: HttpErrorResponse) => {
      const is401 = error.status === 401;
      const retried = req.headers.has(RETRY_MARKER);

      if (!is401 || isAuthUrl(req.url) || retried) {
        if (is401 && !isAuthUrl(req.url) && !auth.isAuthenticated()) {
          // Sessão expirada e sem como renovar — volta para o login.
          auth.clearSession();
          router.navigate(['/login']);
        }
        return throwError(() => error);
      }

      return from(auth.refresh()).pipe(
        switchMap((ok) => {
          if (!ok) {
            auth.clearSession();
            router.navigate(['/login']);
            return throwError(() => error);
          }
          const retryReq: HttpRequest<unknown> = req.clone({
            setHeaders: {
              Authorization: `Bearer ${auth.token ?? ''}`,
              [RETRY_MARKER]: 'true',
            },
          });
          return next(retryReq);
        }),
      );
    }),
  );
};
