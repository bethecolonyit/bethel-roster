import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, NgIf, NgFor, DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CreateStudentComponent } from './create-student/create-student';
import { StudentService } from '../../services/student.service';
import { Student } from '../../models/student';
import { StudentList } from './student-list/student-list';

@Component({
  selector: 'app-students',
  standalone: true,
  templateUrl: './students.html',
  styleUrls: ['./students.scss'],
  imports: [
    CommonModule,
    NgIf,
    NgFor,
    DatePipe,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatTableModule,
    MatTooltipModule,
    CreateStudentComponent,
    StudentList
  ]
})
export class Students implements OnInit {

  students: Student[] = [];
  error: string | null = null;

  showCreateForm = false;
  viewMode: 'list' | 'grid' = 'grid';

  constructor(private studentService: StudentService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.loadStudents();
  }

  loadStudents() {
    this.studentService.getStudents().subscribe({
      next: (data) => { this.students = data; this.cdr.detectChanges(); },
      error: () => this.error = 'Error loading students'
    });
  }
onStudentCreated() {
  this.loadStudents();  
  this.showCreateForm = false;
}
  toggleCreateStudent() {
    this.showCreateForm = !this.showCreateForm;
  }

  toggleViewMode() {
    this.viewMode = this.viewMode === 'grid' ? 'list' : 'grid';
  }

  getStudentPhoto(idNumber: string) {
    return `http://localhost:3000/uploads/students/${idNumber}.jpg`;
  }


  editStudent(student: Student) { /* implement later */ }
  deleteStudent(student: Student) { /* implement later */ }
}
