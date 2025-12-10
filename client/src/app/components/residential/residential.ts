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
import { MatSelectModule } from '@angular/material/select';
import {
  ReactiveFormsModule,
  FormControl,
  FormGroup,
  Validators,
} from '@angular/forms';

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
    MatSelectModule,
  ],
  templateUrl: './residential.html',
  styleUrl: './residential.scss',
})
export class Residential implements OnInit {
  private residentialService = inject(ResidentialService);
  private cdr = inject(ChangeDetectorRef);

  // -------------------------
  // MAIN DATA
  // -------------------------
  buildings: ResidentialBuilding[] = [];
  loading = false;
  error: string | null = null;

  // -------------------------
  // ACCORDION EXPANSION STATE
  // -------------------------
  private expandedBuildingIds = new Set<number>();
  private expandedRoomIds = new Set<number>();

  isBuildingExpanded(id: number): boolean {
    return this.expandedBuildingIds.has(id);
  }

  onBuildingOpened(id: number): void {
    this.expandedBuildingIds.add(id);
  }

  onBuildingClosed(id: number): void {
    this.expandedBuildingIds.delete(id);
  }

  isRoomExpanded(id: number): boolean {
    return this.expandedRoomIds.has(id);
  }

  onRoomOpened(id: number): void {
    this.expandedRoomIds.add(id);
  }

  onRoomClosed(id: number): void {
    this.expandedRoomIds.delete(id);
  }

  // -------------------------
  // CREATE BUILDING
  // -------------------------
  showCreateBuilding = false;
  createBuildingLoading = false;
  createBuildingError: string | null = null;

  createBuildingForm = new FormGroup({
    buildingName: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
  });

  // -------------------------
  // STUDENT ASSIGN PANEL
  // -------------------------
  assigningContext:
    | {
        building: ResidentialBuilding;
        room: any;
        bed: any;
        bedId: number;
      }
    | null = null;

  students: StudentOption[] = [];
  filteredStudents: StudentOption[] = [];
  studentsLoading = false;
  studentsLoaded = false;

  studentSearchControl = new FormControl<string>('');
  selectedStudent: StudentOption | null = null;

  // -------------------------
  // ROOM FORM (create/edit)
  // -------------------------
  roomFormMode: 'create' | 'edit' = 'create';
  roomFormBuildingId: number | null = null;
  roomFormRoomId: number | null = null;
  roomFormLoading = false;
  roomFormError: string | null = null;

