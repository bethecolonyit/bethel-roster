// src/app/services/user.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface User {
  id: number;
  email: string;
  role: string;      // 'admin' | 'user' (backend may have more)
  created_at?: string;
}

export interface CreateUserDto {
  email: string;
  password: string;
  role: 'admin' | 'user' | 'counseling_coordinator' | 'counselor' | 'office';
}

export interface UpdateUserDto {
  email: string;
  role: 'admin' | 'user' | 'counseling_coordinator' | 'counselor' | 'office';
  password?: string;  // optional when editing
}
export interface ResetPasswordDto {
  password: string;
}
@Injectable({
  providedIn: 'root'
})
export class UserService {
  // Adjust to environment later if you want
  private baseUrl = `${environment.apiBaseUrl}/auth/users`;

  constructor(private http: HttpClient) {}

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(this.baseUrl, {
      withCredentials: true,  // send session cookie
    });
  }

  createUser(payload: CreateUserDto): Observable<User> {
    return this.http.post<User>(this.baseUrl, payload, {
      withCredentials: true,
    });
  }

  updateUser(id: number, payload: UpdateUserDto): Observable<User> {
    return this.http.put<User>(`${this.baseUrl}/${id}`, payload, {
      withCredentials: true,
    });
  }

  deleteUser(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/${id}`, {
      withCredentials: true,
    });
  }
  resetPassword(id: number, payload: ResetPasswordDto): Observable<{ message: string }> {
    // Adjust URL if your backend uses something different
    return this.http.post<{ message: string }>(
      `${this.baseUrl}/${id}/reset-password`,
      payload,
      { withCredentials: true }
    );
  }
}
