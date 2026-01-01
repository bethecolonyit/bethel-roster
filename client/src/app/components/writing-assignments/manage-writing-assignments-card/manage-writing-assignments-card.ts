import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, NgFor, NgIf } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';

import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { WritingAssignmentService, AtRiskStudentRow } from '../../../services/writing-assignment.service';
import { WritingAssignmentListItem } from '../../../models/WritingAssignmentListItem';

// IMPORTANT: adjust this import path to your actual Students service/model location.
import { StudentService } from '../../../services/student.service';
type StudentSimple = { id: number; firstName: string; lastName: string };


@Component({
  selector: 'app-manage-writing-assignments-card',
  standalone: true,
  templateUrl: './manage-writing-assignments-card.html',
  styleUrls: ['./manage-writing-assignments-card.scss'],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NgIf,
    NgFor,
    MatCardModule,
    MatTabsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressBarModule,
  ],
})
export class ManageWritingAssignmentsCardComponent implements OnInit {
  selectedTabIndex = 0;

  // Tab 1: Incomplete assignments
  assignmentsDue: WritingAssignmentListItem[] = [];
  isLoadingDue = false;

  // Tab 2: By student
  students: StudentSimple[] = [];

  isLoadingStudents = false;
  selectedStudentId = new FormControl<number | null>(null);
  studentAssignments: WritingAssignmentListItem[] = [];
  isLoadingStudentAssignments = false;

  // Tab 3: At-risk
  atRiskStudents: AtRiskStudentRow[] = [];
  isLoadingAtRisk = false;
  minDemeritsAtRisk = 7;

  // Per-row busy state for assignment actions
  assignmentBusy: Record<number, boolean> = {};

  constructor(
    private wa: WritingAssignmentService,
    private studentsSvc: StudentService,
    private snack: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadDueAssignments();
    this.loadStudents();
    this.loadAtRiskStudents(this.minDemeritsAtRisk);

   this.selectedStudentId.valueChanges.subscribe((id) => {
  this.deferCD(() => {
    this.studentAssignments = [];
    if (id) this.loadAssignmentsForStudent(id);
  });
});
}

  // -----------------------------
  // Helpers
  // -----------------------------
  studentName(s: StudentSimple): string {
    return `${s.firstName} ${s.lastName}`;
  }

  private deferCD(fn: () => void): void {
  queueMicrotask(() => {
    fn();
    this.cdr.detectChanges();
  });
}

  // Keep your existing “date-only, timezone-proof” display pattern
  toUtcDateOnly(v: any): Date | null {
    if (!v) return null;

    if (v instanceof Date) {
      if (!Number.isFinite(v.getTime())) return null;
      return new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate()));
    }

    if (typeof v === 'string') {
      const s = v.trim();
      // YYYY-MM-DD
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
      if (m) {
        const y = Number(m[1]);
        const mo = Number(m[2]) - 1;
        const d = Number(m[3]);
        return new Date(Date.UTC(y, mo, d));
      }
      const d = new Date(s);
      if (!Number.isFinite(d.getTime())) return null;
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    }

    const d = new Date(v);
    if (!Number.isFinite(d.getTime())) return null;
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }

  // -----------------------------
  // Tab 1: Incomplete
  // -----------------------------
 loadDueAssignments(): void {
  this.deferCD(() => (this.isLoadingDue = true));

  this.wa.getAllWritingAssignmentsDue().subscribe({
    next: (rows) => {
      this.assignmentsDue = (rows || []).slice();
      this.cdr.markForCheck();
    },
    error: (err) => {
      console.error(err);
      this.snack.open('Failed to load incomplete writing assignments', 'close', { duration: 3000 });
      this.cdr.markForCheck();
    },
    complete: () => {
      this.deferCD(() => (this.isLoadingDue = false));
    },
  });
}

  onMarkAssignmentComplete(a: WritingAssignmentListItem): void {
    if (!a?.id || this.assignmentBusy[a.id]) return;

    const ok = window.confirm('Mark this writing assignment as complete?');
    if (!ok) return;

    this.assignmentBusy[a.id] = true;
    this.cdr.detectChanges();

    this.wa.updateWritingAssignment(a.id, { isComplete: true }).subscribe({
      next: () => {
        this.snack.open('Marked complete', 'close', { duration: 2000 });
        // Remove immediately from the incomplete list
        this.assignmentsDue = this.assignmentsDue.filter(x => x.id !== a.id);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(err);
        this.snack.open('Failed to mark complete', 'close', { duration: 3000 });
      },
      complete: () => {
        this.assignmentBusy[a.id] = false;
        this.cdr.detectChanges();
      },
    });
  }

