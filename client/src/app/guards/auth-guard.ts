import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { of } from 'rxjs';
import { catchError, map, switchMap, take } from 'rxjs/operators';
import { AuthService } from '../services/auth';

export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // If we already have a user in memory, allow immediately
  const existingUser = auth.currentUser;
  if (existingUser) {
    return true;
  }

  // Otherwise try to restore from session (/auth/me)
  return auth.loadMe().pipe(
    take(1),
    map(user => {
      if (user) {
        return true;
      }

      router.navigate(['/login'], {
        queryParams: { returnUrl: state.url },
      });
      return false;
    }),
    catchError(() => {
      router.navigate(['/login'], {
        queryParams: { returnUrl: state.url },
      });
      return of(false);
    })
  );
};
