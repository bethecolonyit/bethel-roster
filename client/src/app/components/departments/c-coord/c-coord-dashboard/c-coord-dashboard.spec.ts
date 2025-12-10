import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CCoordDashboard } from './c-coord-dashboard';

describe('CCoordDashboard', () => {
  let component: CCoordDashboard;
  let fixture: ComponentFixture<CCoordDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CCoordDashboard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CCoordDashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
