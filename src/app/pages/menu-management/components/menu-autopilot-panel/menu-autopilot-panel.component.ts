import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Piatto } from '../../../../models/piatto.model';

interface AutopilotCategoryPlan {
  categoria: string;
  spotlight: Piatto | null;
  nextDishes: Piatto[];
}

@Component({
  selector: 'app-menu-autopilot-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './menu-autopilot-panel.component.html',
  styleUrl: './menu-autopilot-panel.component.scss'
})
export class MenuAutopilotPanelComponent {
  @Input() recommendedCandidates: Piatto[] = [];
  @Input() optimizationQueue: Piatto[] = [];
  @Input() categoryPlans: AutopilotCategoryPlan[] = [];
  @Input() applyingAutopilot = false;
  @Output() applyRecommended = new EventEmitter<Event>();

  emitApply(event: Event): void {
    this.applyRecommended.emit(event);
  }

  trackDish(index: number, item: Piatto): number {
    return item.id;
  }

  trackPlan(index: number, plan: AutopilotCategoryPlan): string {
    return plan.categoria;
  }
}
