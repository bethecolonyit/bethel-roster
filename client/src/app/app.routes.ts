import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login';
import { Dashboard } from './components/dashboard/dashboard';
import { Students } from './components/students/students';
import { authGuard } from './guards/auth-guard';
import { UsersComponent } from './components/users/users'; 
import { adminGuard } from './guards/admin-guard';           
import { Residential } from './components/residential/residential';

export const appRoutes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  { path: 'login', component: LoginComponent },

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
  {
    path: 'users',
    component: UsersComponent,
    canActivate: [adminGuard],   // only admins
  },
  {
    path: 'residential',
    component: Residential,
    canActivate: [adminGuard],  
  },

  { path: '**', redirectTo: 'login' },
];
