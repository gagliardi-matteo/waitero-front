import { DOCUMENT } from '@angular/common';
import { inject, Injectable, OnDestroy } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ExplainTooltipOverlayService implements OnDestroy {
  private document = inject(DOCUMENT);
  private tooltipElement: HTMLDivElement | null = null;
  private activeOwner: HTMLElement | null = null;

  private readonly hideOnViewportChange = () => this.forceHide();

  show(owner: HTMLElement, text: string): void {
    if (!this.canUseDom()) {
      return;
    }

    const normalized = text.trim();
    if (!normalized) {
      this.hide(owner);
      return;
    }

    if (!this.tooltipElement) {
      this.tooltipElement = this.document.createElement('div');
      this.tooltipElement.className = 'explain-tooltip-overlay';
    }

    if (!this.tooltipElement.isConnected) {
      this.document.body.appendChild(this.tooltipElement);
    }

    this.activeOwner = owner;
    this.tooltipElement.textContent = normalized;
    this.tooltipElement.style.visibility = 'hidden';
    this.positionTooltip(owner);
    this.tooltipElement.style.visibility = 'visible';

    window.addEventListener('scroll', this.hideOnViewportChange, true);
    window.addEventListener('resize', this.hideOnViewportChange);
  }

  hide(owner?: HTMLElement): void {
    if (owner && this.activeOwner !== owner) {
      return;
    }
    this.forceHide();
  }

  ngOnDestroy(): void {
    this.forceHide();
  }

  private positionTooltip(owner: HTMLElement): void {
    if (!this.tooltipElement) {
      return;
    }

    const rect = owner.getBoundingClientRect();
    const pad = 12;
    const gap = 10;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const viewportWidth = this.document.documentElement.clientWidth;
    const tooltipWidth = this.tooltipElement.offsetWidth;
    const tooltipHeight = this.tooltipElement.offsetHeight;

    let left = rect.left + scrollX + (rect.width / 2) - (tooltipWidth / 2);
    left = Math.max(scrollX + pad, Math.min(left, scrollX + viewportWidth - tooltipWidth - pad));

    let top = rect.top + scrollY - tooltipHeight - gap;
    if (top < scrollY + pad) {
      top = rect.bottom + scrollY + gap;
    }

    this.tooltipElement.style.left = `${left}px`;
    this.tooltipElement.style.top = `${top}px`;
  }

  private forceHide(): void {
    if (this.tooltipElement?.isConnected) {
      this.tooltipElement.remove();
    }
    this.activeOwner = null;

    if (this.canUseDom()) {
      window.removeEventListener('scroll', this.hideOnViewportChange, true);
      window.removeEventListener('resize', this.hideOnViewportChange);
    }
  }

  private canUseDom(): boolean {
    return typeof window !== 'undefined' && !!this.document?.body;
  }
}
