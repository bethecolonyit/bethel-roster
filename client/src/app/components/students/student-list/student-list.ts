import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DatePipe, CommonModule, NgFor } from '@angular/common';
import { MatIcon } from '@angular/material/icon';
import { Student } from '../../../models/student';
import { RouterLink } from '@angular/router';


@Component({
  selector: 'app-student-list',
  imports: [MatIcon, DatePipe, CommonModule, NgFor, RouterLink],
  templateUrl: './student-list.html',
  styleUrl: './student-list.scss',
  standalone: true,
})
export class StudentList {

  viewStudent(student: Student) { /* view profile later */ }
  @Input() students: Student[] = [];
  @Input() viewMode: 'list' | 'grid' = 'grid';

  @Output() viewDetails = new EventEmitter<Student>();

}
