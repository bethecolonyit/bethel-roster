import { Component, ChangeDetectorRef, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';

import { Student } from '../../../../../models/student';
import { StudentService } from '../../../../../services/student.service';
import { PastorService } from '../../../../../services/pastor.service';
import { Pastor } from '../../../../../models/pastor';

@Component({
  selector: 'app-counseling-assignments-card',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatTooltipModule,
    MatProgressBarModule
  ],
  templateUrl: './counseling-assignments-card.component.html',
  styleUrls: ['./counseling-assignments-card.component.scss'],
})
export class CounselingAssignmentsCardComponent {
  @Input() title = 'Counselor Assignments';
  @Input() subtitle = 'Assign counselors to students who are currently unassigned';

  isLoading = false;

  pastors: Pastor[] = [];
  studentsNeedingCounselor: Student[] = [];

  busyByStudentId: Record<number, boolean> = {};

  constructor(
    private studentService: StudentService,
    private pastorService: PastorService,
    private snack: MatSnackBar,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.refresh();
  }

  refresh() {
    this.isLoading = true;
    this.loadPastorsAndStudents();
  }

  private loadPastorsAndStudents() {
    this.pastorService.getPastors(true).subscribe({
      next: (pastors) => {
        this.pastors = pastors ?? [];
        this.loadStudents();
      },
      error: (err) => {
        console.error('Failed to load pastors', err);
        this.pastors = [];
        this.loadStudents(); // still load students, menu will be empty
      }
    });
  }

  private loadStudents() {
    this.studentService.getStudents().subscribe({
      next: (students) => {
        const rows = students ?? [];

        // "Needs counselor" if BOTH:
        // - no pastorId
        // - counselor string empty/null
        this.studentsNeedingCounselor = rows.filter(s => {
          const hasPastorId = !!(s.pastorId && Number(s.pastorId) > 0);
          const counselorText = (s.counselor ?? '').trim();
          return !hasPastorId && counselorText === '';
        });

        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load students', err);
        this.studentsNeedingCounselor = [];
        this.isLoading = false;
        this.snack.open('Failed to load students', 'Close', { duration: 3000 });
        this.cdr.detectChanges();
      }
    });
  }

  assignPastor(student: Student, pastorId: number) {
    if (!student?.id) return;

    const pastor = this.pastors.find(p => p.id === pastorId);
    const counselorName = pastor?.fullName ?? '';

    this.busyByStudentId[student.id] = true;

    this.studentService.updateStudent(student.id, {
      pastorId,
      counselor: counselorName, // keep legacy field in sync
    }).subscribe({
      next: () => {
        this.snack.open('Counselor assigned', 'Close', { duration: 2000 });

        // remove from list
        this.studentsNeedingCounselor = this.studentsNeedingCounselor.filter(s => s.id !== student.id);

        this.busyByStudentId[student.id!] = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Assign counselor failed', err);
        this.busyByStudentId[student.id!] = false;
        this.snack.open('Failed to assign counselor', 'Close', { duration: 3000 });
        this.cdr.detectChanges();
      }
    });
  }

  unassignCounselor(student: Student) {
    if (!student?.id) return;

    this.busyByStudentId[student.id] = true;

    this.studentService.updateStudent(student.id, {
      pastorId: null,
      counselor: '',
    }).subscribe({
      next: () => {
        this.snack.open('Counselor unassigned', 'Close', { duration: 2000 });

        // Still “needs counselor” → keep it in the list, but refresh row locally
        const idx = this.studentsNeedingCounselor.findIndex(s => s.id === student.id);
        if (idx >= 0) {
          this.studentsNeedingCounselor[idx] = { ...this.studentsNeedingCounselor[idx], pastorId: null, counselor: '' };
        }

        this.busyByStudentId[student.id!] = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Unassign counselor failed', err);
        this.busyByStudentId[student.id!] = false;
        this.snack.open('Failed to unassign counselor', 'Close', { duration: 3000 });
        this.cdr.detectChanges();
      }
    });
  }
}
