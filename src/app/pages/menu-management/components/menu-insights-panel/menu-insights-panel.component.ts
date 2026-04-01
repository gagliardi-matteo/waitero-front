import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-menu-insights-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './menu-insights-panel.component.html',
  styleUrl: './menu-insights-panel.component.scss'
})
export class MenuInsightsPanelComponent {
  @Input() topPerformerCount = 0;
  @Input() optimizationCount = 0;
  @Input() upsellOpportunityCount = 0;
}
