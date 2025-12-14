import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WritingAssignmentsList } from './writing-assignments-list'

describe('WritingAssignmentsList', () => {
  let component: WritingAssignmentsList;
  let fixture: ComponentFixture<WritingAssignmentsList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WritingAssignmentsList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WritingAssignmentsList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
