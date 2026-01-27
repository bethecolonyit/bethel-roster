import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface User {
  id: number;
  email: string;
  role: string; // 'admin' | 'user' | etc.
  themePreference?: 'dark' | 'light' | null;
}

export interface LoginPayload {
  email: string;
  password: string;
}
export interface UserLookup {
  id: number;
  email:string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiBaseUrl;

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  currentUser$ = this.currentUserSubject.asObservable();

  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  private setUser(user: User | null) {
    this.currentUserSubject.next(user);
  }

  /** Check current session */
  me(): Observable<User | null> {
    return this.http
      .get<User | null>(`${this.apiUrl}/auth/me`, {
        withCredentials: true,
      })
      .pipe(tap(user => this.setUser(user)));
  }

  /**
   * Alias kept for backwards compatibility.
   * Your app.ts and old auth-guard.ts call auth.loadMe().
   */
  loadMe(): Observable<User | null> {
    return this.me();
  }

  /**
   * Old signature: login(email, password)
   * Your login component calls it like this, so we keep that API.
   */
  login(email: string, password: string): Observable<User> {
    const payload: LoginPayload = { email, password };

    return this.http
      .post<User>(`${this.apiUrl}/auth/login`, payload, {
        withCredentials: true,
      })
      .pipe(tap(user => this.setUser(user)));
  }

  /** Logout and clear user */
  logout(): Observable<{ message: string }> {
    return this.http
      .post<{ message: string }>(
        `${this.apiUrl}/auth/logout`,
        {},
        { withCredentials: true }
      )
      .pipe(tap(() => this.setUser(null)));
  }
    get isLoggedIn(): boolean {
    return !!this.currentUser;
  }
  get isAdmin(): boolean {
    return this.currentUser?.role === 'admin';
  }
  get isHR(): boolean {
    return this.currentUser?.role === 'hr';
  }
  get isOffice(): boolean {
    return this.currentUser?.role === 'office';
  }
  get isCounseling(): boolean {
    return this.currentUser?.role === 'counseling';
  }
  get isCounselingCoordinator(): boolean {
    return this.currentUser?.role === 'counseling_coordinator';
  }
  getUsersLookup(includeUserId?: number) {
  const url =
    includeUserId != null
      ? `${this.apiUrl}/auth/users/lookup/?includeUserId=${includeUserId}`
      : `${this.apiUrl}/auth/users/lookup`;
  return this.http.get<UserLookup[]>(url, { withCredentials: true });
}
saveThemePreference(themePreference: 'dark' | 'light') {
  return this.http.patch(
    `${this.apiUrl}/auth/me/theme`,
    { themePreference },
    { withCredentials: true }
  );
}
}
