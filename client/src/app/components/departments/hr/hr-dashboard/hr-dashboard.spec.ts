import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HrDashboardComponent } from './hr-dashboard';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { MatSnackBarModule } from '@angular/material/snack-bar';

describe('HrDashboardComponent', () => {
  let component: HrDashboardComponent;
  let fixture: ComponentFixture<HrDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, ReactiveFormsModule, MatSnackBarModule],
      declarations: [HrDashboardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HrDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
