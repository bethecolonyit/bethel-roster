import { Component, ChangeDetectorRef } from '@angular/core';
import { Student } from '../../../models/student';
import { StudentService } from '../../../services/student.service';
import { ActivatedRoute, Router } from '@angular/router';
import { StudentCard } from '../student-card/student-card';
import { MatIcon } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSelectModule } from '@angular/material/select';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PastorService } from '../../../services/pastor.service';
import { Pastor } from '../../../models/pastor';

@Component({
  selector: 'app-view-student',
  imports: [
    StudentCard,
    MatIcon,
    MatCardModule,
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatCheckboxModule,
    MatSelectModule,
    MatMenuModule,
    MatButtonModule
  ],
  providers: [provideNativeDateAdapter()],
  templateUrl: './view-student.html',
  styleUrl: './view-student.scss',
  standalone: true
})
export class ViewStudent {
  studentId!: number;
  student: Student;

  isEditingBasic = false;
  isEditingMedical = false;

  pastors: Pastor[] = [];
  pastorsLoading = false;

  constructor(
    private route: ActivatedRoute,
    private studentService: StudentService,
    private pastorService: PastorService,
    private cdr: ChangeDetectorRef,
    private snack: MatSnackBar,
    private router: Router,
  ) {
    this.student = {} as Student;
  }

  ngOnInit(): void {
    this.studentId = Number(this.route.snapshot.paramMap.get('id'));
    this.loadPastors();
    this.getStudent();
  }

  private loadPastors() {
    this.pastorsLoading = true;
    this.pastorService.getPastors(true).subscribe({
      next: (rows) => {
        this.pastors = rows ?? [];
        this.pastorsLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load pastors', err);
        this.pastors = [];
        this.pastorsLoading = false;
        this.snack.open('Failed to load counselor list', 'Close', { duration: 3000 });
        this.cdr.detectChanges();
      }
    });
  }

  getStudent() {
    this.studentService.getStudentById(this.studentId).subscribe({
      next: (data) => {
        this.student = data;

        // If backend returned only counselor string (legacy) but not pastorId,
        // keep UI stable; user can assign pastorId now.
        if (typeof this.student.pastorId === 'undefined') {
          this.student.pastorId = null;
        }

        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error fetching student:', error);
        this.snack.open('Failed to load student', 'Close', { duration: 3000 });
      },
    });
  }

  onSubmitBasic(form: NgForm) {
    if (form.invalid || !this.isEditingBasic) return;

    // Keep legacy counselor string synced for compatibility
    const selected = this.pastors.find(p => p.id === this.student.pastorId);
    if (selected) {
      this.student.counselor = selected.fullName;
    } else {
      // Unassigned
      this.student.counselor = '';
      this.student.pastorId = null;
    }

    const payload: Partial<Student> = { ...this.student };

    this.studentService.updateStudent(this.student.id!, payload).subscribe({
      next: () => {
        this.isEditingBasic = false;
        this.snack.open('Student updated', 'Close', { duration: 2500 });
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Update failed', err);
        this.snack.open('Update failed', 'Close', { duration: 3000 });
      }
    });
  }

  toggleEditBasic() {
    this.isEditingBasic = !this.isEditingBasic;
  }

  toggleEditMedical() {
    this.isEditingMedical = !this.isEditingMedical;
  }

  emptyFunction() {
    // Placeholder
  }

  onDeleteStudent(student: Student) {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${student.firstName} ${student.lastName}? This action cannot be undone.`
    );
    if (!confirmed) return;

    this.studentService.deleteStudent(student.id!, student.idNumber).subscribe({
      next: () => {
        this.router.navigate(['/students']).then(() => {
          this.snack.open('Student Successfully Deleted', 'Close', { duration: 3000 });
        });
      },
      error: (err) => {
        console.error('Delete failed', err);
        this.snack.open('Failed to Delete Student', 'Close', { duration: 3000 });
      }
    });
  }
}
