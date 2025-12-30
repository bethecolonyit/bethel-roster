import { Component, OnInit, ChangeDetectorRef, ViewChild } from '@angular/core';
import { FormBuilder, Validators, FormGroup, FormControl, ReactiveFormsModule, FormGroupDirective } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';

import {
  TimeOffService,
  LeaveType,
  LeaveBalanceRow,
  TimeOffRequestListItem,
  CreateTimeOffRequestDto
} from '../../../services/time-off.service';

type RequestForm = FormGroup<{
  leaveTypeCode: FormControl<string>;
  startDate: FormControl<Date | null>;
  endDate: FormControl<Date | null>;
  requestedHours: FormControl<number>;
  notes: FormControl<string | null>;
}>;

@Component({
  selector: 'app-staff-time-off',
  templateUrl: './staff-time-off.html',
  styleUrls: ['./staff-time-off.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
  ]
})
export class StaffTimeOffComponent implements OnInit {
  @ViewChild(FormGroupDirective) private formDirective!: FormGroupDirective;

  leaveTypes: LeaveType[] = [];
  balances: LeaveBalanceRow[] = [];
  requests: TimeOffRequestListItem[] = [];

  loading = false;
  submitting = false;

  form: RequestForm;

  constructor(
    private fb: FormBuilder,
    private timeOff: TimeOffService,
    private cdr: ChangeDetectorRef,
    private snack: MatSnackBar
  ) {
    this.form = this.fb.group({
      leaveTypeCode: this.fb.nonNullable.control('', Validators.required),
      startDate: this.fb.control<Date | null>(null, Validators.required),
      endDate: this.fb.control<Date | null>(null, Validators.required),
      requestedHours: this.fb.nonNullable.control(8, [
        Validators.required,
        Validators.min(0.25),
      ]),
      notes: this.fb.control<string | null>(null),
    });
  }

  ngOnInit(): void {
    this.reloadAll();
  }

  reloadAll(): void {
    this.loading = true;

    this.timeOff.getLeaveTypes().subscribe({
      next: (types) => (this.leaveTypes = types ?? []),
    });

    this.timeOff.getMyBalances().subscribe({
      next: (rows) => (this.balances = rows ?? []),
    });

    this.timeOff.getMyRequests().subscribe({
      next: (rows) => {
        this.requests = rows ?? [];
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.snack.open('Failed to load time off data', 'close', { duration: 3500 });
      },
    });
  }

  getCurrentHours(code: string): number {
    const row = this.balances.find(
      (b) => b.code.toUpperCase() === code.toUpperCase()
    );
    return row ? Number(row.currentHours ?? 0) : 0;
  }

  submitRequest(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    if (!v.startDate || !v.endDate) return;

    const startYmd = this.toLocalYmd(v.startDate);
    const endYmd = this.toLocalYmd(v.endDate);

    const dto: CreateTimeOffRequestDto = {
      leaveTypeCode: v.leaveTypeCode,
      startDateTime: `${startYmd}T00:00:00`,
      endDateTime: `${endYmd}T23:59:59`,
      requestedHours: Number(v.requestedHours),
      notes: v.notes ?? null,
    };

    this.submitting = true;
    this.cdr.markForCheck();

    this.timeOff.createMyRequest(dto).subscribe({
      next: () => {
        this.submitting = false;
        this.snack.open('Time off request submitted', 'close', { duration: 3000 });

        // Preserve leave type + hours
        const keepLeaveType = this.form.controls.leaveTypeCode.value;
        const keepHours = this.form.controls.requestedHours.value;

        // 🔑 THIS IS THE FIX
        this.formDirective.resetForm({
          leaveTypeCode: keepLeaveType,
          startDate: null,
          endDate: null,
          requestedHours: keepHours,
          notes: null,
        });

        this.reloadAll();
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error(err);
        this.submitting = false;
        this.snack.open(
          err?.error?.error || 'Failed to submit request',
          'close',
          { duration: 4000 }
        );
      },
    });
  }

  cancelPending(r: TimeOffRequestListItem): void {
    if (r.status !== 'Pending') return;

    if (!window.confirm('Cancel this pending request?')) return;

    this.timeOff.cancelMyPendingRequest(r.id).subscribe({
      next: () => {
        this.snack.open('Request cancelled', 'close', { duration: 3000 });
        this.reloadAll();
      },
    });
  }

  private toLocalYmd(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}