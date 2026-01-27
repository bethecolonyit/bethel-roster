// app.ts
import { Component, ViewChild } from '@angular/core';
import { NgIf, AsyncPipe } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { MatSidenavModule, MatSidenav } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';

import { LayoutModule, BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Observable } from 'rxjs';
import { map, shareReplay, take } from 'rxjs/operators';

import { AuthService } from './services/auth';
import { environment } from '../environments/environment';

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

  private readonly THEME_KEY = 'bethelRoster.theme'; // 'dark' | 'light'

  constructor(
    private breakpointObserver: BreakpointObserver,
    public auth: AuthService,
    private router: Router
  ) {
    console.log('API BASE URL:', environment.apiBaseUrl);
    console.log('PRODUCTION FLAG:', environment.production);

    // 1) Apply saved theme immediately (prevents flicker)
    this.applyThemeFromStorage();

    // 2) Restore logged-in user from session cookie, then apply DB theme if present
    this.auth.loadMe().subscribe((me) => {
      const pref = me?.themePreference;
      if (pref === 'dark' || pref === 'light') {
        const isDark = pref === 'dark';
        this.isDarkMode = isDark;
        this.applyThemeToDom(isDark);
        localStorage.setItem(this.THEME_KEY, pref);
      }
    });

    this.isHandset$ = this.breakpointObserver
      .observe([Breakpoints.Handset])
      .pipe(map((result) => result.matches), shareReplay());
  }

  get isLoginPage(): boolean {
    return this.router.url.startsWith('/login');
  }

  @ViewChild('sidenav') sidenav!: MatSidenav;

  toggleSidebar(): void {
    this.isHandset$.pipe(take(1)).subscribe((isHandset) => {
      if (isHandset) this.sidenav.toggle();
      else this.isCollapsed = !this.isCollapsed;
    });
  }

  toggleTheme(): void {
    this.isDarkMode = !this.isDarkMode;

    // update UI instantly
    this.applyThemeToDom(this.isDarkMode);
    this.persistTheme(this.isDarkMode);

    // best-effort sync to DB (only if logged in)
    if (this.auth.isLoggedIn) {
      const pref = this.isDarkMode ? 'dark' : 'light';
      this.auth.saveThemePreference(pref).subscribe({
        error: (err) => console.warn('Failed to save theme preference', err),
      });
    }
  }

  private applyThemeFromStorage(): void {
    const v = localStorage.getItem(this.THEME_KEY);
    const isDark = v === 'dark';
    this.isDarkMode = isDark;
    this.applyThemeToDom(isDark);
  }

  private persistTheme(isDark: boolean): void {
    localStorage.setItem(this.THEME_KEY, isDark ? 'dark' : 'light');
  }

  private applyThemeToDom(isDark: boolean): void {
    document.body.classList.toggle('dark-theme', isDark);
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
