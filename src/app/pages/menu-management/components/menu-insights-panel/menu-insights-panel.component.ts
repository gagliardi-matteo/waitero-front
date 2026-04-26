import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ExplainTooltipDirective } from '../../../../shared/explain-tooltip/explain-tooltip.directive';

@Component({
  selector: 'app-menu-insights-panel',
  standalone: true,
  imports: [CommonModule, ExplainTooltipDirective],
  templateUrl: './menu-insights-panel.component.html',
  styleUrl: './menu-insights-panel.component.scss'
})
export class MenuInsightsPanelComponent {
  @Input() topPerformerCount = 0;
  @Input() optimizationCount = 0;
  @Input() upsellOpportunityCount = 0;
  @Input() explainabilityEnabled = false;

  topPerformerTooltip(): string {
    return [
      `Conteggio attuale: ${this.topPerformerCount}.`,
      "Conta i piatti con performanceLabel = 'top_performer'.",
      "La label viene assegnata dal backend se orderCount >= 5 oppure se views >= 10 e viewToOrderRate >= 15%.",
      'Segnali usati: view_dish per views e ordini reali da customer_orders/customer_order_items.'
    ].join('\n\n');
  }

  optimizationTooltip(): string {
    return [
      `Conteggio attuale: ${this.optimizationCount}.`,
      "Conta i piatti con performanceLabel = 'high_interest_low_conversion'.",
      'La label viene assegnata se il piatto ha almeno 10 view_dish ma zero ordini reali.',
      'Serve a evidenziare i piatti che attirano attenzione ma non chiudono la conversione.'
    ].join('\n\n');
  }

  upsellTooltip(): string {
    return [
      `Conteggio attuale: ${this.upsellOpportunityCount}.`,
      'La pagina lo calcola lato frontend con una regola semplice: numeroOrdini >= 3 oppure viewToCartRate >= 18%.',
      'viewToCartRate = add_to_cart / view_dish.',
      'Segnali usati: add_to_cart, view_dish e ordini reali.'
    ].join('\n\n');
  }
}
