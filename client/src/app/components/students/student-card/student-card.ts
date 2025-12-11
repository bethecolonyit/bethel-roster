import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Student } from '../../../models/student';
import { MatIcon } from '@angular/material/icon';
import { DatePipe, CommonModule } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-student-card',
  imports: [MatIcon, DatePipe, CommonModule, MatTooltipModule, MatMenuModule, MatButtonModule, RouterLink],
  templateUrl: './student-card.html',
  styleUrl: './student-card.scss',
  standalone: true,
})
export class StudentCard {
  @Input()
  menuHidden: boolean = false;
  @Input()
  student!: Student;

   @Output() viewDetails = new EventEmitter<Student>();
  @Output() createNote = new EventEmitter<Student>();
  @Output() createWriteUp = new EventEmitter<Student>();

  getStudentPhoto(idNumber: string) {
    return `${environment.apiBaseUrl}/uploads/students/${idNumber}.jpg`;
  }
   onViewDetails() {
    this.viewDetails.emit(this.student);
  }

  onCreateNote() {
    this.createNote.emit(this.student);
  }

  onCreateWriteUp() {
    this.createWriteUp.emit(this.student);
  }
}

