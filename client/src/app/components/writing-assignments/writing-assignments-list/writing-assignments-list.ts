import { ChangeDetectorRef, Component } from '@angular/core';
import { WritingAssignmentService } from '../../../services/writing-assignment.service';
import { MatCardModule } from '@angular/material/card';
import { WritingAssignmentListItem } from '../../../models/WritingAssignmentListItem';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule, NgFor, DatePipe } from '@angular/common';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltip } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';


@Component({
  selector: 'app-writing-assignments-list',
  imports: [MatCardModule, CommonModule, NgFor, DatePipe, MatIconModule, MatMenuModule, MatTooltip],
  templateUrl: './writing-assignments-list.html',
  styleUrl: './writing-assignments-list.scss',
  standalone: true,
})
export class WritingAssignmentsList {
  public assignmentsDue : WritingAssignmentListItem[] = [];

  constructor(private service : WritingAssignmentService, private cdr : ChangeDetectorRef, private snack: MatSnackBar) {
    this.loadWritingAssignmentsDue();
  }
  

  loadWritingAssignmentsDue() {
    this.service.getAllWritingAssignmentsDue().subscribe({
      next: (data) => {
        this.assignmentsDue = data;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(err);
      }
    })
  }
onExtendDueDate(assignment: WritingAssignmentListItem) {
  const confirmed = window.confirm(
    'Are you sure you would like to extend this assignment by 24 hours?'
  );
  if (!confirmed) return;

  // Ensure we are working with a Date object
  const currentDueDate = new Date(assignment.dateDue);

  // Add 24 hours (24 * 60 * 60 * 1000 ms)
  const extendedDueDate = new Date(currentDueDate.getTime() + 24 * 60 * 60 * 1000);

  // Assign back (keep as Date or convert to ISO string based on backend expectations)
  assignment.dateDue = extendedDueDate;

  this.service.updateWritingAssignment(assignment.id!, assignment).subscribe({
    next: () => {
      this.snack.open('Assignment Due Date Extended by 24 Hours', 'Close', {
        duration: 3000
      });
      this.loadWritingAssignmentsDue();
    },
    error: err => {
      console.error(err);
      this.snack.open('An Error Occurred', 'Close', { duration: 3000 });
    }
  });
}
  onMarkAssignmentComplete(assignment : WritingAssignmentListItem) {
    const confirmed = window.confirm(`Are you sure you would like to mark this assignment as complete?`);
    if (!confirmed) return;
    assignment.isComplete = true;
   this.service.updateWritingAssignment(assignment.id!, assignment).subscribe({
    next: () => {
      this.snack.open(`Assigment Marked Complete`, 'close', {duration: 3000});
      this.loadWritingAssignmentsDue();
    },
    error: (err) => {
      console.error(err);
      this.snack.open('An Error Occurred', 'Close', {duration: 3000});
    }
  })

  }
  emptyFunction() {

  }


}
