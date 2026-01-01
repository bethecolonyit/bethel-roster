import { ChangeDetectorRef, Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';

import { StudentService } from '../../../../services/student.service';
import { Student } from '../../../../models/student';
import { CommonModule } from '@angular/common';
import { ManageWritingAssignmentsCardComponent } from '../../../writing-assignments/manage-writing-assignments-card/manage-writing-assignments-card';
import { CounselingAssignmentsCardComponent } from '../../counseling/counseling-cards/counseling-assignments-card/counseling-assignments-card.component';

@Component({
  selector: 'app-counseling-dashboard',
  imports: [CommonModule, MatCardModule, MatMenuModule, MatIconModule, ManageWritingAssignmentsCardComponent, CounselingAssignmentsCardComponent],
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
    

  }
  emptyFunction() { } // Placeholder for future functionality
}
