import { Component, OnInit, inject, ViewChild, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PiattoService } from '../../services/piatto.service';
import { DishPortion, Piatto } from '../../models/piatto.model';
import { environment } from '../../../environments/environment';
import { STANDARD_ALLERGENS, buildStoredAllergens, splitStoredAllergens } from '../../shared/allergens';
import { BrandLoaderComponent } from '../../shared/brand-loader/brand-loader.component';
import { MenuCategory } from '../../models/menu-category.model';
import { MenuCategoryService } from '../../services/menu-category.service';
import { forkJoin } from 'rxjs';

interface PortionFormRow {
  label: string;
  price: number | null;
}

@Component({
  selector: 'app-modifica-piatto',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, BrandLoaderComponent, FormsModule],
  templateUrl: './modifica-piatto.component.html',
  styleUrl: './modifica-piatto.component.scss',
})
export class ModificaPiattoComponent implements OnInit {
  readonly dishImagesEnabled = (environment as any).features?.dishImagesEnabled ?? false;
  form: FormGroup;
  piattoId!: number;
  loading = true;
  categorie: MenuCategory[] = [];
  imageUrlOriginale: string = 'assets/placeholder.jpg';
  imagePreviewUrl: string = '';
  nuovaImmagine?: File;
  standardAllergens = [...STANDARD_ALLERGENS];
  selectedAllergens = new Set<string>();
  portionRows: PortionFormRow[] = [];
  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private piattoService = inject(PiattoService);
  private categoryService = inject(MenuCategoryService);

  constructor() {
    this.form = this.fb.group({
      nome: ['', Validators.required],
      descrizione: [''],
      ingredienti: [''],
      allergeni: [''],
      allergeniCustom: [''],
      prezzo: [0, [Validators.min(0)]],
      disponibile: [true],
      consigliato: [false],
      imageUrl: [''],
      categoriaId: [null, Validators.required],
    });

    this.form.get('allergeniCustom')?.valueChanges.subscribe(() => {
      this.syncAllergensField();
    });
  }

  ngOnInit(): void {
    this.piattoId = +this.route.snapshot.paramMap.get('id')!;

    forkJoin({
      piatto: this.piattoService.getById(this.piattoId),
      categories: this.categoryService.getCategories()
    }).subscribe({
      next: ({ piatto, categories }) => {
        this.categorie = categories;
        const parsedAllergens = splitStoredAllergens(piatto.allergeni);
        this.selectedAllergens = new Set(parsedAllergens.standard);
        this.form.patchValue({
          ...piatto,
          categoriaId: piatto.categoriaId ?? null,
          consigliato: !!piatto.consigliato,
          allergeniCustom: parsedAllergens.custom.join(', ')
        });
        this.portionRows = (piatto.porzioni ?? []).map(portion => ({
          label: portion.label,
          price: portion.price
        }));
        this.syncAllergensField();
        this.imageUrlOriginale = this.getImageUrl(piatto.imageUrl);
        this.loading = false;
      },
      error: () => this.router.navigate(['/menu-management']),
    });
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
    if (this.form.invalid) return;
    const allergeni = buildStoredAllergens(
      [...this.selectedAllergens],
      this.form.get('allergeniCustom')?.value
    );
    this.form.patchValue({ allergeni }, { emitEvent: false });

    const rawValues = this.form.getRawValue();
    const porzioni = this.buildPortionsPayload();
    const prezzoBase = this.resolveBasePrice(rawValues.prezzo, porzioni);
    if (prezzoBase === null) {
      alert('Inserisci un prezzo singolo oppure almeno una porzione valida.');
      return;
    }

    const values = {
      ...rawValues,
      prezzo: prezzoBase,
      porzioni,
      categoriaId: rawValues.categoriaId,
      ingredienti: this.normalizeOptionalText(rawValues.ingredienti),
      allergeni: this.normalizeOptionalText(allergeni),
      consigliato: !!rawValues.consigliato
    };
    delete values.allergeniCustom;

    if (this.nuovaImmagine) {
      const formData = new FormData();
      formData.append('file', this.nuovaImmagine);
      formData.append('dto', new Blob([JSON.stringify(values)], { type: 'application/json' }));

      this.piattoService.updateConImmagine(this.piattoId, formData).subscribe({
        next: () => this.router.navigate(['/menu-management']),
      });
    } else {
      this.piattoService.update(this.piattoId, values).subscribe({
        next: () => this.router.navigate(['/menu-management']),
      });
    }
  }

  onImageSelected(event: Event): void {
    const fileInput = event.target as HTMLInputElement;
    if (!fileInput.files?.length) return;

    const file = fileInput.files[0];
    this.nuovaImmagine = file;

    const reader = new FileReader();
    reader.onload = () => {
      this.imagePreviewUrl = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  getImageUrl(imageUrl: string | null | undefined): string {
    if (!imageUrl || imageUrl.trim() === '' || imageUrl === 'assets/placeholder.jpg') {
      return '/placeholder.png';
    }
    return `${environment.apiUrl}/image/images/${imageUrl}`;
  }

  annullaNuovaImmagine(): void {
    this.nuovaImmagine = undefined;
    this.imagePreviewUrl = '';

    if (this.fileInputRef?.nativeElement) {
      this.fileInputRef.nativeElement.value = '';
    }
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
      this.form.get('allergeniCustom')?.value
    );
    this.form.patchValue({ allergeni }, { emitEvent: false });
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