  roomForm = new FormGroup({
    roomNumber: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(10)],
    }),
    roomType: new FormControl<'student' | 'staff' | 'vsp'>('student', {
      nonNullable: true,
    }),
  });

  // -------------------------
  // BED FORM (create/edit)
  // -------------------------
  bedFormMode: 'create' | 'edit' = 'create';
  bedFormRoomId: number | null = null;
  editingBed: any | null = null;

  bedFormLoading = false;
  bedFormError: string | null = null;

  bedForm = new FormGroup({
    bedLetter: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(2)],
    }),
  });

  // -------------------------
  // LIFECYCLE
  // -------------------------
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
    console.log('Loading residential structure.');

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
        const label = `${s.lastName}, ${s.firstName}`.toLowerCase();
        return label.includes(term);
      });
      this.cdr.detectChanges();
    });
  }

  onStudentSelected(student: StudentOption): void {
    this.selectedStudent = student;

    const label = `${student.lastName}, ${student.firstName} (${student.id})`;
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
      return;
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

    const studentLabel = `${student.firstName} ${student.lastName}`;
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
        console.log('assignBed response:', res);

        const assignmentId =
          res?.id ??
          res?.assignmentId ??
          res?.assignment?.id ??
          null;

        const start =
          res?.start_date ??
          res?.startDate ??
          res?.assignmentStartDate ??
          new Date().toISOString().slice(0, 10);

        bed.occupancy = {
          assignmentId,
          startDate: start,
          student: {
            id: student.id,
            firstName: student.firstName,
            lastName: student.lastName,
          },
        };

        if (
          typeof room.occupiedBeds === 'number' &&
          typeof room.totalBeds === 'number'
        ) {
          room.occupiedBeds = room.occupiedBeds + 1;
          room.availableBeds = room.totalBeds - room.occupiedBeds;
        }

        if (
          typeof building.occupiedBeds === 'number' &&
          typeof building.totalBeds === 'number'
        ) {
          building.occupiedBeds = building.occupiedBeds + 1;
          building.availableBeds =
            building.totalBeds - building.occupiedBeds;
        }

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

  // -------------------------
  // BUILDING HANDLERS
  // -------------------------
  toggleCreateBuilding(): void {
    this.showCreateBuilding = !this.showCreateBuilding;

    if (this.showCreateBuilding) {
      this.createBuildingForm.reset({ buildingName: '' });
      this.createBuildingError = null;
    }
  }

  cancelCreateBuilding(): void {
    this.showCreateBuilding = false;
    this.createBuildingError = null;
  }

  onCreateBuildingSubmit(): void {
    if (this.createBuildingForm.invalid || this.createBuildingLoading) {
      this.createBuildingForm.markAllAsTouched();
      return;
    }

    const rawName =
      this.createBuildingForm.controls.buildingName.value ?? '';
    const buildingName = rawName.trim();

    if (!buildingName) {
      this.createBuildingForm.controls.buildingName.setErrors({
        required: true,
      });
      this.createBuildingForm.controls.buildingName.markAsTouched();
      return;
    }

    this.createBuildingLoading = true;
    this.createBuildingError = null;

    this.residentialService.createBuilding({ buildingName }).subscribe({
      next: () => {
        this.createBuildingLoading = false;
        this.showCreateBuilding = false;
        this.loadStructure();
      },
      error: (err) => {
        console.error('Error creating building', err);
        this.createBuildingLoading = false;
        this.createBuildingError =
          'Failed to create building. Please try again.';
      },
    });
  }

  onDeleteBuilding(building: any): void {
    if (!building || !building.id) {
      return;
    }

    if (building.occupiedBeds > 0) {
      alert('You cannot delete a building that has occupied beds.');
      return;
    }

    const confirmed = window.confirm(
      `Delete building "${building.buildingName}" and all its rooms and beds?`
    );
    if (!confirmed) return;

    // Remove from expanded set so we do not track a deleted building
    this.expandedBuildingIds.delete(building.id);

    this.residentialService.deleteBuilding(building.id).subscribe({
      next: () => {
        this.loadStructure();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error deleting building', err);
        alert('Failed to delete building. Please try again.');
        this.cdr.detectChanges();
      },
    });
  }

  // -------------------------
  // ROOM HANDLERS
  // -------------------------
  openCreateRoom(building: any, event?: MouseEvent): void {
    event?.stopPropagation();

    this.roomFormMode = 'create';
    this.roomFormBuildingId = building.id;
    this.roomFormRoomId = null;
    this.roomFormError = null;

    this.roomForm.reset({
      roomNumber: '',
      roomType: 'student',
    });
  }

  openEditRoom(building: any, room: any): void {
    this.roomFormMode = 'edit';
    this.roomFormBuildingId = building.id;
    this.roomFormRoomId = room.id;
    this.roomFormError = null;

    this.roomForm.setValue({
      roomNumber: String(room.roomNumber ?? ''),
      roomType: (room.roomType ?? 'student') as 'student' | 'staff' | 'vsp',
    });
  }

  cancelRoomForm(): void {
    this.roomFormBuildingId = null;
    this.roomFormRoomId = null;
    this.roomFormMode = 'create';
    this.roomFormLoading = false;
    this.roomFormError = null;
  }

  onSubmitRoomForm(): void {
    if (!this.roomFormBuildingId || this.roomForm.invalid) {
      this.roomForm.markAllAsTouched();
      return;
    }

    const roomNumber =
      (this.roomForm.controls.roomNumber.value || '').trim();
    const roomType =
      this.roomForm.controls.roomType.value || 'student';

    if (!roomNumber) {
      this.roomForm.controls.roomNumber.setErrors({ required: true });
      this.roomForm.controls.roomNumber.markAsTouched();
      return;
    }

    this.roomFormLoading = true;
    this.roomFormError = null;

    const buildingId = this.roomFormBuildingId;

    if (this.roomFormMode === 'create') {
      this.residentialService
        .createRoom({
          buildingId,
          roomNumber,
          roomType,
        })
        .subscribe({
          next: () => {
            this.roomFormLoading = false;
            this.cancelRoomForm();
            this.loadStructure();
          },
          error: (err) => {
            console.error('Error creating room', err);
            this.roomFormLoading = false;
            this.roomFormError =
              'Failed to create room. Please try again.';
          },
        });
    } else {
      if (!this.roomFormRoomId) {
        this.roomFormLoading = false;
        return;
      }

      this.residentialService
        .updateRoom(this.roomFormRoomId, {
          buildingId,
          roomNumber,
          roomType,
        })
        .subscribe({
          next: () => {
            this.roomFormLoading = false;
            this.cancelRoomForm();
            this.loadStructure();
          },
          error: (err) => {
            console.error('Error updating room', err);
            this.roomFormLoading = false;
            this.roomFormError =
              'Failed to update room. Please try again.';
          },
        });
    }
  }

  onDeleteRoom(building: any, room: any): void {
    if (!room || !room.id) {
      return;
    }

    if (room.occupiedBeds > 0) {
      alert('You cannot delete a room that has occupied beds.');
      return;
    }

    const confirmed = window.confirm(
      `Delete Room ${room.roomNumber} in ${building.buildingName} and all its beds?`
    );
    if (!confirmed) return;

    // Remove from expanded room set
    this.expandedRoomIds.delete(room.id);

    this.residentialService.deleteRoom(room.id).subscribe({
      next: () => {
        this.loadStructure();
      },
      error: (err) => {
        console.error('Error deleting room', err);
        alert('Failed to delete room. Please try again.');
      },
    });
  }

  // -------------------------
  // BED HANDLERS
  // -------------------------
  openCreateBed(room: any, event?: MouseEvent): void {
    event?.stopPropagation();

    this.bedFormMode = 'create';
    this.editingBed = null;
    this.bedFormRoomId = room.id;
    this.bedFormError = null;

    this.bedForm.reset({
      bedLetter: '',
    });
  }

  openEditBed(room: any, bed: any, event?: MouseEvent): void {
    event?.stopPropagation();

    this.bedFormMode = 'edit';
    this.editingBed = bed;
    this.bedFormRoomId = room.id;
    this.bedFormError = null;

    this.bedForm.reset({
      bedLetter: String(bed.bedLetter ?? ''),
    });
  }

  cancelBedForm(): void {
    this.bedFormRoomId = null;
    this.editingBed = null;
    this.bedFormMode = 'create';
    this.bedFormLoading = false;
    this.bedFormError = null;
    this.bedForm.reset({
      bedLetter: '',
    });
  }

  onSubmitBedForm(building: any, room: any): void {
    if (!this.bedFormRoomId || this.bedForm.invalid) {
      this.bedForm.markAllAsTouched();
      return;
    }

    const rawLetter = this.bedForm.controls.bedLetter.value ?? '';
    const bedLetter = rawLetter.trim().toUpperCase();

    if (!bedLetter) {
      this.bedForm.controls.bedLetter.setErrors({ required: true });
      this.bedForm.controls.bedLetter.markAsTouched();
      return;
    }

    this.bedFormLoading = true;
    this.bedFormError = null;

    if (this.bedFormMode === 'create') {
      this.residentialService
        .createBed({
          buildingId: building.id,
          roomId: room.id,
          bedLetter,
        })
        .subscribe({
          next: () => {
            this.bedFormLoading = false;
            this.cancelBedForm();
            this.loadStructure();
          },
          error: (err) => {
            console.error('Error creating bed', err);
            this.bedFormLoading = false;
            this.bedFormError = 'Failed to create bed. Please try again.';
          },
        });
    } else {
      if (!this.editingBed || !this.editingBed.id) {
        this.bedFormLoading = false;
        return;
      }

      this.residentialService
        .updateBed(this.editingBed.id, {
          buildingId: building.id,
          roomId: room.id,
          bedLetter,
        })
        .subscribe({
          next: () => {
            this.bedFormLoading = false;
            this.cancelBedForm();
            this.loadStructure();
          },
          error: (err) => {
            console.error('Error updating bed', err);
            this.bedFormLoading = false;
            this.bedFormError =
              'Failed to update bed. Please try again.';
          },
        });
    }
  }

  onDeleteBed(
    building: any,
    room: any,
    bed: any,
    event?: MouseEvent
  ): void {
    event?.stopPropagation();

    if (!bed || !bed.id) {
      return;
    }

    if (bed.occupancy) {
      alert('You cannot delete a bed that is currently occupied.');
      return;
    }

    const confirmed = window.confirm(
      `Delete Bed ${bed.bedLetter} in Room ${room.roomNumber} (${building.buildingName})?`
    );
    if (!confirmed) return;

    this.residentialService.deleteBed(bed.id).subscribe({
      next: () => {
        this.loadStructure();
      },
      error: (err) => {
        console.error('Error deleting bed', err);
        alert('Failed to delete bed. Please try again.');
      },
    });
  }
}
