import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { MenuCategory } from '../models/menu-category.model';

@Injectable({ providedIn: 'root' })
export class MenuCategoryService {
  private http = inject(HttpClient);

  getCategories(): Observable<MenuCategory[]> {
    return this.http.get<MenuCategory[]>(`${environment.apiUrl}/menu/categories`);
  }
}
