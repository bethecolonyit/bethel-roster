import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OfficeDashboard } from './office-dashboard';

describe('OfficeDashboard', () => {
  let component: OfficeDashboard;
  let fixture: ComponentFixture<OfficeDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OfficeDashboard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OfficeDashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
