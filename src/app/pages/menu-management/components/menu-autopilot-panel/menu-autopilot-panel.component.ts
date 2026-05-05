import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { Piatto } from '../../../../models/piatto.model';
import { ExplainTooltipDirective } from '../../../../shared/explain-tooltip/explain-tooltip.directive';
import { dishCategoryLabel } from '../../../../shared/dish-category';

interface AutopilotCategoryPlan {
  categoria: string;
  spotlight: Piatto | null;
  nextDishes: Piatto[];
}

@Component({
  selector: 'app-menu-autopilot-panel',
  standalone: true,
  imports: [CommonModule, ExplainTooltipDirective],
  templateUrl: './menu-autopilot-panel.component.html',
  styleUrl: './menu-autopilot-panel.component.scss'
})
export class MenuAutopilotPanelComponent {
  @Input() recommendedCandidates: Piatto[] = [];
  @Input() optimizationQueue: Piatto[] = [];
  @Input() categoryPlans: AutopilotCategoryPlan[] = [];
  @Input() explainabilityEnabled = false;

  expanded = true;

  toggleExpanded(): void {
    this.expanded = !this.expanded;
  }

  trackDish(index: number, item: Piatto): number {
    return item.id;
  }

  trackPlan(index: number, plan: AutopilotCategoryPlan): string {
    return plan.categoria;
  }

  categoryLabel(item: Piatto): string {
    return dishCategoryLabel(item);
  }

  recommendedSectionTooltip(): string {
    return [
      'Questa lista e calcolata lato frontend.',
      "Formula ranking: 38% ordini normalizzati + 26% viewToOrderRate + 18% viewToCartRate + 10% views + 8% prezzo + 6% bonus se gia consigliato.",
      "Poi filtra i piatti non gia consigliati e scarta quelli con performanceLabel = 'high_interest_low_conversion'.",
      'Infine prende i primi 3 candidati.'
    ].join('\n\n');
  }

  recommendedDishTooltip(item: Piatto): string {
    return [
      `${item.nome}.`,
      'Candidato locale per essere spinto nel menu.',
      `Valori usati dal ranking: ordini ${item.numeroOrdini ?? 0}, viewToOrderRate ${this.formatPercent(item.viewToOrderRate)}, viewToCartRate ${this.formatPercent(item.viewToCartRate)}, views ${item.views ?? 0}, prezzo ${item.prezzo ?? 0}.`,
      `Label corrente: ${item.performanceLabel ?? 'stable'}.`
    ].join('\n\n');
  }

  optimizationSectionTooltip(): string {
    return [
      "Questa lista prende i piatti con performanceLabel = 'high_interest_low_conversion'.",
      'La label arriva dal backend quando views >= 10 e orderCount = 0.',
      'La coda viene poi ordinata per views decrescenti e limitata ai primi 3.'
    ].join('\n\n');
  }

  optimizationDishTooltip(item: Piatto): string {
    return [
      `${item.nome}.`,
      'E presente qui perche ha tanta esposizione ma non chiude ordini.',
      `Valori attuali: views ${item.views ?? 0}, ordini ${item.numeroOrdini ?? 0}, clicks ${item.clicks ?? 0}, addToCart ${item.addToCart ?? 0}.`
    ].join('\n\n');
  }

  categoryPlanTooltip(plan: AutopilotCategoryPlan): string {
    return [
      `Categoria ${plan.categoria}.`,
      'L ordine suggerito e puramente locale alla UI: prende i piatti della categoria, li ranka con la stessa formula di score e propone spotlight + due successivi.',
      'Non parte nessuna scrittura backend finche non fai azioni manuali su quei piatti.'
    ].join('\n\n');
  }

  categoryPlanDishTooltip(item: Piatto, spotlight: boolean): string {
    return [
      `${item.nome}.`,
      spotlight ? 'Primo piatto consigliato nella categoria.' : 'Piatto suggerito subito dopo lo spotlight.',
      `Motivi principali: ordini ${item.numeroOrdini ?? 0}, conversione ${this.formatPercent(item.viewToOrderRate)}, addToCart rate ${this.formatPercent(item.viewToCartRate)}, views ${item.views ?? 0}.`
    ].join('\n\n');
  }

  private formatPercent(value: number | undefined): string {
    return `${((value ?? 0) * 100).toFixed(1)}%`;
  }

  collapseButtonTooltip(): string {
    return [
      'Azione UI locale.',
      "Espande o comprime soltanto il pannello Autopilot menu.",
      'Non richiama API e non modifica dati.'
    ].join('\n\n');
  }
}
