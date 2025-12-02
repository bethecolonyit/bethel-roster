import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';

export interface User {
  id: number;
  email: string;
  role: string; // 'admin' | 'user' | 'office' etc.
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);

  // TODO: move to environment file later if you want
  private apiUrl = 'http://localhost:3000';

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  currentUser$ = this.currentUserSubject.asObservable();

  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  /** Try to restore the logged-in user from the session cookie */
  loadMe(): Observable<User | null> {
    return this.http
      .get<User | null>(`${this.apiUrl}/auth/me`, {
        withCredentials: true, // send session cookie
      })
      .pipe(tap(user => this.currentUserSubject.next(user)));
  }

  /** Log in and store user in BehaviorSubject */
  login(email: string, password: string): Observable<User> {
    return this.http
      .post<User>(
        `${this.apiUrl}/auth/login`,
        { email, password },
        { withCredentials: true }
      )
      .pipe(tap(user => this.currentUserSubject.next(user)));
  }

  /** Log out and clear user */
  logout(): Observable<{ message: string }> {
    return this.http
      .post<{ message: string }>(
        `${this.apiUrl}/auth/logout`,
        {},
        { withCredentials: true }
      )
      .pipe(tap(() => this.currentUserSubject.next(null)));
  }
}
