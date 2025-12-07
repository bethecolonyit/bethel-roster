import { Component, Input } from '@angular/core';
import { Student } from '../../../models/student';
import { MatIcon } from '@angular/material/icon';
import { DatePipe, CommonModule } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-student-card',
  imports: [MatIcon, DatePipe, CommonModule, MatTooltipModule],
  templateUrl: './student-card.html',
  styleUrl: './student-card.scss',
  standalone: true,
})
export class StudentCard {
  @Input()
  student!: Student;

  getStudentPhoto(idNumber: string) {
    return `http://localhost:3000/uploads/students/${idNumber}.jpg`;
  }
}
