import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CounselingDashboard } from './counseling-dashboard';

describe('CounselingDashboard', () => {
  let component: CounselingDashboard;
  let fixture: ComponentFixture<CounselingDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CounselingDashboard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CounselingDashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
