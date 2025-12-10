import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectOfficeDashboard } from './project-office-dashboard';

describe('ProjectOfficeDashboard', () => {
  let component: ProjectOfficeDashboard;
  let fixture: ComponentFixture<ProjectOfficeDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectOfficeDashboard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProjectOfficeDashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
