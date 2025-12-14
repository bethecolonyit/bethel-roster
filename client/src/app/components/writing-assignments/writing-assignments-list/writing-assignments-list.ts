import { ChangeDetectorRef, Component } from '@angular/core';
import { WritingAssignmentService } from '../../../services/writing-assignment.service';
import { MatCardModule } from '@angular/material/card';
import { WritingAssignmentListItem } from '../../../models/WritingAssignmentListItem';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule, NgFor, DatePipe } from '@angular/common';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltip } from '@angular/material/tooltip';


@Component({
  selector: 'app-writing-assignments-list',
  imports: [MatCardModule, CommonModule, NgFor, DatePipe, MatIconModule, MatMenuModule, MatTooltip],
  templateUrl: './writing-assignments-list.html',
  styleUrl: './writing-assignments-list.scss',
  standalone: true,
})
export class WritingAssignmentsList {
  public assignmentsDue : WritingAssignmentListItem[] = [];

  constructor(private service : WritingAssignmentService, private cdr : ChangeDetectorRef) {
    this.loadWritingAssignmentsDue();
  }
  

  loadWritingAssignmentsDue() {
    this.service.getAllWritingAssignments().subscribe({
      next: (data) => {
        this.assignmentsDue = data;
        this.cdr.detectChanges();
      }
    })
  }
  onExtendDueDate(assignment : WritingAssignmentListItem) {

  }

  onMarkAssignmentComplete(assignment : WritingAssignmentListItem) {

  }
  emptyFunction() {

  }


}
