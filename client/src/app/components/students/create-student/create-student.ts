import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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

  student: Student = {
    firstName: '',
    lastName: '',
    idNumber: '',
    counselor: '',
    program: '',
    dayin: '',
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

onSubmit() {
  const formData = new FormData();

  // The backend expects ALL student fields as a single JSON string under "data"
  formData.append('data', JSON.stringify(this.student));

  // Append file
  if (this.selectedFile) {
    formData.append('photo', this.selectedFile);
  } else {
    this.snack.open('Please upload a student photo', 'Close', { duration: 3000 });
    return;
  }

  this.studentService.createStudent(formData).subscribe({
    next: () => {
      this.snack.open('Student created successfully!', 'OK', { duration: 3000 });
      this.resetForm();
      this.cdr.detectChanges();
    },
    error: (err) => {
      console.error(err);
      this.snack.open('Error creating student', 'Close');
      this.cdr.detectChanges(); 
    }
  });
}


  resetForm() {
    this.student = {
      firstName: '',
      lastName: '',
      idNumber: '',
      counselor: '',
      program: '',
      dayin: '',
      isFelon: false,
      onProbation: false,
      usesNicotine: false,
      hasDriverLicense: false,
      foodAllergies: false,
      beeAllergies: false
    };
    this.selectedFile = null;
  }
}
