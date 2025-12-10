import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { of } from 'rxjs';
import { catchError, map, take } from 'rxjs/operators';
import { AuthService } from '../services/auth';

export const counselorGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const existingUser = auth.currentUser;
  if (existingUser) {
    if (existingUser.role === 'counselor' || existingUser.role === 'admin') {
      return true;
    }
    // Logged in but not counselor → send to dashboard
    router.navigate(['/dashboard']);
    return false;
  }

  // No user in memory – check session with /auth/me
  return auth.me().pipe(
    take(1),
    map(user => {
      if (user && user.role === 'counselor' || user && user.role === 'admin') {
        return true;
      }

      if (user && user.role !== 'counselor' || user && user.role !== 'admin') {
        router.navigate(['/dashboard']);
        return false;
      }

      // Not logged in
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
