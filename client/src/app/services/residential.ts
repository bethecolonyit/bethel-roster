import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

/** Match the shape from GET /residential/structure */

export interface ResidentialStudent {
  id: number;
  firstName: string;
  lastName: string;
  studentId: string; // external student code from backend
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
      `${this.apiUrl}/residential/structure`
    );
  }
}
