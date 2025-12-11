import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Student } from '../models/student';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class StudentService {

  private api = `${environment.apiBaseUrl}/api/students`;

  constructor(private http: HttpClient) {}

  createStudent(formData: FormData): Observable<any> {
    return this.http.post(`${this.api}`, formData, { withCredentials: true });
  }
    getStudents(): Observable<Student[]> {
        return this.http.get<Student[]>(`${this.api}-with-rooms`, {withCredentials: true});
    }
    getStudentById(id: number): Observable<Student> {
        return this.http.get<Student>(`${this.api}/${id}`, {withCredentials: true});
    }
    updateStudent(id: number, studentData: Partial<Student>): Observable<any> {
        return this.http.put(`${this.api}/${id}`, studentData, {withCredentials: true});
    }
    deleteStudent(id: number, idNumber: string): Observable<string> {
       
        return this.http.delete(this.api, {
          body: { id, idNumber },
          responseType: 'text', // backend sends plain text (e.g. "5 was successfully deleted")
          withCredentials: true
        });
      }
}
