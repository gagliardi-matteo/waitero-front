import { Component, OnInit, inject, ViewChild, ElementRef, } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { PiattoService } from '../../services/piatto.service';
import { Piatto } from '../../models/piatto.model';
import { CategoriaEnum } from '../../models/categorie.enum';


@Component({
  selector: 'app-modifica-piatto',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './modifica-piatto.component.html',
  styleUrl: './modifica-piatto.component.scss',
})
export class ModificaPiattoComponent implements OnInit {
  form: FormGroup;
  piattoId!: number;
  loading = true;
  categorie = Object.entries(CategoriaEnum);
  imageUrlOriginale: string = 'assets/placeholder.jpg'; // immagine attuale salvata nel DB
  imagePreviewUrl: string = ''; // solo se si seleziona un nuovo file
  nuovaImmagine?: File;
  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private piattoService = inject(PiattoService);

  constructor() {
    this.form = this.fb.group({
      nome: ['', Validators.required],
      descrizione: [''],
      prezzo: [0, [Validators.required, Validators.min(0)]],
      disponibile: [true],
      imageUrl: [''],
      categoria: [null, Validators.required],
    });
  }

  ngOnInit(): void {
    this.piattoId = +this.route.snapshot.paramMap.get('id')!;

    // Carico il piatto da modificare
    this.piattoService.getById(this.piattoId).subscribe({
      next: (piatto: Piatto) => {
        this.form.patchValue(piatto);
        this.imageUrlOriginale = this.getImageUrl(piatto.imageUrl);
        this.loading = false;
      },
      error: () => this.router.navigate(['/menu-management']),
    });
  }

  onSubmit(): void {
  if (this.form.invalid) return;

  const values = this.form.value;

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
    return `http://localhost:8080/api/image/images/${imageUrl}`;
  }

  annullaNuovaImmagine(): void {
    this.nuovaImmagine = undefined;
    this.imagePreviewUrl = '';

    // Reset del file input
    if (this.fileInputRef?.nativeElement) {
      this.fileInputRef.nativeElement.value = '';
    }
  }


}
