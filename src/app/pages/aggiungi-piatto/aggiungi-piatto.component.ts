import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import { response } from 'express';
import { AuthService } from '../../auth/AuthService';
import { CommonModule } from '@angular/common';
import { environment } from '../../../environments/environment';

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
      descrizione: ['']
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

  onSubmit(): void {
    if (this.dishForm.invalid) return;

    const userId = this.authService.getUserIdFromToken();
    if (!userId) {
      alert('Utente non autenticato');
      return;
    }

    const dto = {
      ...this.dishForm.value,
      categoria: this.dishForm.value.categoria.toUpperCase()
    };

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

}

