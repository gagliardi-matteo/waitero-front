import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class WaiterAlertAudioService {
  private audioContext: AudioContext | null = null;
  private lastWaiterCallPlayedAt = 0;
  private lastNewOrderPlayedAt = 0;

  async playWaiterCallAlert(): Promise<void> {
    const context = await this.ensureAudioContext();
    if (!context) {
      return;
    }

    const now = Date.now();
    if (now - this.lastWaiterCallPlayedAt < 1500) {
      return;
    }
    this.lastWaiterCallPlayedAt = now;

    this.scheduleTone(880, 0, 0.14, 0.07);
    this.scheduleTone(1174, 0.2, 0.16, 0.08);
    this.scheduleTone(880, 0.44, 0.2, 0.1);
  }

  async playNewOrderAlert(): Promise<void> {
    const context = await this.ensureAudioContext();
    if (!context) {
      return;
    }

    const now = Date.now();
    if (now - this.lastNewOrderPlayedAt < 1200) {
      return;
    }
    this.lastNewOrderPlayedAt = now;

    this.scheduleTone(698, 0, 0.12, 0.06);
    this.scheduleTone(880, 0.16, 0.12, 0.07);
    this.scheduleTone(1047, 0.32, 0.18, 0.09);
  }

  private async ensureAudioContext(): Promise<AudioContext | null> {
    if (typeof window === 'undefined') {
      return null;
    }

    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) {
      return null;
    }

    this.audioContext ??= new AudioContextCtor();
    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch {
        return null;
      }
    }

    return this.audioContext;
  }

  private scheduleTone(frequency: number, offsetSeconds: number, durationSeconds: number, gainValue: number): void {
    if (!this.audioContext) {
      return;
    }

    const context = this.audioContext;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const startAt = context.currentTime + offsetSeconds;
    const endAt = startAt + durationSeconds;

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, startAt);

    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(gainValue, startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start(startAt);
    oscillator.stop(endAt + 0.02);
  }
}
