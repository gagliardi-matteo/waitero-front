import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-menu-blocked',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './menu-blocked.component.html',
  styleUrl: './menu-blocked.component.scss'
})
export class MenuBlockedComponent {
  private readonly route = inject(ActivatedRoute);

  readonly message = this.route.snapshot.queryParamMap.get('message')
    || 'In questo momento non e possibile ordinare da questo tavolo. Scannerizza nuovamente in qr code del tavolo.';
}
