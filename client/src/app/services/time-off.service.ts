import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment.development';

export interface LeaveType {
  id: number;
  code: string;   // "PTO", "SICK"
  name: string;
  description?: string | null;
  isActive: boolean;
}

export interface EmployeeListItem {
  id: number;
  userId: number | null;
  firstName: string;
  lastName: string;
  hireDate: string; // ISO date
}

export interface LeaveBalanceRow {
  employeeId: number;
  leaveTypeId: number;
  code: string;
  name: string;
  currentHours: number;
  updatedAt?: string | null;
}
export interface CreateTimeOffRequestDto {
  leaveTypeCode: string;
  startDateTime: string;   // ISO or "YYYY-MM-DDTHH:mm"
  endDateTime: string;     // ISO or "YYYY-MM-DDTHH:mm"
  requestedHours: number;
  notes?: string | null;
}
export type TimeOffStatus = 'Pending' | 'Approved' | 'Denied' | 'Cancelled';

export interface TimeOffRequestListItem {
  id: number;
  employeeId: number;
  employeeFirstName: string;
  employeeLastName: string;
  leaveTypeCode: string;
  leaveTypeName: string;
  startDateTime: string;
  endDateTime: string;
  requestedHours: number;
  status: TimeOffStatus;
  requestedByUserId?: number | null;
  reviewedByUserId?: number | null;
  reviewedAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export type LedgerSource = 'ManualAdjustment' | 'BankedHoliday' | 'OvertimeBank' | 'Accrual';

@Injectable({ providedIn: 'root' })
export class TimeOffService {
  private baseUrl = `${environment.apiBaseUrl}/api`;
  private httpOptions = { withCredentials: true as const };

  constructor(private http: HttpClient) {}

  // Employees
  getEmployees(): Observable<EmployeeListItem[]> {
    return this.http.get<EmployeeListItem[]>(`${this.baseUrl}/employees`, this.httpOptions);
  }

  // Leave Types
  getLeaveTypes(): Observable<LeaveType[]> {
    return this.http.get<LeaveType[]>(`${this.baseUrl}/leave-types`, this.httpOptions);
  }

  // Balances
  getEmployeeBalances(employeeId: number): Observable<LeaveBalanceRow[]> {
    return this.http.get<LeaveBalanceRow[]>(
      `${this.baseUrl}/employees/${employeeId}/leave-balances`,
      this.httpOptions
    );
  }

  setEmployeeBalance(employeeId: number, leaveTypeCode: string, targetHours: number, memo?: string): Observable<any> {
    return this.http.post(
      `${this.baseUrl}/employees/${employeeId}/leave-balances/set`,
      { leaveTypeCode, targetHours, memo: memo ?? null },
      this.httpOptions
    );
  }

  // Requests (Admin view)
  getTimeOffRequests(params?: {
    employeeId?: number;
    status?: TimeOffStatus | '';
    leaveTypeCode?: string;
    from?: string; // ISO date/time
    to?: string;   // ISO date/time
  }): Observable<TimeOffRequestListItem[]> {
    const q: string[] = [];
    if (params?.employeeId) q.push(`employeeId=${encodeURIComponent(String(params.employeeId))}`);
    if (params?.status) q.push(`status=${encodeURIComponent(params.status)}`);
    if (params?.leaveTypeCode) q.push(`leaveTypeCode=${encodeURIComponent(params.leaveTypeCode)}`);
    if (params?.from) q.push(`from=${encodeURIComponent(params.from)}`);
    if (params?.to) q.push(`to=${encodeURIComponent(params.to)}`);

    const qs = q.length ? `?${q.join('&')}` : '';
    return this.http.get<TimeOffRequestListItem[]>(`${this.baseUrl}/time-off-requests${qs}`, this.httpOptions);
  }

  approveRequest(requestId: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/time-off-requests/${requestId}/approve`, {}, this.httpOptions);
  }

  denyRequest(requestId: number, notes?: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/time-off-requests/${requestId}/deny`, { notes: notes ?? null }, this.httpOptions);
  }

  cancelRequest(requestId: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/time-off-requests/${requestId}/cancel`, {}, this.httpOptions);
  }

  // Ledger adjustment
  postLedgerAdjustment(body: {
    employeeId: number;
    leaveTypeCode: string;
    amountHours: number;
    source: LedgerSource;
    effectiveDate?: string; // YYYY-MM-DD
    memo?: string | null;
  }): Observable<any> {
    return this.http.post(`${this.baseUrl}/time-off-ledger/adjust`, body, this.httpOptions);
  }

// ---- Staff endpoints ----
getMyBalances(): Observable<LeaveBalanceRow[]> {
  return this.http.get<LeaveBalanceRow[]>(
    `${this.baseUrl}/my/leave-balances`,
    this.httpOptions
  );
}

getMyRequests(): Observable<TimeOffRequestListItem[]> {
  return this.http.get<TimeOffRequestListItem[]>(
    `${this.baseUrl}/time-off-requests`,
    this.httpOptions
  );
}

createMyRequest(dto: CreateTimeOffRequestDto): Observable<any> {
  return this.http.post(
    `${this.baseUrl}/time-off-requests`,
    dto,
    this.httpOptions
  );
}

cancelMyPendingRequest(requestId: number): Observable<any> {
  return this.http.post(
    `${this.baseUrl}/time-off-requests/${requestId}/cancel-self`,
    {},
    this.httpOptions
  );
}
}