/**
   * ✅ Convert whatever we receive (Date, 'YYYY-MM-DD', ISO string) into a Date at UTC midnight.
   * This prevents Angular DatePipe from shifting dates due to local timezone offsets.
   */
   private formatUtcDateOnly(d: Date): string {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  onExtendDueDate(assignment: WritingAssignmentListItem) {
    const confirmed = window.confirm('Are you sure you would like to extend this assignment by 1 day?');
    if (!confirmed) return;

    const dueUtc = this.toUtcDateOnly(assignment.dateDue);
    if (!dueUtc) {
      this.snack.open('Cannot extend: invalid due date', 'Close', { duration: 3000 });
      return;
    }

    // ✅ Add one *calendar* day in UTC (DST-safe)
    dueUtc.setUTCDate(dueUtc.getUTCDate() + 1);

    // ✅ Send back as date-only string to match backend CAST(@dateDue AS date)
    assignment.dateDue = this.formatUtcDateOnly(dueUtc) as any;

    this.wa.updateWritingAssignment(assignment.id!, assignment).subscribe({
      next: () => {
        this.snack.open('Assignment Due Date Extended by 1 Day', 'Close', { duration: 3000 });
        this.loadDueAssignments();
      },
      error: (err) => {
        console.error(err);
        this.snack.open('An Error Occurred', 'Close', { duration: 3000 });
      },
    });
  }

  // -----------------------------
  // Tab 2: By Student
  // -----------------------------
 loadStudents(): void {
  this.deferCD(() => (this.isLoadingStudents = true));

  this.studentsSvc.getStudentsSimple().subscribe({
    next: (rows) => {
      this.students = (rows || []).slice().sort((a, b) => a.firstName.localeCompare(b.firstName));
      this.cdr.markForCheck();
    },
    error: (err) => {
      console.error(err);
      this.snack.open('Failed to load students', 'close', { duration: 3000 });
      this.cdr.markForCheck();
    },
    complete: () => {
      this.deferCD(() => (this.isLoadingStudents = false));
    },
  });
}


 loadAssignmentsForStudent(studentId: number): void {
  this.deferCD(() => (this.isLoadingStudentAssignments = true));

  this.wa.getWritingAssignmentsByStudentId(studentId).subscribe({
    next: (rows) => {
      this.studentAssignments = (rows || []).slice();
      this.cdr.markForCheck();
    },
    error: (err) => {
      console.error(err);
      this.snack.open('Failed to load student writing assignments', 'close', { duration: 3000 });
      this.cdr.markForCheck();
    },
    complete: () => {
      this.deferCD(() => (this.isLoadingStudentAssignments = false));
    },
  });
}

  onRemoveDemerits(a: WritingAssignmentListItem): void {
    if (!a?.id || this.assignmentBusy[a.id]) return;

    const ok = window.confirm('Remove demerits for this assignment (set to 0)?');
    if (!ok) return;

    this.assignmentBusy[a.id] = true;
    this.cdr.detectChanges();

    this.wa.updateWritingAssignment(a.id, { demerits: 0 }).subscribe({
      next: () => {
        this.snack.open('Demerits removed', 'close', { duration: 2000 });

        // Update locally for immediate feedback
        this.studentAssignments = this.studentAssignments.map(x =>
          x.id === a.id ? { ...x, demerits: 0 } : x
        );

        // Refresh at-risk list since totals may change
        this.loadAtRiskStudents(this.minDemeritsAtRisk);

        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(err);
        this.snack.open('Failed to remove demerits', 'close', { duration: 3000 });
      },
      complete: () => {
        this.assignmentBusy[a.id] = false;
        this.cdr.detectChanges();
      },
    });
  }

  // -----------------------------
  // Tab 3: At Risk
  // -----------------------------
 loadAtRiskStudents(minDemerits: number = 7): void {
  this.deferCD(() => (this.isLoadingAtRisk = true));

  this.wa.getAtRiskStudents(minDemerits).subscribe({
    next: (rows) => {
      this.atRiskStudents = (rows || []).slice();
      this.cdr.markForCheck();
    },
    error: (err) => {
      console.error(err);
      this.snack.open('Failed to load at-risk students', 'close', { duration: 3000 });
      this.cdr.markForCheck();
    },
    complete: () => {
      this.deferCD(() => (this.isLoadingAtRisk = false));
    },
  });
}

 refreshCurrentTab(): void {
  if (this.selectedTabIndex === 0 && this.isLoadingDue) return;
  if (this.selectedTabIndex === 1 && this.isLoadingStudentAssignments) return;
  if (this.selectedTabIndex === 2 && this.isLoadingAtRisk) return;

  this.deferCD(() => {
    if (this.selectedTabIndex === 0) this.loadDueAssignments();
    if (this.selectedTabIndex === 1) {
      const sid = this.selectedStudentId.value;
      if (sid) this.loadAssignmentsForStudent(sid);
    }
    if (this.selectedTabIndex === 2) this.loadAtRiskStudents(this.minDemeritsAtRisk);
  });
}
}
