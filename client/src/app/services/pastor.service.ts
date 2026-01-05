import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Pastor } from '../models/pastor';

@Injectable({ providedIn: 'root' })
export class PastorService {
  private api = `${environment.apiBaseUrl}/api/pastors`;

  constructor(private http: HttpClient) {}

  getPastors(activeOnly = true): Observable<Pastor[]> {
    const qs = activeOnly ? '?activeOnly=1' : '';
    return this.http.get<Pastor[]>(`${this.api}${qs}`, { withCredentials: true });
  }
}
