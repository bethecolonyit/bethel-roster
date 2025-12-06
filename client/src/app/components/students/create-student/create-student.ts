
import { Component, ChangeDetectorRef, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { StudentService } from '../../../services/student.service';
import { Student } from '../../../models/student';


@Component({
  selector: 'app-create-student',
  standalone: true,
  templateUrl: './create-student.html',
  styleUrls: ['./create-student.scss'],
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule
  ]
})
export class CreateStudentComponent {
@Output() studentCreated = new EventEmitter<any>();
  student: Student = {
    firstName: '',
    lastName: '',
    idNumber: '',
    counselor: '',
    program: '',
    dayin: '',
    dayout: '',
    isFelon: false,
    onProbation: false,
    usesNicotine: false,
    hasDriverLicense: false,
    foodAllergies: false,
    beeAllergies: false
  };

  selectedFile: File | null = null;

  constructor(
    private studentService: StudentService,
    private snack: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {}

  onFileSelected(event: any) {
    this.selectedFile = event.target.files[0] ?? null;
  }

onSubmit(form: NgForm) {
  const formData = new FormData();

  formData.append('data', JSON.stringify(this.student));

  if (this.selectedFile) {
    formData.append('photo', this.selectedFile);
  } else {
    this.snack.open('Please upload a student photo', 'Close', { duration: 3000 });
    return;
  }

  this.studentService.createStudent(formData).subscribe({
    next: (newStudent) => {
      this.snack.open('Student created successfully!', 'OK', { duration: 3000 });

      // 🔔 Notify parent so it can refresh + close the form
      this.studentCreated.emit(newStudent);

      // ✅ Reset form state + model so no red errors
      this.resetForm(form);
    },
    error: (err) => {
      console.error(err);
      this.snack.open('Error creating student', 'Close');
    }
  });
}

onDayInChange() {
  if (this.student.dayin) {
    const inDate = new Date(this.student.dayin);
    const outDate = new Date(inDate);
    outDate.setDate(outDate.getDate() + 65);
    this.student.dayout = outDate.toISOString();
  }
}


 resetForm(form?: NgForm) {
  this.student = {
    firstName: '',
    lastName: '',
    idNumber: '',
    counselor: '',
    program: '',
    dayin: '',
    dayout: '',
    isFelon: false,
    onProbation: false,
    usesNicotine: false,
    hasDriverLicense: false,
    foodAllergies: false,
    beeAllergies: false
  };
  this.selectedFile = null;

  if (form) {
    form.resetForm();
    }
  }
}