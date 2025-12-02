// src/app/app.routes.ts
import { Routes } from '@angular/router';

import { LoginComponent } from './components/login/login';
import { Dashboard } from './components/dashboard/dashboard';
import { Students } from './components/students/students';
import { authGuard } from './guards/auth-guard';

export const appRoutes: Routes = [
  // Default → login
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  // Public
  { path: 'login', component: LoginComponent },

  // Protected routes
  {
    path: 'dashboard',
    component: Dashboard,
    canActivate: [authGuard],
  },
  {
    path: 'students',
    component: Students,
    canActivate: [authGuard],
  },

  // Fallback
  { path: '**', redirectTo: 'login' },
];
