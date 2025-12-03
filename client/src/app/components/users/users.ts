// src/app/components/users/users.ts
import { Component, OnInit, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  UserService,
  User,
  CreateUserDto,
  UpdateUserDto,
  ResetPasswordDto
} from '../../services/user.service';

// Angular Material
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './users.html',
  styleUrls: ['./users.scss']
})
export class UsersComponent implements OnInit {
  users: User[] = [];
  error: string | null = null;
  showCreateForm = false;
  // create form
  newUser: CreateUserDto = {
    email: '',
    password: '',
    role: 'user'
  };
  resettingUserId: number | null = null;
  resetPassword = '';
  isResettingPassword = false;

  // edit state
  editingUserId: number | null = null;
  editModel: UpdateUserDto & { password?: string } = {
    email: '',
    role: 'user',
    password: ''
  };

  constructor(
    private userService: UserService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    console.log('%c[UsersComponent] ngOnInit fired', 'color: green; font-weight: bold;');
    this.loadUsers();
  }

  toggleCreateForm(): void {
    this.showCreateForm = !this.showCreateForm;
  }
  loadUsers(): void {
    console.log('%c[UsersComponent] loadUsers() called', 'color: blue; font-weight: bold;');
    this.error = null;

    this.userService.getUsers().subscribe({
      next: (users) => {
        this.ngZone.run(() => {
          console.log('%c[UsersComponent] API returned:', 'color: purple; font-weight: bold;', users);
          this.users = Array.isArray(users) ? [...users] : [];
          console.log(
            '%c[UsersComponent] AFTER SUCCESS users length =',
            'color: orange; font-weight: bold;',
            this.users.length
          );
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          console.log('%c[UsersComponent] API ERROR:', 'color: red; font-weight: bold;', err);
          this.error = err.error?.error || 'Error loading users';
          this.users = [];
          this.cdr.detectChanges();
        });
      }
    });
  }

  // --- create ---

  private resetNewUserForm(): void {
    this.newUser = {
      email: '',
      password: '',
      role: 'user'
    };
  }

  createUser(): void {
    this.error = null;

    if (!this.newUser.email || !this.newUser.password) {
      this.error = 'Email and password are required for new users.';
      return;
    }

    this.userService.createUser(this.newUser).subscribe({
      next: (created) => {
        console.log('%c[UsersComponent] createUser success:', 'color: teal; font-weight: bold;', created);
        this.resetNewUserForm();

        // Reload from backend so list is always canonical
        this.loadUsers();
      },
      error: (err) => {
        console.error('Error creating user:', err);
        this.error = err.error?.error || 'Error creating user';
      }
    });
  }

  // --- edit ---

  startEdit(user: User): void {
    this.editingUserId = user.id;
    this.editModel = {
      email: user.email,
      role: (user.role as 'admin' | 'user') || 'user',
      password: ''
    };
    this.cancelResetPassword();
  }

  cancelEdit(): void {
    this.editingUserId = null;
    this.editModel = {
      email: '',
      role: 'user',
      password: ''
    };
  }

  saveEdit(user: User): void {
    if (!this.editingUserId) return;

    const payload: UpdateUserDto = {
      email: this.editModel.email,
      role: this.editModel.role
    };

    if (this.editModel.password && this.editModel.password.trim().length > 0) {
      payload.password = this.editModel.password;
    }

    this.userService.updateUser(this.editingUserId, payload).subscribe({
      next: (updated) => {
        const idx = this.users.findIndex(u => u.id === user.id);
        if (idx !== -1) {
          this.users[idx] = updated;
        }
        this.cancelEdit();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error updating user:', err);
        this.error = err.error?.error || 'Error updating user';
      }
    });
  }

  // --- delete ---

  deleteUser(user: User): void {
    if (!confirm(`Are you sure you want to delete ${user.email}?`)) {
      return;
    }

    this.userService.deleteUser(user.id).subscribe({
      next: () => {
        this.users = this.users.filter(u => u.id !== user.id);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error deleting user:', err);
        this.error = err.error?.error || 'Error deleting user';
      }
    });
  }
  toggleResetPassword(user: User): void {
    if (this.resettingUserId === user.id) {
      // clicking again closes it
      this.cancelResetPassword();
    } else {
      this.resettingUserId = user.id;
      this.resetPassword = '';
      this.error = null;
      // Optional: cancel edit if it's open on this row
      this.cancelEdit();
    }
  }

  cancelResetPassword(): void {
    this.resettingUserId = null;
    this.resetPassword = '';
    this.isResettingPassword = false;
  }

  submitResetPassword(user: User): void {
    if (!this.resettingUserId || !this.resetPassword) return;

    this.isResettingPassword = true;

    const payload: ResetPasswordDto = {
      password: this.resetPassword,
    };

    this.userService.resetPassword(user.id, payload).subscribe({
      next: (res) => {
        // You may want to show a toast/snackbar here instead
        console.log('Password reset response:', res);
        this.cancelResetPassword();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error resetting password:', err);
        this.error = err.error?.error || 'Error resetting password';
        this.isResettingPassword = false;
      },
    });
  }
}
