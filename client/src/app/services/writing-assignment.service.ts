import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { WritingAssignmentListItem } from '../models/WritingAssignmentListItem';

export interface AtRiskStudentRow {
  studentId: number;
  firstName: string;
  lastName: string;
  program: string | null;
  counselor: string | null;
  idNumber: string | null;
  totalDemerits: number;
}

@Injectable({ providedIn: 'root' })
export class WritingAssignmentService {
  

  private api = `${environment.apiBaseUrl}/api/writing-assignments`;

  constructor(private http: HttpClient) {}

  createWritingAssignment(formData: FormData): Observable<any> {
    return this.http.post(`${this.api}`, formData, { withCredentials: true });
  }
    getAllWritingAssignments(): Observable<WritingAssignmentListItem[]> {
        return this.http.get<WritingAssignmentListItem[]>(`${this.api}`, {withCredentials: true});
    }
    getAllWritingAssignmentsDue(): Observable<WritingAssignmentListItem[]> {
        return this.http.get<WritingAssignmentListItem[]>(`${this.api}?isComplete=false`, {withCredentials: true});
    }
    getWritingAssignmentsByStudentId(id: number): Observable<WritingAssignmentListItem[]> {
        return this.http.get<WritingAssignmentListItem[]>(`${this.api}/${id}`, {withCredentials: true});
    }
    updateWritingAssignment(id: number, assignmentData: Partial<WritingAssignmentListItem>): Observable<any> {
        return this.http.put(`${this.api}/${id}`, assignmentData, {withCredentials: true});
    }
    deleteWritingAssignment(id: number): Observable<string> {
       
        return this.http.delete(this.api, {
          body: { id },
          responseType: 'text', 
          withCredentials: true
        });
      }
      
    getAtRiskStudents(minDemerits: number = 7): Observable<AtRiskStudentRow[]> {
      return this.http.get<AtRiskStudentRow[]>(
        `${this.api}/at-risk?minDemerits=${encodeURIComponent(minDemerits)}`,
        { withCredentials: true }
      );
    }
}
