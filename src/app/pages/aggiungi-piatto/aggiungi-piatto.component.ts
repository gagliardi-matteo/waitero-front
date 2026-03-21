import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../auth/AuthService';
import { CommonModule } from '@angular/common';
import { environment } from '../../../environments/environment';
import { STANDARD_ALLERGENS, buildStoredAllergens } from '../../shared/allergens';

@Component({
  selector: 'app-add-dish',
  standalone: true,
  imports: [ReactiveFormsModule, RouterModule, CommonModule],
  templateUrl: './aggiungi-piatto.component.html',
  styleUrl: './aggiungi-piatto.component.scss',
})
export class AddDishComponent {
  dishForm: FormGroup;
  selectedFile: File | null = null;
  previewUrl: string | null = null;
  standardAllergens = [...STANDARD_ALLERGENS];
  selectedAllergens = new Set<string>();

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router,
    private authService: AuthService
  ) {
    this.dishForm = this.fb.group({
      nome: ['', Validators.required],
      categoria: ['', Validators.required],
      prezzo: [0, [Validators.required, Validators.min(0)]],
      descrizione: [''],
      ingredienti: [''],
      allergeni: [''],
      allergeniCustom: [''],
      consigliato: [false]
    });

    this.dishForm.get('allergeniCustom')?.valueChanges.subscribe(() => {
      this.syncAllergensField();
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];

      const reader = new FileReader();
      reader.onload = () => {
        this.previewUrl = reader.result as string;
      };
      reader.readAsDataURL(this.selectedFile);
    }
  }

  toggleAllergen(allergen: string): void {
    if (this.selectedAllergens.has(allergen)) {
      this.selectedAllergens.delete(allergen);
    } else {
      this.selectedAllergens.add(allergen);
    }
    this.syncAllergensField();
  }

  isAllergenSelected(allergen: string): boolean {
    return this.selectedAllergens.has(allergen);
  }

  onSubmit(): void {
    if (this.dishForm.invalid) return;
    const allergeni = buildStoredAllergens(
      [...this.selectedAllergens],
      this.dishForm.get('allergeniCustom')?.value
    );
    this.dishForm.patchValue({ allergeni }, { emitEvent: false });

    const userId = this.authService.getUserIdFromToken();
    if (!userId) {
      alert('Utente non autenticato');
      return;
    }

    const rawValues = this.dishForm.getRawValue();
    const dto = {
      ...rawValues,
      categoria: rawValues.categoria.toUpperCase(),
      ingredienti: this.normalizeOptionalText(rawValues.ingredienti),
      allergeni: this.normalizeOptionalText(allergeni),
      consigliato: !!rawValues.consigliato
    };
    delete dto.allergeniCustom;

    const formData = new FormData();
    formData.append('dto', new Blob([JSON.stringify(dto)], { type: 'application/json' }));
    if (this.selectedFile) {
      formData.append('image', this.selectedFile);
    }

    this.http.post(`${environment.apiUrl}/menu/piatti/${userId}`, formData).subscribe({
      next: () => this.router.navigate(['/menu-management']),
      error: (err) => {
        console.error(err);
        alert('Errore durante il salvataggio del piatto');
      }
    });
  }

  private normalizeOptionalText(value: string | null | undefined): string | null {
    if (!value) {
      return null;
    }
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private syncAllergensField(): void {
    const allergeni = buildStoredAllergens(
      [...this.selectedAllergens],
      this.dishForm.get('allergeniCustom')?.value
    );
    this.dishForm.patchValue({ allergeni }, { emitEvent: false });
  }
}
