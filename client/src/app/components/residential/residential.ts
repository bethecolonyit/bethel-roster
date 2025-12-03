import {
  Component,
  OnInit,
  inject,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatListModule } from '@angular/material/list';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ReactiveFormsModule, FormControl } from '@angular/forms';

import {
  ResidentialService,
  ResidentialBuilding,
  StudentOption,
} from '../../services/residential';

@Component({
  selector: 'app-residential',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatExpansionModule,
    MatListModule,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    MatTooltipModule,
    ReactiveFormsModule,
  ],
  templateUrl: './residential.html',
  styleUrl: './residential.scss',
})
export class Residential implements OnInit {
  private residentialService = inject(ResidentialService);
  private cdr = inject(ChangeDetectorRef);

  // main data
  buildings: ResidentialBuilding[] = [];
  loading = false;
  error: string | null = null;

  // assign panel state
  assigningContext:
    | {
        building: ResidentialBuilding;
        room: any;
        bed: any;
        bedId: number;
      }
    | null = null;

  // students for dropdown
  students: StudentOption[] = [];
  filteredStudents: StudentOption[] = [];
  studentsLoading = false;
  studentsLoaded = false;

  studentSearchControl = new FormControl<string>('');
  selectedStudent: StudentOption | null = null;

  ngOnInit(): void {
    this.loadStructure();
  }

