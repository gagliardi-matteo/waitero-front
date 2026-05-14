import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../auth/AuthService';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { STANDARD_ALLERGENS, buildStoredAllergens } from '../../shared/allergens';
import { MenuCategory } from '../../models/menu-category.model';
import { MenuCategoryService } from '../../services/menu-category.service';
import { DishPortion } from '../../models/piatto.model';

interface PortionFormRow {
  label: string;
  price: number | null;
}

@Component({
  selector: 'app-add-dish',
  standalone: true,
  imports: [ReactiveFormsModule, RouterModule, CommonModule, FormsModule],
  templateUrl: './aggiungi-piatto.component.html',
  styleUrl: './aggiungi-piatto.component.scss',
})
export class AddDishComponent {
  readonly dishImagesEnabled = (environment as any).features?.dishImagesEnabled ?? false;
  dishForm: FormGroup;
  selectedFile: File | null = null;
  previewUrl: string | null = null;
  standardAllergens = [...STANDARD_ALLERGENS];
  selectedAllergens = new Set<string>();
  categories: MenuCategory[] = [];
  portionRows: PortionFormRow[] = [];

  private categoryService = inject(MenuCategoryService);

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router,
    private authService: AuthService
  ) {
      this.dishForm = this.fb.group({
      nome: ['', Validators.required],
      categoriaId: [null, Validators.required],
      prezzo: [0, [Validators.min(0)]],
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

  ngOnInit(): void {
    this.categoryService.getCategories().subscribe({
      next: categories => {
        this.categories = categories;
      },
      error: err => {
        console.error('Errore caricamento categorie locale', err);
      }
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

    const userId = this.authService.getActingRestaurantId() ?? this.authService.getOwnedRestaurantId();
    if (!userId) {
      alert('Locale non disponibile');
      return;
    }

    const rawValues = this.dishForm.getRawValue();
    const porzioni = this.buildPortionsPayload();
    const prezzoBase = this.resolveBasePrice(rawValues.prezzo, porzioni);
    if (prezzoBase === null) {
      alert('Inserisci un prezzo singolo oppure almeno una porzione valida.');
      return;
    }

    const dto = {
      ...rawValues,
      prezzo: prezzoBase,
      porzioni,
      categoriaId: rawValues.categoriaId,
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

  addPortionRow(): void {
    this.portionRows = [...this.portionRows, { label: '', price: null }];
  }

  removePortionRow(index: number): void {
    this.portionRows = this.portionRows.filter((_, rowIndex) => rowIndex !== index);
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

  private buildPortionsPayload(): DishPortion[] {
    return this.portionRows
      .map(row => ({
        key: this.slugifyPortionKey(row.label),
        label: row.label.trim(),
        price: Number(row.price)
      }))
      .filter(row => row.label.length > 0 && Number.isFinite(row.price) && row.price >= 0);
  }

  private resolveBasePrice(rawPrice: unknown, porzioni: DishPortion[]): number | null {
    if (porzioni.length > 0) {
      return porzioni[0].price;
    }

    const numericPrice = Number(rawPrice);
    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      return null;
    }
    return numericPrice;
  }

  private slugifyPortionKey(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      || 'portion';
  }
}
