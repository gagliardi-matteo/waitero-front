import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AggiungiPiattoComponent } from './aggiungi-piatto.component';

describe('AggiungiPiattoComponent', () => {
  let component: AggiungiPiattoComponent;
  let fixture: ComponentFixture<AggiungiPiattoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AggiungiPiattoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AggiungiPiattoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
