// src/app/pages/hr-dashboard/hr-dashboard.ts
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule, NgIf, NgFor } from '@angular/common';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import {
  TimeOffService,
  EmployeeListItem,
  LeaveBalanceRow,
  LeaveType,
  TimeOffRequestListItem,
  TimeOffStatus,
  LedgerSource
} from '../../../../services/time-off.service';
import { MatTabsModule } from '@angular/material/tabs';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

type BalanceFormGroup = FormGroup<Record<string, FormControl<number | null>>>;

@Component({
  selector: 'app-hr-dashboard',
  templateUrl: './hr-dashboard.html',
  styleUrls: ['./hr-dashboard.scss'],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatProgressBarModule,
    NgIf,
    NgFor,
    MatIconModule,
    MatMenuModule,
    MatTabsModule,
    FormsModule,
  ],
})
export class HrDashboardComponent implements OnInit {
  // master data
  employees: EmployeeListItem[] = [];
  leaveTypes: LeaveType[] = [];

  // UI state
  selectedTabIndex = 0;
  selectedEmployeeId: number | null = null;

  isLoadingEmployees = false;
  isLoadingTypes = false;
  isLoadingBalances = false;
  isSavingBalances = false;

  // balances
  balances: LeaveBalanceRow[] = [];
  form: BalanceFormGroup = new FormGroup<Record<string, FormControl<number | null>>>({});
  // per-row busy state (prevents double clicks + used by template)
  requestBusy: Record<number, boolean> = {};

  // used by *ngFor trackBy in template
  trackByRequestId = (_: number, r: TimeOffRequestListItem) => r.id;
  // requests
  requests: TimeOffRequestListItem[] = [];
  isLoadingRequests = false;

  requestFilters = {
    status: new FormControl<TimeOffStatus | ''>('Pending'),
    leaveTypeCode: new FormControl<string>(''),
  };

  denyNotes: Record<number, string> = {};

  // adjustments
  isPostingAdjustment = false;
  adjustmentForm = new FormGroup({
    employeeId: new FormControl<number | null>(null, { validators: [Validators.required] }),
    leaveTypeCode: new FormControl<string>('', { validators: [Validators.required] }),
    amountHours: new FormControl<number | null>(null, { validators: [Validators.required] }),
    source: new FormControl<LedgerSource>('ManualAdjustment', { validators: [Validators.required] }),
    effectiveDate: new FormControl<string>(''), // YYYY-MM-DD optional
    memo: new FormControl<string>(''),
  });

  sources: LedgerSource[] = ['ManualAdjustment', 'BankedHoliday', 'OvertimeBank', 'Accrual'];

  constructor(
    private timeOff: TimeOffService,
    private snack: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadInitial();
  }

  private loadInitial(): void {
    this.isLoadingEmployees = true;
    this.isLoadingTypes = true;

    forkJoin({
      employees: this.timeOff.getEmployees(),
      leaveTypes: this.timeOff.getLeaveTypes(),
    }).subscribe({
      next: ({ employees, leaveTypes }) => {
        this.employees = (employees || []).slice().sort((a, b) => a.firstName.localeCompare(b.firstName));
        this.leaveTypes = (leaveTypes || []).slice().sort((a, b) => a.code.localeCompare(b.code));
        this.buildBalanceForm();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(err);
        this.snack.open('Failed to load HR data', 'close', { duration: 3000 });
      },
      complete: () => {
        this.isLoadingEmployees = false;
        this.isLoadingTypes = false;
        this.cdr.detectChanges();

        // load requests by default for HR
        this.refreshRequests();
      },
    });
  }

  // -----------------------------
  // Balances
  // -----------------------------
  private buildBalanceForm(): void {
    const controls: Record<string, FormControl<number | null>> = {};
    for (const lt of this.leaveTypes) {
      controls[lt.code] = new FormControl<number | null>(null, { validators: [Validators.min(0)] });
    }
    this.form = new FormGroup<Record<string, FormControl<number | null>>>(controls);
  }

