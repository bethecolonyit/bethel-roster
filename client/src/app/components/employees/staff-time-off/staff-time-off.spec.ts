import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StaffTimeOff } from './staff-time-off';

describe('StaffTimeOff', () => {
  let component: StaffTimeOff;
  let fixture: ComponentFixture<StaffTimeOff>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StaffTimeOff]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StaffTimeOff);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
