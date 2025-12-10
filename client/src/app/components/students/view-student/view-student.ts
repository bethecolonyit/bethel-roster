import { Component, ChangeDetectorRef } from '@angular/core';
import { Student } from '../../../models/student';
import { StudentService } from '../../../services/student.service';
import { ActivatedRoute } from '@angular/router';
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




  constructor(private route: ActivatedRoute, private studentService: StudentService, private cdr: ChangeDetectorRef) {
    this.student = {} as Student;
  }

  ngOnInit(): void {
    this.studentId = Number(this.route.snapshot.paramMap.get('id'));

    this.getStudent()
  }

  getStudent() {
    this.studentService.getStudentById(this.studentId).subscribe({
      next: (data) => {
        this.student = data;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error fetching student:', error);
      },
    })
  }
  onSubmitBasic(form: NgForm) {
  if (form.invalid || !this.isEditingBasic) {
    return;
  }

  const payload = {
    ...this.student, // make a shallow copy if you want
  };

  console.log('Submitting payload:', payload);

  this.studentService.updateStudent(this.student.id!, payload)
    .subscribe({
      next: () => {
        this.isEditingBasic = false;
        console.log(`isEditingBasic set to ${this.isEditingBasic}`);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Update failed', err);
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
    // Placeholder function
  }

  onDeleteStudent(student: Student) {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${student.firstName} ${student.lastName}?  This action cannot be undone.`
    );
    if (!confirmed) return;
    this.studentService.deleteStudent(student.id!, student.idNumber).subscribe({
    next: msg => {
      console.log(msg); // "123 was successfully deleted"
      // refresh list, show snackbar, etc.
    },
    error: err => {
      console.error('Delete failed', err);
      // show error snackbar, etc.
    }
  });
}
}
