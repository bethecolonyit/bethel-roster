import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, NgIf, NgFor } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CreateStudentComponent } from './create-student/create-student';
import { StudentService } from '../../services/student.service';
import { Student } from '../../models/student';
import { StudentList } from './student-list/student-list';
import { StudentCard } from './student-card/student-card';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-students',
  standalone: true,
  templateUrl: './students.html',
  styleUrls: ['./students.scss'],
  imports: [
    CommonModule,
    NgIf,
    NgFor,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatTableModule,
    MatTooltipModule,
    CreateStudentComponent,
    StudentList,
    StudentCard,
    FormsModule,
    MatFormFieldModule,
    MatInputModule
  ]
})
export class Students implements OnInit {

  students: Student[] = [];
  error: string | null = null;
  filteredStudents: Student[] = [];
  searchTerm: string = '';

  showCreateForm = false;
  viewMode: 'list' | 'grid' = 'grid';

  constructor(private studentService: StudentService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.loadStudents();
  }

  loadStudents() {
    this.studentService.getStudents().subscribe({
      next: (data) => { 
        this.students = data; 
        this.filteredStudents = [...this.students];
        this.cdr.detectChanges(); 
      },
      error: () => this.error = 'Error loading students'
    });
  }

 onSearchTermChange(term: string) {
    this.searchTerm = term;
    this.applyFilter();
  }

  private applyFilter() {
    const term = this.searchTerm.trim().toLowerCase();

    if (!term) {
      this.filteredStudents = [...this.students];
      return;
    }

    this.filteredStudents = this.students.filter((s) => {
      const first = (s.firstName || '').toLowerCase();
      const last = (s.lastName || '').toLowerCase();
      const fullName = `${first} ${last}`.trim();
      const idNumber = (s.idNumber || '').toLowerCase();

      return (
        first.includes(term) ||
        last.includes(term) ||
        fullName.includes(term) ||
        idNumber.includes(term)
      );
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

  


  editStudent(student: Student) { /* implement later */ }
  deleteStudent(student: Student) { /* implement later */ }
  onViewStudentDetails(student: Student) { /* implement later */  }
  onCreateStudentNote(student: Student) { /* implement later */  }  
  onCreateStudentWriteUp(student: Student) { /* implement later */  } 
}
