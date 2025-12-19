import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatSnackBar } from '@angular/material/snack-bar';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';

import { EmployeeService } from '../../../services/employee.service';
import { Employee } from '../../../models/employee';
import { UserLookup, AuthService} from '../../../services/auth';

@Component({
  selector: 'app-manage-employees',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DatePipe,
    MatCardModule,
    MatMenuModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatTooltipModule,
  ],
  templateUrl: './manage-employees.html',
  styleUrl: './manage-employees.scss',
})
export class ManageEmployees {
  employees: Employee[] = [];
  users: UserLookup[] = [];
  showForm = false;
  error: string | null = null;

  isEditMode = false;
  editingEmployeeId: number | null = null;

employeeForm!: ReturnType<FormBuilder['group']>;

  constructor(
    private fb: FormBuilder,
    private employeeService: EmployeeService,
    private authService: AuthService,
    private snack: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
  this.employeeForm = this.fb.group({
    userId: [null, Validators.required],
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    hireDate: [null, Validators.required],
  });
    this.loadUsers();
    this.loadEmployees();
  }

loadUsers(includeUserId?: number): void {
  this.authService.getUsersLookup(includeUserId).subscribe({
    next: (users) => {
      this.users = Array.isArray(users) ? users : [];
      this.cdr.detectChanges();
    },
    error: (err) => {
      console.error('Error loading users lookup', err);
      this.users = [];
      this.error = 'Failed to load users for select box.';
    },
  });
}


  loadEmployees(): void {
    this.employeeService.getEmployees().subscribe({
      next: (employees) => {
        this.employees = Array.isArray(employees) ? employees : [];
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading employees', err);
        this.employees = [];
        this.error = 'Failed to load employees.';
      },
    });
  }

  // Helper for displaying the user name in the employee list (optional)
  getUserDisplayName(userId: number | undefined): string {
    if (!userId) return '';
    const u = this.users.find(x => x.id === userId);
    return u ? `${u.email}` : `User #${userId}`;
  }

  startCreate(): void {
    this.isEditMode = false;
    this.editingEmployeeId = null;
    this.error = null;
    this.employeeForm.reset({
      userId: null,
      firstName: '',
      lastName: '',
      hireDate: new Date(),
    });
  }

  onEditEmployee(employee: Employee): void {
    this.isEditMode = true;
    this.editingEmployeeId = employee.id ?? null;
    this.error = null;

    this.employeeForm.setValue({
      userId: employee.userId ?? null,
      firstName: employee.firstName ?? '',
      lastName: employee.lastName ?? '',
      hireDate: employee.hireDate ? new Date(employee.hireDate) : null,
    });
  }

  cancelEdit(): void {
    this.startCreate();
  }

  submitEmployee(): void {
    this.error = null;

    if (this.employeeForm.invalid) {
      this.employeeForm.markAllAsTouched();
      this.error = 'All fields are required.';
      return;
    }

    const payload: Employee = {
      userId: this.employeeForm.value.userId ?? undefined,
      firstName: this.employeeForm.value.firstName ?? '',
      lastName: this.employeeForm.value.lastName ?? '',
      hireDate: this.employeeForm.value.hireDate ?? new Date(),
    };

    if (!this.isEditMode) {
      this.employeeService.createEmployee(payload).subscribe({
        next: () => {
          this.snack.open('Employee created', 'close', { duration: 2500 });
          this.startCreate();
          this.closeForm();
          this.loadEmployees();
        },
        error: (err) => {
          console.error('Error creating employee:', err);
          this.error = err.error?.error || 'Error creating employee';
        },
      });
      return;
    }

    // Edit mode
    if (!this.editingEmployeeId) {
      this.error = 'No employee selected for editing.';
      return;
    }

    this.employeeService.updateEmployee(this.editingEmployeeId, payload).subscribe({
      next: () => {
        this.snack.open('Employee updated', 'close', { duration: 2500 });
        this.startCreate();
        this.closeForm();
        this.loadEmployees();
      },
      error: (err) => {
        console.error('Error updating employee:', err);
        this.error = err.error?.error || 'Error updating employee';
      },
    });
  }

  openCreateForm(): void {
  this.showForm = true;
  this.isEditMode = false;
  this.editingEmployeeId = null;
  this.error = null;

  // For create, you want ONLY unassigned users
  this.loadUsers(); // (or loadUsers() with no include param)

  this.employeeForm.reset({
    userId: null,
    firstName: '',
    lastName: '',
    hireDate: new Date(),
  });
}

openEditForm(employee: Employee): void {
  this.showForm = true;
  this.isEditMode = true;
  this.editingEmployeeId = employee.id ?? null;
  this.error = null;

  // For edit, include the currently assigned user in lookup (recommended)
  this.loadUsers(employee.userId); // see loadUsers change below

  this.employeeForm.setValue({
    userId: employee.userId ?? null,
    firstName: employee.firstName ?? '',
    lastName: employee.lastName ?? '',
    hireDate: employee.hireDate ? new Date(employee.hireDate) : null,
  });
}

closeForm(): void {
  this.showForm = false;
  this.isEditMode = false;
  this.editingEmployeeId = null;
  this.error = null;
  this.employeeForm.reset();
}
}
