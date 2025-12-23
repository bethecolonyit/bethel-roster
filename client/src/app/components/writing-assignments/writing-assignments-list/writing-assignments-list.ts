import { ChangeDetectorRef, Component } from '@angular/core';
import { WritingAssignmentService } from '../../../services/writing-assignment.service';
import { MatCardModule } from '@angular/material/card';
import { WritingAssignmentListItem } from '../../../models/WritingAssignmentListItem';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule, NgFor, DatePipe } from '@angular/common';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltip } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-writing-assignments-list',
  imports: [MatCardModule, CommonModule, NgFor, DatePipe, MatIconModule, MatMenuModule, MatTooltip],
  templateUrl: './writing-assignments-list.html',
  styleUrl: './writing-assignments-list.scss',
  standalone: true,
})
export class WritingAssignmentsList {
  public assignmentsDue: WritingAssignmentListItem[] = [];

  constructor(
    private service: WritingAssignmentService,
    private cdr: ChangeDetectorRef,
    private snack: MatSnackBar
  ) {
    this.loadWritingAssignmentsDue();
  }

  loadWritingAssignmentsDue() {
    this.service.getAllWritingAssignmentsDue().subscribe({
      next: (data) => {
        this.assignmentsDue = data;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(err);
      },
    });
  }

  /**
   * ✅ Convert whatever we receive (Date, 'YYYY-MM-DD', ISO string) into a Date at UTC midnight.
   * This prevents Angular DatePipe from shifting dates due to local timezone offsets.
   */
  toUtcDateOnly(value: any): Date | null {
    if (value == null || value === '') return null;

    // Already a Date object
    if (value instanceof Date) {
      if (!Number.isFinite(value.getTime())) return null;

      // Normalize to UTC date-only based on UTC components
      return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
    }

    // String cases
    if (typeof value === 'string') {
      const s = value.trim();
      if (!s) return null;

      // Date-only string (preferred)
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
      if (m) {
        const y = Number(m[1]);
        const mo = Number(m[2]) - 1;
        const d = Number(m[3]);
        return new Date(Date.UTC(y, mo, d));
      }

      // ISO / datetime string
      const dt = new Date(s);
      if (!Number.isFinite(dt.getTime())) return null;
      return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
    }

    // Fallback coercion
    const dt = new Date(value);
    if (!Number.isFinite(dt.getTime())) return null;
    return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
  }

  /** Format a UTC date-only Date as YYYY-MM-DD for your API. */
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

    this.service.updateWritingAssignment(assignment.id!, assignment).subscribe({
      next: () => {
        this.snack.open('Assignment Due Date Extended by 1 Day', 'Close', { duration: 3000 });
        this.loadWritingAssignmentsDue();
      },
      error: (err) => {
        console.error(err);
        this.snack.open('An Error Occurred', 'Close', { duration: 3000 });
      },
    });
  }

  onMarkAssignmentComplete(assignment: WritingAssignmentListItem) {
    const confirmed = window.confirm('Are you sure you would like to mark this assignment as complete?');
    if (!confirmed) return;

    assignment.isComplete = true;

    this.service.updateWritingAssignment(assignment.id!, assignment).subscribe({
      next: () => {
        this.snack.open('Assigment Marked Complete', 'close', { duration: 3000 });
        this.loadWritingAssignmentsDue();
      },
      error: (err) => {
        console.error(err);
        this.snack.open('An Error Occurred', 'Close', { duration: 3000 });
      },
    });
  }

  emptyFunction() {}
}
