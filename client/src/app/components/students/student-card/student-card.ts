import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Student } from '../../../models/student';
import { MatIcon } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../services/auth';

@Component({
  selector: 'app-student-card',
  imports: [MatIcon, CommonModule, MatTooltipModule, MatMenuModule, MatButtonModule, RouterLink],
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

  constructor(public auth: AuthService) {}
  getStudentPhoto(idNumber: string) {
    return `${environment.apiBaseUrl}/uploads/students/${idNumber}.jpg`;
  }
  formatDateOnly(value: any): string {
  if (!value) return '';

  // If it's already a Date object
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${m}/${d}/${y}`;
  }

  // If it's a string like "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm:ss..."
  if (typeof value === 'string') {
    const s = value.trim();

    // "YYYY-MM-DD" (date-only) -> format directly, no Date parsing
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (m) {
      const yyyy = m[1];
      const mm = m[2];
      const dd = m[3];
      return `${mm}/${dd}/${yyyy}`;
    }

    // Fallback: attempt Date parse (last resort)
    const d = new Date(s);
    if (!Number.isFinite(d.getTime())) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${mm}/${dd}/${yyyy}`;
  }

  // Unknown type: try Date coercion
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}/${dd}/${yyyy}`;
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

