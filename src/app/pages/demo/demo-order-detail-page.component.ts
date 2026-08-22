import { Component } from '@angular/core';
import { OrderDetailComponent } from '../order-detail/order-detail.component';
import { DemoBannerComponent } from './demo-banner.component';

@Component({
  selector: 'app-demo-order-detail-page',
  standalone: true,
  imports: [OrderDetailComponent, DemoBannerComponent],
  template: `<app-demo-banner/><app-order-detail/>`
})
export class DemoOrderDetailPageComponent {}
