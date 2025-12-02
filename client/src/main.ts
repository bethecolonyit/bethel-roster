import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, Routes } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpInterceptorFn } from '@angular/common/http';

import { App } from './app/app'; // your root
import { LoginComponent } from './app/components/login/login';
import { authGuard } from './app/guards/auth-guard';

const credentialsInterceptor: HttpInterceptorFn = (req, next) => {
  const withCreds = req.clone({ withCredentials: true });
  return next(withCreds);
};

const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: App,
    canActivate: [authGuard],
  },
];

bootstrapApplication(App, {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([credentialsInterceptor])),
  ],
}).catch(err => console.error(err));
