import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModificaPiattoComponent } from './modifica-piatto.component';

describe('ModificaPiattoComponent', () => {
  let component: ModificaPiattoComponent;
  let fixture: ComponentFixture<ModificaPiattoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModificaPiattoComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
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
