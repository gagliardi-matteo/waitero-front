import { Component, OnInit, inject, ViewChild, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { PiattoService } from '../../services/piatto.service';
import { Piatto } from '../../models/piatto.model';
import { environment } from '../../../environments/environment';
import { STANDARD_ALLERGENS, buildStoredAllergens, splitStoredAllergens } from '../../shared/allergens';
import { BrandLoaderComponent } from '../../shared/brand-loader/brand-loader.component';
import { MenuCategory } from '../../models/menu-category.model';
import { MenuCategoryService } from '../../services/menu-category.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-modifica-piatto',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, BrandLoaderComponent],
  templateUrl: './modifica-piatto.component.html',
  styleUrl: './modifica-piatto.component.scss',
})
export class ModificaPiattoComponent implements OnInit {
  form: FormGroup;
  piattoId!: number;
  loading = true;
  categorie: MenuCategory[] = [];
  imageUrlOriginale: string = 'assets/placeholder.jpg';
  imagePreviewUrl: string = '';
  nuovaImmagine?: File;
  standardAllergens = [...STANDARD_ALLERGENS];
  selectedAllergens = new Set<string>();
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
      prezzo: [0, [Validators.required, Validators.min(0)]],
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
    const values = {
      ...rawValues,
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
}


