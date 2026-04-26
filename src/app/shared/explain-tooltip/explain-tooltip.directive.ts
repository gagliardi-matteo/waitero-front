import { Directive, ElementRef, HostListener, inject, Input, OnDestroy } from '@angular/core';
import { ExplainTooltipOverlayService } from './explain-tooltip-overlay.service';

@Directive({
  selector: '[appExplainTooltip]',
  standalone: true
})
export class ExplainTooltipDirective implements OnDestroy {
  private elementRef = inject(ElementRef<HTMLElement>);
  private overlayService = inject(ExplainTooltipOverlayService);

  @Input('appExplainTooltip') content = '';
  @Input() explainTooltipEnabled = false;

  @HostListener('mouseenter')
  onMouseEnter(): void {
    this.showTooltip();
  }

  @HostListener('mouseleave')
  onMouseLeave(): void {
    this.overlayService.hide(this.elementRef.nativeElement);
  }

  @HostListener('focusin')
  onFocusIn(): void {
    this.showTooltip();
  }

  @HostListener('focusout')
  onFocusOut(): void {
    this.overlayService.hide(this.elementRef.nativeElement);
  }

  ngOnDestroy(): void {
    this.overlayService.hide(this.elementRef.nativeElement);
  }

  private showTooltip(): void {
    if (!this.explainTooltipEnabled) {
      return;
    }

    const normalized = this.content.trim();
    if (!normalized) {
      return;
    }

    this.overlayService.show(this.elementRef.nativeElement, normalized);
  }
}
