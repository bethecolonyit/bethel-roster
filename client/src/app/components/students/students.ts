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
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';

import { CreateStudentComponent } from './create-student/create-student';
import { StudentService } from '../../services/student.service';
import { Student } from '../../models/student';
import { StudentList } from './student-list/student-list';
import { StudentCard } from './student-card/student-card';
import { AuthService } from '../../services/auth';

type SortOption = 'alpha' | 'lastName' | 'dayIn' | 'dayOut' | 'program';
type ProgramFilter = '65 Day' | '30 Day' | 'VSP';

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
    MatInputModule,
    MatCheckboxModule,
    MatDividerModule
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

  // Filters
  programOptions: ProgramFilter[] = ['65 Day', '30 Day', 'VSP'];

  filters = {
    program: {
      '65 Day': false,
      '30 Day': false,
      'VSP': false
    } as Record<ProgramFilter, boolean>,

    // When checked => require the student field to be true
    isFelon: false,
    onProbation: false,
    usesNicotine: false,
    hasDriverLicense: false,
    foodAllergies: false,
    beeAllergies: false,
    enrolledInGed: false,
    tutoring: false
  };

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
        this.students = data ?? [];
        this.applyFilterAndSort();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(err);
        this.error = 'Error loading students';
      }
    });
  }

  onSearchTermChange(term: string) {
    this.searchTerm = term ?? '';
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
        return 'Sort Alphabetical (First Name)';
      case 'lastName':
        return 'Sort Alphabetical (Last Name)';
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

  // Filter helpers
  onFiltersChanged() {
    this.applyFilterAndSort();
  }

  clearFilters() {
    // Reset programs
    this.programOptions.forEach((p) => (this.filters.program[p] = false));

    // Reset booleans
    this.filters.isFelon = false;
    this.filters.onProbation = false;
    this.filters.usesNicotine = false;
    this.filters.hasDriverLicense = false;
    this.filters.foodAllergies = false;
    this.filters.beeAllergies = false;
    this.filters.enrolledInGed = false;
    this.filters.tutoring = false;

    this.applyFilterAndSort();
  }

  isAnyFilterActive(): boolean {
    const programActive = this.programOptions.some((p) => this.filters.program[p]);
    const boolActive =
      this.filters.isFelon ||
      this.filters.onProbation ||
      this.filters.usesNicotine ||
      this.filters.hasDriverLicense ||
      this.filters.foodAllergies ||
      this.filters.beeAllergies ||
      this.filters.enrolledInGed ||
      this.filters.tutoring;

    return programActive || boolActive;
  }

  getFilterLabel(): string {
    return this.isAnyFilterActive() ? 'Filters (active)' : 'Filters';
  }

  private applyFilterAndSort() {
    const term = (this.searchTerm ?? '').trim().toLowerCase();

    // 1) Search filter
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

    // 2) Checkbox filters (program + boolean flags)
    list = this.applyCheckboxFilters(list);

    // 3) Sort filtered list
    this.filteredStudents = this.sortStudents(list, this.sortOption);
  }

  private applyCheckboxFilters(list: Student[]): Student[] {
    const selectedPrograms = this.programOptions.filter((p) => this.filters.program[p]);
    const constrainProgram = selectedPrograms.length > 0;

    const requireIsFelon = this.filters.isFelon;
    const requireOnProbation = this.filters.onProbation;
    const requireUsesNicotine = this.filters.usesNicotine;
    const requireHasDriverLicense = this.filters.hasDriverLicense;
    const requireFoodAllergies = this.filters.foodAllergies;
    const requireBeeAllergies = this.filters.beeAllergies;
    const requireEnrolledInGed = this.filters.enrolledInGed;
    const requireTutoring = this.filters.tutoring;

    return list.filter((s) => {
      if (constrainProgram) {
        const prog = (s.program || '').trim();
        if (!selectedPrograms.includes(prog as ProgramFilter)) return false;
      }

      if (requireIsFelon && !(s as any).isFelon) return false;
      if (requireOnProbation && !(s as any).onProbation) return false;
      if (requireUsesNicotine && !(s as any).usesNicotine) return false;
      if (requireHasDriverLicense && !(s as any).hasDriverLicense) return false;
      if (requireFoodAllergies && !(s as any).foodAllergies) return false;
      if (requireBeeAllergies && !(s as any).beeAllergies) return false;
      if (requireEnrolledInGed && !(s as any).enrolledInGed) return false;
      if (requireTutoring && !(s as any).tutoring) return false;

      return true;
    });
  }

  private sortStudents(list: Student[], option: SortOption): Student[] {
    const copy = [...list];
    const safeString = (v: unknown) => (v ?? '').toString().trim().toLowerCase();

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
      return Number.isFinite(ms) ? ms : Number.NEGATIVE_INFINITY;
    };

    const getDayOutMs = (s: Student) => {
      const ms = toTime((s as any).dayout);
      return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
    };

    copy.sort((a: Student, b: Student) => {
      switch (option) {
        case 'alpha': {
          const af = safeString(a.firstName);
          const bf = safeString(b.firstName);
          if (af !== bf) return af.localeCompare(bf);

          const al = safeString(a.lastName);
          const bl = safeString(b.lastName);
          if (al !== bl) return al.localeCompare(bl);

          const aid = safeString((a as any).idNumber);
          const bid = safeString((b as any).idNumber);
          return aid.localeCompare(bid);
        }

        case 'lastName': {
          const al = safeString(a.lastName);
          const bl = safeString(b.lastName);
          if (al !== bl) return al.localeCompare(bl);

          const af = safeString(a.firstName);
          const bf = safeString(b.firstName);
          if (af !== bf) return af.localeCompare(bf);

          const aid = safeString((a as any).idNumber);
          const bid = safeString((b as any).idNumber);
          return aid.localeCompare(bid);
        }

        case 'dayIn': {
          const ad = getDayInMs(a);
          const bd = getDayInMs(b);
          if (ad !== bd) return bd - ad;

          const af = safeString(a.firstName);
          const bf = safeString(b.firstName);
          if (af !== bf) return af.localeCompare(bf);
          return safeString(a.lastName).localeCompare(safeString(b.lastName));
        }

        case 'dayOut': {
          const ad = getDayOutMs(a);
          const bd = getDayOutMs(b);
          if (ad !== bd) return ad - bd;

          const af = safeString(a.firstName);
          const bf = safeString(b.firstName);
          if (af !== bf) return af.localeCompare(bf);
          return safeString(a.lastName).localeCompare(safeString(b.lastName));
        }

        case 'program': {
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
