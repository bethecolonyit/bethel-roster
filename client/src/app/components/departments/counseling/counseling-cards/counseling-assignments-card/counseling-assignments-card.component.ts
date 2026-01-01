import { Component, ChangeDetectorRef, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MatCardModule } from '@angular/material/card';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';

import { StudentService } from '../../../../../services/student.service';
import { Student } from '../../../../../models/student';

@Component({
  selector: 'app-counseling-assignments-card',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatMenuModule,
    MatIconModule,
    MatTooltipModule,
    MatButtonModule,
    MatProgressBarModule,
  ],
  templateUrl: './counseling-assignments-card.component.html',
  styleUrls: ['./counseling-assignments-card.component.scss'],
})
export class CounselingAssignmentsCardComponent implements OnInit {
  @Input() title = 'Counseling Assignments';
  @Input() subtitle = 'The following students need a counselor assigned';

  @Input() counselorOptions: string[] = [
    'Pastor Starnes',
    'Pastor Benfield',
    'Pastor Alphin',
    'Pastor Frye',
  ];

  studentsNeedingCounselor: Student[] = [];
  isLoading = false;

  // optional: prevents double-clicks on the same student row
  busyByStudentId: Record<number, boolean> = {};

  constructor(
    private studentService: StudentService,
    private snack: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.isLoading = true;
    this.cdr.detectChanges();

    this.studentService.getStudents().subscribe({
      next: (students) => {
        const list = (students || []).filter(s => !s.counselor);
        // sort optional, matches your “dashboard” feel
        this.studentsNeedingCounselor = list.sort((a, b) =>
          (a.firstName || '').localeCompare(b.firstName || '')
        );
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(err);
        this.snack.open('Error loading students', 'close', { duration: 3000 });
      },
      complete: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  assignCounselor(student: Student, counselor: string): void {
    const id = Number(student.id);
    if (!Number.isInteger(id)) {
      this.snack.open('Invalid student id', 'close', { duration: 3000 });
      return;
    }
    if (this.busyByStudentId[id]) return;

    const confirmed = window.confirm(
      `Are you sure you want to assign ${student.firstName} ${student.lastName} to ${counselor}?`
    );
    if (!confirmed) return;

    this.busyByStudentId[id] = true;
    this.cdr.detectChanges();

    const updated: Student = { ...student, counselor };

    this.studentService.updateStudent(id, updated).subscribe({
      next: () => {
        this.snack.open(
          `${student.firstName} ${student.lastName} has been assigned to ${counselor}`,
          'close',
          { duration: 3000 }
        );

        // Remove from local list immediately for UX
        this.studentsNeedingCounselor = this.studentsNeedingCounselor.filter(s => s.id !== id);
        this.cdr.detectChanges();

        // Optional: also refresh from server to stay authoritative
        this.refresh();
      },
      error: (err) => {
        console.error(err);
        const msg = err?.error?.error || 'Failed to assign counselor';
        this.snack.open(msg, 'close', { duration: 3500 });
      },
      complete: () => {
        this.busyByStudentId[id] = false;
        this.cdr.detectChanges();
      },
    });
  }
}
