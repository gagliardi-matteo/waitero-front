import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModificaPiattoComponent } from './modifica-piatto.component';

describe('ModificaPiattoComponent', () => {
  let component: ModificaPiattoComponent;
  let fixture: ComponentFixture<ModificaPiattoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModificaPiattoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ModificaPiattoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
