import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Student } from '../models/student';

@Injectable({ providedIn: 'root' })
export class StudentService {

  private api = 'http://localhost:3000/students';

  constructor(private http: HttpClient) {}

  createStudent(formData: FormData): Observable<any> {
    return this.http.post(`${this.api}`, formData, { withCredentials: true });
  }
    getStudents(): Observable<Student[]> {
        return this.http.get<Student[]>(`${this.api}-with-rooms`, {withCredentials: true});
    }
}
