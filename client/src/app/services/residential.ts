import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';



export interface ResidentialStudent {
  id: number;
  firstName: string;
  lastName: string;
  studentId: string; // idNumber
}

export interface BedOccupancy {
  assignmentId: number;
  startDate: string; // ISO date
  student: ResidentialStudent | null;
}

export interface ResidentialBed {
  id: number;
  bedLetter: string;
  occupancy: BedOccupancy | null;
}

export interface ResidentialRoom {
  id: number;
  roomNumber: string;
  roomType: 'student' | 'staff' | 'vsp';
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  beds: ResidentialBed[];
}

export interface ResidentialBuilding {
  id: number;
  buildingName: string;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  rooms: ResidentialRoom[];
}

export interface StudentOption {
  id: number;
  firstName: string;
  lastName: string;
  idNumber: string;
}

@Injectable({
  providedIn: 'root',
})
export class ResidentialService {
  private http = inject(HttpClient);

  // Same base URL pattern as your AuthService
  private apiUrl = 'http://localhost:3000';

  /** Load full residential tree: buildings → rooms → beds + current occupancy */
  getStructure(): Observable<ResidentialBuilding[]> {
    return this.http.get<ResidentialBuilding[]>(
      `${this.apiUrl}/residential/structure`,
      { withCredentials: true }
    );
  }
   getStudents(): Observable<StudentOption[]> {
    return this.http.get<StudentOption[]>(`${this.apiUrl}/students/simple`, { withCredentials: true });
  }

  /** Assign a student to a bed */
  assignBed(bedId: number, studentId: number, startDate?: string) {
    const body: any = {
      bedId,
      studentId,
    };

    if (startDate) {
      body.startDate = startDate;
    }

    return this.http.post(
      `${this.apiUrl}/residential/bed-assignments`,
      body,
      { withCredentials: true } 
    );
  }
    /** Checkout (end) an active bed assignment */
  checkoutAssignment(assignmentId: number, endDate?: string) {
    const body: any = {};
    if (endDate) {
      body.endDate = endDate;
    }

    return this.http.post(
      `${this.apiUrl}/residential/bed-assignments/${assignmentId}/checkout`,
      body,
      { withCredentials: true }
    );
  }
  createBuilding(payload: { buildingName: string }): Observable<any> {
  // Adjust the URL to match your backend route
  return this.http.post<any>(
    `${this.apiUrl}/residential/buildings`,
    payload,  { withCredentials: true }
  );
}
createRoom(payload: {
  buildingId: number;
  roomNumber: string;
  roomType?: string | null;
}): Observable<any> {
  return this.http.post<any>(`${this.apiUrl}/residential/rooms`, payload, { withCredentials: true });
}
createBed(payload: {
  buildingId: number;
  roomId: number;
  bedLetter: string;
}): Observable<any> {
  return this.http.post<any>(`${this.apiUrl}/residential/beds`, payload, { withCredentials: true });
  }
  updateBed(
    id: number,
    payload: {
  buildingId: number;
  roomId: number;
  bedLetter: string;
}): Observable<any> {
  return this.http.put<any>(`${this.apiUrl}/residential/beds/${id}`, payload, { withCredentials: true });
  }
deleteBuilding(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/residential/buildings/${id}`, { withCredentials: true });
  }

  deleteRoom(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/residential/rooms/${id}`, { withCredentials: true });
  }

  deleteBed(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/residential/beds/${id}`, { withCredentials: true });
  }
  updateRoom(
  id: number,
  payload: { buildingId: number; roomNumber: string; roomType: string | null }
) {
  return this.http.put<any>(
    `${this.apiUrl}/residential/rooms/${id}`,
    payload,
    { withCredentials: true }
  );
  }
}