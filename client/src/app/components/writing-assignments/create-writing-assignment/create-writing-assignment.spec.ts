import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateWritingAssignment } from './create-writing-assignment';

describe('CreateWritingAssignment', () => {
  let component: CreateWritingAssignment;
  let fixture: ComponentFixture<CreateWritingAssignment>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateWritingAssignment]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreateWritingAssignment);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
