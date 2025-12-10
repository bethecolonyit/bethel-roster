import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { Student } from '../../../../models/student';
@Component({
  selector: 'app-counseling-dashboard',
  imports: [MatCardModule, MatMenuModule, MatIconModule],
  templateUrl: './counseling-dashboard.html',
  styleUrl: './counseling-dashboard.scss',
  standalone: true,
})
export class CounselingDashboard {

  students: Student[] = [];

  emptyFunction() { } // Placeholder for future functionality

}
