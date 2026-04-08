import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-brand-loader',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './brand-loader.component.html',
  styleUrl: './brand-loader.component.scss'
})
export class BrandLoaderComponent {
  @Input() label = 'Caricamento';
  @Input() hint = '';
  @Input() compact = false;
}
