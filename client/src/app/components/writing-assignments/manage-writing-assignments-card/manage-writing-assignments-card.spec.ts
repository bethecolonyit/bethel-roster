import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManageWritingAssignmentsCard } from './manage-writing-assignments-card';

describe('ManageWritingAssignmentsCard', () => {
  let component: ManageWritingAssignmentsCard;
  let fixture: ComponentFixture<ManageWritingAssignmentsCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManageWritingAssignmentsCard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ManageWritingAssignmentsCard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
