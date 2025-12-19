import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, NgIf, NgFor } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { CreateStudentComponent } from './create-student/create-student';
import { StudentService } from '../../services/student.service';
import { Student } from '../../models/student';
import { StudentList } from './student-list/student-list';
import { StudentCard } from './student-card/student-card';
import { AuthService } from '../../services/auth';

type SortOption = 'alpha' | 'dayIn' | 'dayOut' | 'program';

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
    MatMenuModule,
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
  filteredStudents: Student[] = [];

  error: string | null = null;

  searchTerm: string = '';

  showCreateForm = false;
  viewMode: 'list' | 'grid' = 'grid';

  // Sorting
  sortOption: SortOption = 'alpha';

  constructor(
    private studentService: StudentService,
    private cdr: ChangeDetectorRef,
    public auth: AuthService
  ) {}

  ngOnInit() {
    this.loadStudents();
  }

  loadStudents() {
    this.studentService.getStudents().subscribe({
      next: (data) => {
        this.students = data;
        this.applyFilterAndSort();
        this.cdr.detectChanges();
      },
      error: () => (this.error = 'Error loading students')
    });
  }

  onSearchTermChange(term: string) {
    this.searchTerm = term;
    this.applyFilterAndSort();
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

  // Sort menu actions
  setSort(option: SortOption) {
    this.sortOption = option;
    this.applyFilterAndSort();
  }

  getSortLabel(): string {
    switch (this.sortOption) {
      case 'alpha':
        return 'Sort Alphabetical';
      case 'dayIn':
        return 'Sort by Day-In';
      case 'dayOut':
        return 'Sort by DayOut';
      case 'program':
        return 'Sort by Program';
      default:
        return 'Sort';
    }
  }

  private applyFilterAndSort() {
    const term = this.searchTerm.trim().toLowerCase();

    // 1) Filter
    let list: Student[];
    if (!term) {
      list = [...this.students];
    } else {
      list = this.students.filter((s) => {
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

    // 2) Sort filtered list
    this.filteredStudents = this.sortStudents(list, this.sortOption);
  }

  private sortStudents(list: Student[], option: SortOption): Student[] {
    const copy = [...list];

    const safeString = (v: unknown) => (v ?? '').toString().trim().toLowerCase();

    // Robust date parsing for MSSQL values that may arrive as ISO strings or Date objects.
    const toTime = (v: unknown): number => {
      if (!v) return NaN;
      if (v instanceof Date) return v.getTime();
      if (typeof v === 'number') return v;
      if (typeof v === 'string') {
        const s = v.trim();
        if (!s) return NaN;
        const ms = new Date(s).getTime();
        return Number.isFinite(ms) ? ms : NaN;
      }
      return NaN;
    };

    const getDayInMs = (s: Student) => {
      const ms = toTime((s as any).dayin);
      // Missing/invalid dayin goes last for "most recent first"
      return Number.isFinite(ms) ? ms : Number.NEGATIVE_INFINITY;
    };

    const getDayOutMs = (s: Student) => {
      const ms = toTime((s as any).dayout);
      // Missing/invalid dayout goes last for "soonest first"
      return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
    };

    copy.sort((a: Student, b: Student) => {
      switch (option) {
        case 'alpha': {
          // Primary: firstName, Secondary: lastName, Tertiary: idNumber
          const af = safeString(a.firstName);
          const bf = safeString(b.firstName);
          if (af !== bf) return af.localeCompare(bf);

          const al = safeString(a.lastName);
          const bl = safeString(b.lastName);
          if (al !== bl) return al.localeCompare(bl);

          const aid = safeString(a.idNumber);
          const bid = safeString(b.idNumber);
          return aid.localeCompare(bid);
        }

        case 'dayIn': {
          // Most recent dayin first
          const ad = getDayInMs(a);
          const bd = getDayInMs(b);
          if (ad !== bd) return bd - ad;

          // Tie-breaker alpha
          const af = safeString(a.firstName);
          const bf = safeString(b.firstName);
          if (af !== bf) return af.localeCompare(bf);
          return safeString(a.lastName).localeCompare(safeString(b.lastName));
        }

        case 'dayOut': {
          // Soonest dayout first
          const ad = getDayOutMs(a);
          const bd = getDayOutMs(b);
          if (ad !== bd) return ad - bd;

          // Tie-breaker alpha
          const af = safeString(a.firstName);
          const bf = safeString(b.firstName);
          if (af !== bf) return af.localeCompare(bf);
          return safeString(a.lastName).localeCompare(safeString(b.lastName));
        }

        case 'program': {
          // Program A-Z, then alpha name
          const ap = safeString(a.program);
          const bp = safeString(b.program);
          if (ap !== bp) return ap.localeCompare(bp);

          const af = safeString(a.firstName);
          const bf = safeString(b.firstName);
          if (af !== bf) return af.localeCompare(bf);
          return safeString(a.lastName).localeCompare(safeString(b.lastName));
        }

        default:
          return 0;
      }
    });

    return copy;
  }

  // Placeholders (implement later)
  editStudent(student: Student) {
    /* implement later */
  }

  deleteStudent(student: Student) {
    /* implement later */
  }

  onViewStudentDetails(student: Student) {
    /* implement later */
  }

  onCreateStudentNote(student: Student) {
    /* implement later */
  }

  onCreateStudentWriteUp(student: Student) {
    /* implement later */
  }
}