  // -------------------------
  // LOAD RESIDENTIAL STRUCTURE
  // -------------------------
  loadStructure(): void {
    this.loading = true;
    this.error = null;
    this.cdr.detectChanges();

    this.residentialService.getStructure().subscribe({
      next: (buildings) => {
        this.buildings = buildings;
        this.loading = false;
        this.error = null;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load residential structure', err);
        this.error = 'Failed to load residential structure.';
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  // -------------------------
  // STUDENT LIST / FILTER
  // -------------------------
  private loadStudentsIfNeeded(): void {
    if (this.studentsLoaded || this.studentsLoading) {
      return;
    }

    this.studentsLoading = true;
    this.cdr.detectChanges();

    this.residentialService.getStudents().subscribe({
      next: (students) => {
        this.students = students;
        this.studentsLoaded = true;
        this.studentsLoading = false;
        this.setupStudentFilter();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load students list', err);
        this.error = 'Failed to load students list.';
        this.studentsLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  private setupStudentFilter(): void {
    this.filteredStudents = this.students.slice();

    this.studentSearchControl.valueChanges.subscribe((value) => {
      const term = (value || '').toLowerCase();
      this.filteredStudents = this.students.filter((s: StudentOption) => {
        const label = `${s.lastName}, ${s.firstName} (${s.idNumber})`.toLowerCase();
        return label.includes(term);
      });
      this.cdr.detectChanges();
    });
  }

  // Called when a student is picked from autocomplete
  onStudentSelected(student: StudentOption): void {
    this.selectedStudent = student;

    const label = `${student.lastName}, ${student.firstName} (${student.idNumber})`;
    // Show a nice label in the input, but don't re-trigger filtering
    this.studentSearchControl.setValue(label, { emitEvent: false });
  }

  // -------------------------
  // ASSIGN FLOW
  // -------------------------
  onAssignClick(
    building: ResidentialBuilding,
    room: any,
    bed: any,
    event: MouseEvent
  ): void {
    event.stopPropagation();
    console.log('Assign icon clicked for bed', bed.id, bed.bedLetter);
    if (bed.occupancy) {
      return; // should not happen, but guard
    }
    this.assigningContext = { building, room, bed, bedId: bed.id };
    this.selectedStudent = null;
    this.studentSearchControl.setValue('');
    this.loadStudentsIfNeeded();
    this.cdr.detectChanges();
  }

  cancelAssign(): void {
    this.assigningContext = null;
    this.selectedStudent = null;
    this.studentSearchControl.setValue('');
    this.cdr.detectChanges();
  }

  confirmAssign(): void {
    if (!this.assigningContext || !this.selectedStudent) {
      return;
    }

    const { building, room, bed } = this.assigningContext;
    const student = this.selectedStudent;

    const studentLabel = `${student.lastName}, ${student.firstName} (${student.idNumber})`;
    const roomNumber = room.roomNumber;
    const bedLetter = bed.bedLetter;

    const msg = `Are you sure you want to assign ${studentLabel} to Room ${roomNumber}, Bed ${bedLetter}?`;
    const confirmed = window.confirm(msg);
    if (!confirmed) {
      return;
    }

    this.assignStudentToBed(student, building, room, bed);
  }

   private assignStudentToBed(
    student: StudentOption,
    building: ResidentialBuilding,
    room: any,
    bed: any
  ): void {
    this.error = null;
    this.cdr.detectChanges();

    this.residentialService.assignBed(bed.id, student.id).subscribe({
      next: (res: any) => {
        // Log what we actually got back from the backend
        console.log('assignBed response:', res);

        // Try to pull an assignment ID from a variety of possible shapes
        const assignmentId =
          res?.id ??
          res?.assignmentId ??
          res?.assignment?.id ??
          null;

        // Try to pull a start date; fall back to today if not provided
        const start =
          res?.start_date ??
          res?.startDate ??
          res?.assignmentStartDate ??
          new Date().toISOString().slice(0, 10);

        // ✅ Mark the bed as occupied using the student we already have
        bed.occupancy = {
          assignmentId,        // may be null if backend didn't send it
          startDate: start,
          student: {
            id: student.id,
            firstName: student.firstName,
            lastName: student.lastName,
          },
        };

        // Update room counts
        if (
          typeof room.occupiedBeds === 'number' &&
          typeof room.totalBeds === 'number'
        ) {
          room.occupiedBeds = room.occupiedBeds + 1;
          room.availableBeds = room.totalBeds - room.occupiedBeds;
        }

        // Update building counts
        if (
          typeof building.occupiedBeds === 'number' &&
          typeof building.totalBeds === 'number'
        ) {
          building.occupiedBeds = building.occupiedBeds + 1;
          building.availableBeds =
            building.totalBeds - building.occupiedBeds;
        }

        // Close inline panel & clear selection
        this.assigningContext = null;
        this.selectedStudent = null;
        this.studentSearchControl.setValue('');
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to assign student to bed', err);
        this.error = 'Failed to assign student to bed.';
        this.cdr.detectChanges();
      },
    });
  }

  // -------------------------
  // CHECKOUT FLOW
  // -------------------------
  onCheckoutClick(
    building: ResidentialBuilding,
    room: any,
    bed: any,
    event: MouseEvent
  ): void {
    event.stopPropagation();

    const occupancy = bed.occupancy;
    if (!occupancy || !occupancy.student) {
      return;
    }

    const student = occupancy.student;
    const studentName = `${student.firstName} ${student.lastName}`.trim();
    const roomNumber = room.roomNumber;
    const bedLetter = bed.bedLetter;

    const message = `Are you sure you would like to check ${studentName} out of Room ${roomNumber}, Bed ${bedLetter}?`;

    const confirmed = window.confirm(message);
    if (!confirmed) {
      return;
    }

    this.checkoutBed(occupancy.assignmentId, building, room, bed);
  }

  private checkoutBed(
    assignmentId: number,
    building: ResidentialBuilding,
    room: any,
    bed: any
  ): void {
    this.error = null;
    this.cdr.detectChanges();

    this.residentialService.checkoutAssignment(assignmentId).subscribe({
      next: () => {
        // update local state
        if (bed.occupancy) {
          bed.occupancy = null;

          if (
            typeof room.occupiedBeds === 'number' &&
            typeof room.totalBeds === 'number'
          ) {
            room.occupiedBeds = Math.max(0, room.occupiedBeds - 1);
            room.availableBeds = room.totalBeds - room.occupiedBeds;
          }

          if (
            typeof building.occupiedBeds === 'number' &&
            typeof building.totalBeds === 'number'
          ) {
            building.occupiedBeds = Math.max(
              0,
              building.occupiedBeds - 1
            );
            building.availableBeds =
              building.totalBeds - building.occupiedBeds;
          }
        }

        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to checkout bed assignment', err);
        this.error = 'Failed to checkout bed assignment.';
        this.cdr.detectChanges();
      },
    });
  }
}
