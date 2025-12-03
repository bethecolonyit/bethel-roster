import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Residential } from './residential';

describe('Residential', () => {
  let component: Residential;
  let fixture: ComponentFixture<Residential>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Residential]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Residential);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
