import { Component, ViewChild } from '@angular/core';
import { NgIf, AsyncPipe } from '@angular/common';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';

import { MatSidenavModule, MatSidenav } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';

import {
  LayoutModule,
  BreakpointObserver,
  Breakpoints,
} from '@angular/cdk/layout';
import { Observable } from 'rxjs';
import { map, shareReplay, take } from 'rxjs/operators';

import { AuthService } from './services/auth';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.html',
  styleUrls: ['../styles.scss'],
  imports: [
    NgIf,
    AsyncPipe,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    MatSidenavModule,
    MatToolbarModule,
    MatIconModule,
    MatListModule,
    MatButtonModule,
    MatCardModule,
    LayoutModule,
  ],
})
export class App {
 
  isHandset$!: Observable<boolean>;
  isCollapsed = false;
  isDarkMode = false;
  departmentsOpen = false;

  constructor(
    private breakpointObserver: BreakpointObserver,
    public auth: AuthService,
    private router: Router
  ) {
    // Restore logged-in user from session cookie on app start
    this.auth.loadMe().subscribe();

    this.isHandset$ = this.breakpointObserver
      .observe([Breakpoints.Handset])
      .pipe(
        map((result) => result.matches),
        shareReplay()
      );
  }

    get isLoginPage(): boolean {
    return this.router.url.startsWith('/login');
  }
 @ViewChild('sidenav') sidenav!: MatSidenav;
 toggleSidebar(): void {
  this.isHandset$.pipe(take(1)).subscribe((isHandset) => {
    if (isHandset) {
      this.sidenav.toggle();
    } else {
      this.isCollapsed = !this.isCollapsed;
    }
  });
}
  toggleTheme(): void {
    this.isDarkMode = !this.isDarkMode;
    document.body.classList.toggle('dark-theme', this.isDarkMode);
  }

  onLogout(): void {
    this.auth.logout().subscribe({
      next: () => {
        this.isCollapsed = false;
        this.router.navigateByUrl('/login');
      },
      error: () => {
        this.isCollapsed = false;
        this.router.navigateByUrl('/login');
      },
    });
  }
}
