import { Component } from '@angular/core';
import { NgIf, AsyncPipe } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

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
import { LoginComponent } from './components/login/login';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.html',
  imports: [
    NgIf,
    AsyncPipe,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatToolbarModule,
    MatIconModule,
    MatListModule,
    MatButtonModule,
    MatCardModule,
    LayoutModule,
    LoginComponent
  ],
})
export class App {
  isHandset$!: Observable<boolean>;
  isCollapsed = false;
  isDarkMode = false; // if you're using the theme toggle

  constructor(private breakpointObserver: BreakpointObserver,
  public auth: AuthService
  ) {
    this.isHandset$ = this.breakpointObserver
      .observe([Breakpoints.Handset])
      .pipe(
        map(result => result.matches),
        shareReplay()
      );
  }

  toggleSidebar(sidenav: MatSidenav): void {
    this.isHandset$.pipe(take(1)).subscribe(isHandset => {
      if (isHandset) {
        // On phones: open/close overlay drawer
        sidenav.toggle();
      } else {
        // On desktop: just collapse/expand the docked sidenav
        this.isCollapsed = !this.isCollapsed;
      }
    });
  }

  // Optional: theme toggle if you wired the SCSS
  toggleTheme(): void {
    this.isDarkMode = !this.isDarkMode;
    document.body.classList.toggle('dark-theme', this.isDarkMode);
  }  onLogout(): void {
    this.auth.logout().subscribe();
  }
}