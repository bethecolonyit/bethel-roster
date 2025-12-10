import { ChangeDetectorRef, Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { StudentService } from '../../../../services/student.service';
import { Student } from '../../../../models/student';
import { CommonModule } from '@angular/common';
@Component({
  selector: 'app-counseling-dashboard',
  imports: [CommonModule, MatCardModule, MatMenuModule, MatIconModule],
  templateUrl: './c-coord-dashboard.html',
  styleUrl: './c-coord-dashboard.scss',
  standalone: true,
})
export class CCoordDashboard {

  students: Student[] = [];
  studentsNeedingCounselor: Student[] = [];
  filteredStudents: Student[] = []
  error: string | null = null;

  constructor(private studentService: StudentService, private cdr: ChangeDetectorRef) {
    this.loadStudents();

  }

  loadStudents() {
    this.studentService.getStudents().subscribe({
      next: (data) => { 
        this.students = data; 
        this.filteredStudents = [...this.students];
        this.loadStudentsNeedingCounselor();
        this.cdr.detectChanges(); 
      },
      error: () => this.error = 'Error loading students'
    });
  }

  loadStudentsNeedingCounselor() {
    this.studentsNeedingCounselor = this.students.filter(student => !student.counselor);
  }

  emptyFunction() { } // Placeholder for future functionality
  onAssignCounselor(student: Student) { } // Placeholder for future functionality 

}
