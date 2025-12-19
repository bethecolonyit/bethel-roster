import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManageEmployees } from './manage-employees';

describe('ManageEmployees', () => {
  let component: ManageEmployees;
  let fixture: ComponentFixture<ManageEmployees>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManageEmployees]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ManageEmployees);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