  onEmployeeChanged(employeeId: number | null): void {
    this.selectedEmployeeId = employeeId;
    this.balances = [];
    this.form.reset();
    this.cdr.detectChanges();

    if (!employeeId) return;
    this.loadBalances(employeeId);
  }

  private loadBalances(employeeId: number): void {
    this.isLoadingBalances = true;
    this.cdr.detectChanges();

    this.timeOff.getEmployeeBalances(employeeId).subscribe({
      next: (rows) => {
        this.balances = (rows || []).slice().sort((a, b) => a.code.localeCompare(b.code));
        // prefill
        for (const row of this.balances) {
          const ctrl = this.form.controls[row.code];
          if (ctrl) ctrl.setValue(Number(row.currentHours ?? 0));
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(err);
        this.snack.open('Failed to load employee balances', 'close', { duration: 3000 });
      },
      complete: () => {
        this.isLoadingBalances = false;
        this.cdr.detectChanges();
      },
    });
  }

  getCurrentHours(code: string): number {
    return Number(this.balances.find((b) => b.code === code)?.currentHours ?? 0);
  }

  saveAllTargets(): void {
    if (!this.selectedEmployeeId) {
      this.snack.open('Select an employee first', 'close', { duration: 2500 });
      return;
    }
    if (this.form.invalid) {
      this.snack.open('Please fix validation errors before saving', 'close', { duration: 3000 });
      return;
    }

    const employeeId = this.selectedEmployeeId;
    const memo = 'HR set leave balance';

    const calls = this.leaveTypes.map((lt) => {
      const raw = this.form.controls[lt.code]?.value;
      const targetHours = Number(raw ?? 0);
      return this.timeOff.setEmployeeBalance(employeeId, lt.code, targetHours, memo);
    });

    this.isSavingBalances = true;
    this.cdr.detectChanges();

    forkJoin(calls).subscribe({
      next: () => {
        this.snack.open('Balances saved', 'close', { duration: 2500 });
        this.loadBalances(employeeId);
      },
      error: (err) => {
        console.error(err);
        this.snack.open('Failed to save balances', 'close', { duration: 3000 });
      },
      complete: () => {
        this.isSavingBalances = false;
        this.cdr.detectChanges();
      },
    });
  }

  // -----------------------------
  // Requests
  // -----------------------------
  refreshRequests(): void {
    this.isLoadingRequests = true;
    this.cdr.detectChanges();

    const status = this.requestFilters.status.value || '';
    const leaveTypeCode = (this.requestFilters.leaveTypeCode.value || '').trim();

    this.timeOff
      .getTimeOffRequests({
        status: status ? status : undefined,
        leaveTypeCode: leaveTypeCode ? leaveTypeCode : undefined,
      })
      .subscribe({
        next: (rows) => {
          this.requests = (rows || []).slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error(err);
          this.snack.open('Failed to load time-off requests', 'close', { duration: 3000 });
        },
        complete: () => {
          this.isLoadingRequests = false;
          this.cdr.detectChanges();
        },
      });
  }

  private removeFromPendingListIfNeeded(requestId: number): void {
    // If you are filtering to "Pending", remove immediately so it disappears without waiting.
    const statusFilter = this.requestFilters.status.value || '';
    if (statusFilter === 'Pending') {
      this.requests = this.requests.filter(r => r.id !== requestId);
      this.cdr.detectChanges();
    }
  }

  approve(reqItem: TimeOffRequestListItem): void {
  if (this.requestBusy[reqItem.id]) return;
  this.requestBusy[reqItem.id] = true;
  this.cdr.detectChanges();

  this.timeOff.approveRequest(reqItem.id).subscribe({
    next: () => {
      this.snack.open('Request approved', 'close', { duration: 2500 });

      // Remove immediately from the current list (especially when filtered to Pending)
      this.requests = this.requests.filter(r => r.id !== reqItem.id);
      this.cdr.detectChanges();

      // Then refresh for consistency
      this.refreshRequests();
    },
    error: (err) => {
      console.error(err);
      const msg = err?.error?.error || 'Failed to approve request';
      this.snack.open(msg, 'close', { duration: 3500 });
    },
    complete: () => {
      this.requestBusy[reqItem.id] = false;
      this.cdr.detectChanges();
    }
  });
}

deny(reqItem: TimeOffRequestListItem): void {
  if (this.requestBusy[reqItem.id]) return;
  this.requestBusy[reqItem.id] = true;
  this.cdr.detectChanges();

  const notes = (this.denyNotes[reqItem.id] || '').trim() || undefined;

  this.timeOff.denyRequest(reqItem.id, notes).subscribe({
    next: () => {
      this.snack.open('Request denied', 'close', { duration: 2500 });
      this.denyNotes[reqItem.id] = '';

      // Remove immediately from the current list
      this.requests = this.requests.filter(r => r.id !== reqItem.id);
      this.cdr.detectChanges();

      this.refreshRequests();
    },
    error: (err) => {
      console.error(err);
      this.snack.open('Failed to deny request', 'close', { duration: 3500 });
    },
    complete: () => {
      this.requestBusy[reqItem.id] = false;
      this.cdr.detectChanges();
    }
  });
}

cancel(reqItem: TimeOffRequestListItem): void {
  if (this.requestBusy[reqItem.id]) return;
  this.requestBusy[reqItem.id] = true;
  this.cdr.detectChanges();

  this.timeOff.cancelRequest(reqItem.id).subscribe({
    next: () => {
      this.snack.open('Request cancelled', 'close', { duration: 2500 });

      // Remove immediately from the current list
      this.requests = this.requests.filter(r => r.id !== reqItem.id);
      this.cdr.detectChanges();

      this.refreshRequests();
    },
    error: (err) => {
      console.error(err);
      this.snack.open('Failed to cancel request', 'close', { duration: 3500 });
    },
    complete: () => {
      this.requestBusy[reqItem.id] = false;
      this.cdr.detectChanges();
    }
  });
}
  // -----------------------------
  // Adjustments
  // -----------------------------
  postAdjustment(): void {
    if (this.adjustmentForm.invalid) {
      this.snack.open('Fill out all required adjustment fields', 'close', { duration: 3000 });
      return;
    }

    const employeeId = Number(this.adjustmentForm.controls.employeeId.value);
    const leaveTypeCode = String(this.adjustmentForm.controls.leaveTypeCode.value || '').trim().toUpperCase();
    const amountHours = Number(this.adjustmentForm.controls.amountHours.value);
    const source = this.adjustmentForm.controls.source.value as LedgerSource;
    const effectiveDate = (this.adjustmentForm.controls.effectiveDate.value || '').trim();
    const memo = (this.adjustmentForm.controls.memo.value || '').trim();

    this.isPostingAdjustment = true;
    this.cdr.detectChanges();

    this.timeOff
      .postLedgerAdjustment({
        employeeId,
        leaveTypeCode,
        amountHours,
        source,
        effectiveDate: effectiveDate ? effectiveDate : undefined,
        memo: memo ? memo : null,
      })
      .subscribe({
        next: () => {
          this.snack.open('Ledger adjustment posted', 'close', { duration: 2500 });
          this.adjustmentForm.reset({
            employeeId: employeeId,
            leaveTypeCode: '',
            amountHours: null,
            source: 'ManualAdjustment',
            effectiveDate: '',
            memo: '',
          });

          // if the HR user is currently viewing this employee in balances, refresh
          if (this.selectedEmployeeId === employeeId) {
            this.loadBalances(employeeId);
          }

          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error(err);
          this.snack.open('Failed to post adjustment', 'close', { duration: 3500 });
        },
        complete: () => {
          this.isPostingAdjustment = false;
          this.cdr.detectChanges();
        },
      });
  }

  // display helpers
  employeeName(e: EmployeeListItem): string {
    return `${e.firstName} ${e.lastName}`;
  }

  fmtDateTime(v: string): string {
    return v ? new Date(v).toLocaleString() : '';
  }
}
