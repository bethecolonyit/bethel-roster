import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { Student } from '../../../models/student';
import { AuthService } from '../../../services/auth';
import { StudentCard } from '../../students/student-card/student-card';
import { WritingAssignmentService } from '../../../services/writing-assignment.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { StudentService } from '../../../services/student.service';



@Component({
  selector: 'app-create-writing-assignment',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    StudentCard
  ],
  templateUrl: './create-writing-assignment.html',
  styleUrls: ['./create-writing-assignment.scss'],
})
export class CreateWritingAssignment implements OnInit {
  student: Student = {} as Student;
  studentId! : number;

  dateIssued: Date;
  dateDue: Date;

  isComplete = false;

  // form-bound fields
  model = {
    infraction: '',
    scripture: '',
    demerits: 1,
  };

  constructor
  (
    private auth: AuthService,
    private studentService : StudentService, 
    private service : WritingAssignmentService, 
    private snack: MatSnackBar, 
    private router: Router, 
    private route : ActivatedRoute,
    private cdr : ChangeDetectorRef
  ) 
  {
    const today = new Date();
    this.dateIssued = today;
    this.dateDue = new Date(today);
    this.dateDue.setDate(today.getDate() + 1);
  }

  ngOnInit(): void {
     this.studentId = Number(this.route.snapshot.paramMap.get('id'));

    this.getStudent();

  }
   
  getStudent() {
    this.studentService.getStudentById(this.studentId).subscribe({
      next: (data) => {
        this.student = data;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error fetching student:', error);
      },
    })
  }
   

onSubmitBasic(form: NgForm): void {
  if (form.invalid) return;

  const formData = new FormData();

  // Required IDs
  formData.append('studentId', String(this.student.id));

 const ymd = (d: Date) => d.toISOString().split('T')[0];
formData.append('dateIssued', ymd(this.dateIssued));
formData.append('dateDue', ymd(this.dateDue));

  // Booleans / numbers should be strings in FormData
  formData.append('isComplete', String(this.isComplete));
  formData.append('infraction', this.model.infraction);
  formData.append('scripture', this.model.scripture);
  formData.append('demerits', String(this.model.demerits));

  this.service.createWritingAssignment(formData).subscribe({
    next: (result) => {
      console.log('Writing assignment created:', result);
       this.router.navigate(['/students']).then(() => {
        // Show snack AFTER navigation completes
        this.snack.open(`Write up submitted for ${this.student.firstName} ${this.student.lastName}`, 'Close', {
          duration: 3000
        });
      });

  

    },
    error: (err) => {
      console.error('Failed to create writing assignment', err);
    }
  });
}
}