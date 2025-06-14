import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MenuService } from '../../services/menu.service';
import { CategoriaPiatto, PiattoDTO } from '../../types';
import { AsyncPipe, NgFor, NgIf } from '@angular/common';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [CommonModule, NgIf, NgFor],
  templateUrl: './menu.component.html',
})
export class MenuComponent implements OnInit {
  private readonly menuService = inject(MenuService);

  categorie: CategoriaPiatto[] = [];
  piatti: PiattoDTO[] = [];

  ngOnInit(): void {
    this.menuService.getCategorie().subscribe(c => this.categorie = c);
    this.menuService.getPiatti().subscribe(p => this.piatti = p);
  }

  getPiattiByCategoria(categoriaId: number): PiattoDTO[] {
    return this.piatti.filter(p => p.categoriaId === categoriaId);
  }
}
