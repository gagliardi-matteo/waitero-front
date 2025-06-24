import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../../util/sidebar/sidebar.component';
import { RouterModule } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { AuthService } from '../../auth/AuthService';
import { Piatto } from '../../models/piatto.model';

@Component({
  selector: 'app-menu-management',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './menu-management.component.html',
  styleUrl: './menu-management.component.scss',
})
export class MenuManagementComponent implements OnInit {
  piatti: Piatto[] = [];
  userId: number | null = null;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.userId = this.authService.getUserIdFromToken();
    if (!this.userId) {
      alert('Utente non autenticato');
      return;
    }

    this.http.get<Piatto[]>(`http://localhost:8080/api/menu/piattiRistoratore/${this.userId}`)
      .subscribe({
        next: (data: any[]) => this.piatti = data,
        error: (err) => console.error('Errore caricamento piatti:', err)
      });
  }

  get menuByCategory(): [string, Piatto[]][] {
    const categoriaOrder: string[] = [
      'ANTIPASTO',
      'PRIMO',
      'SECONDO',
      'CONTORNO',
      'DOLCE',
      'BEVANDA',
    ];

    const normalizeCategoria = (raw: string | null | undefined): string => {
      if (!raw) return 'SENZA CATEGORIA';
      return raw.trim().toUpperCase();
    };

    const map = new Map<string, Piatto[]>();

    for (const item of this.piatti) {
      const categoria = normalizeCategoria(item.categoria);
      if (!map.has(categoria)) {
        map.set(categoria, []);
      }
      map.get(categoria)!.push(item);
    }

    const sortedEntries: [string, Piatto[]][] = Array.from(map.entries())
      .sort((a, b) => {
        const indexA = categoriaOrder.indexOf(a[0]);
        const indexB = categoriaOrder.indexOf(b[0]);
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
      })
      .map(([categoria, items]) => {
        const sortedItems = items.sort((a, b) => a.id - b.id);
        return [categoria, sortedItems] as [string, Piatto[]];
      });

    return sortedEntries;
  }



  getImageUrl(imageUrl: string | null | undefined): string {
    if (!imageUrl || imageUrl.trim() === '') {
      return '/placeholder.png'; // ✅ immagine locale fallback
    }
    return `http://localhost:8080/api/image/images/${imageUrl}`;
  }

}
