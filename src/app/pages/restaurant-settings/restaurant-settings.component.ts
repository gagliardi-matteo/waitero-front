import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AbstractControl, FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AddressSuggestion, RestaurantServiceHour, RestaurantSettings, RestaurantSettingsService } from '../../services/restaurant-settings.service';
import { AuthService, BackofficeProfile } from '../../auth/AuthService';
import { BrandLoaderComponent } from '../../shared/brand-loader/brand-loader.component';
import { businessTypeLabel } from '../../models/business-type.model';
import { CreateSetupIntentResponse, RestaurantBillingAccountDto, RestaurantBillingService } from '../../services/restaurant-billing.service';
import { PLATFORM_ID } from '@angular/core';

type DuplicateMode = 'slot' | 'day';

interface StripeIbanElement {
  mount(selector: string | HTMLElement): void;
  destroy(): void;
}

interface StripeElementsInstance {
  create(type: 'iban', options?: Record<string, unknown>): StripeIbanElement;
}

interface StripeConfirmResult {
  error?: {
    message?: string;
  };
  setupIntent?: {
    id: string;
    status: string;
  };
}

interface StripeInstance {
  elements(): StripeElementsInstance;
  confirmSepaDebitSetup(clientSecret: string, data: {
    payment_method: {
      sepa_debit: StripeIbanElement;
      billing_details: {
        name: string;
        email?: string;
      };
    };
  }): Promise<StripeConfirmResult>;
}

declare global {
  interface Window {
    Stripe?: (publishableKey: string) => StripeInstance;
  }
}

@Component({
  selector: 'app-restaurant-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, BrandLoaderComponent],
  templateUrl: './restaurant-settings.component.html',
  styleUrl: './restaurant-settings.component.scss'
})
export class RestaurantSettingsComponent {
  loading = true;
  saving = false;
  savingProfile = false;
  changingPassword = false;
  searchingAddress = false;
  billingLoading = false;
  billingActionLoading = false;
  billingUnavailable = false;
  billingSetupVisible = false;
  errorMessage = '';
  successMessage = '';
  settings: RestaurantSettings | null = null;
  accountProfile: BackofficeProfile | null = null;
  billingAccount: RestaurantBillingAccountDto | null = null;
  addressSuggestions: AddressSuggestion[] = [];
  selectedSuggestion: AddressSuggestion | null = null;
  duplicateSourceIndex: number | null = null;
  duplicateMode: DuplicateMode = 'slot';
  duplicateTargets = new Set<string>();
  private newSlotControl: AbstractControl | null = null;

  private fb = inject(FormBuilder);
  private settingsService = inject(RestaurantSettingsService);
  private billingService = inject(RestaurantBillingService);
  private authService = inject(AuthService);
  private sanitizer = inject(DomSanitizer);
  private destroyRef = inject(DestroyRef);
  private platformId = inject(PLATFORM_ID);
  private stripeInstance: StripeInstance | null = null;
  private ibanElement: StripeIbanElement | null = null;
  private pendingSetupIntent: CreateSetupIntentResponse | null = null;

  readonly weekdays = [
    { value: 'MONDAY', label: 'Lunedi' },
    { value: 'TUESDAY', label: 'Martedi' },
    { value: 'WEDNESDAY', label: 'Mercoledi' },
    { value: 'THURSDAY', label: 'Giovedi' },
    { value: 'FRIDAY', label: 'Venerdi' },
    { value: 'SATURDAY', label: 'Sabato' },
    { value: 'SUNDAY', label: 'Domenica' }
  ];

  readonly form = this.fb.nonNullable.group({
    nome: ['', [Validators.required, Validators.maxLength(120)]],
    address: ['', [Validators.required, Validators.maxLength(255)]],
    city: ['', [Validators.maxLength(255)]],
    allowedRadiusMeters: [80, [Validators.required, Validators.min(20), Validators.max(500)]],
    serviceHours: this.fb.array([])
  });

  readonly accountForm = this.fb.nonNullable.group({
    nome: ['', [Validators.required, Validators.maxLength(120)]]
  });

  readonly passwordForm = this.fb.nonNullable.group({
    currentPassword: [''],
    newPassword: ['', [Validators.required, Validators.minLength(8)]]
  });

  readonly billingForm = this.fb.nonNullable.group({
    accountHolderName: ['', [Validators.required, Validators.maxLength(120)]]
  });

  constructor() {
    this.setupAddressAutocomplete();
    this.loadSettings();
    this.loadAccountProfile();
    this.loadBillingAccount();
    this.destroyRef.onDestroy(() => this.destroyIbanElement());
  }

  get serviceHoursArray(): FormArray {
    return this.form.controls.serviceHours;
  }

  get showAccountSettings(): boolean {
    return !this.authService.isMaster() && !this.authService.isImpersonating();
  }

  get showBillingSettings(): boolean {
    return isPlatformBrowser(this.platformId)
      && (!this.authService.isMaster() || this.authService.isImpersonating());
  }

  get billingConfigured(): boolean {
    return !!this.billingAccount?.defaultPaymentMethodId;
  }

  get duplicateSourceLabel(): string {
    if (this.duplicateSourceIndex === null) {
      return '';
    }
    const slot = this.getServiceHours()[this.duplicateSourceIndex];
    if (!slot) {
      return '';
    }
    const dayLabel = this.dayLabel(slot.dayOfWeek);
    return this.duplicateMode === 'day'
      ? `${dayLabel} (${slot.startTime}-${slot.endTime} e altre fasce del giorno)`
      : `${dayLabel} ${slot.startTime}-${slot.endTime}`;
  }

  get businessTypeDisplay(): string {
    return businessTypeLabel(this.settings?.businessType);
  }

  loadSettings(): void {
    this.loading = true;
    this.settingsService.getSettings().subscribe({
      next: settings => {
        this.settings = settings;
        this.selectedSuggestion = settings.address && settings.latitude && settings.longitude && settings.formattedAddress
          ? {
              address: settings.address,
              city: settings.city,
              formattedAddress: settings.formattedAddress,
              latitude: settings.latitude,
              longitude: settings.longitude,
              hasStreetNumber: this.containsStreetNumber(settings.address)
            }
          : null;
        this.form.patchValue({
          nome: settings.nome ?? '',
          address: settings.address ?? '',
          city: settings.city ?? '',
          allowedRadiusMeters: settings.allowedRadiusMeters ?? 80
        }, { emitEvent: false });
        if (!this.billingForm.controls.accountHolderName.value) {
          this.billingForm.patchValue({ accountHolderName: settings.nome ?? '' }, { emitEvent: false });
        }
        this.serviceHoursArray.clear();
        settings.serviceHours.forEach(slot => this.serviceHoursArray.push(this.createSlot(slot)));
        if (settings.serviceHours.length === 0) {
          this.serviceHoursArray.push(this.createSlot());
        }
        this.newSlotControl = null;
        this.cancelDuplicate();
        this.loading = false;
      },
      error: err => {
        console.error('Errore caricamento impostazioni locale', err);
        this.errorMessage = 'Impossibile caricare le impostazioni del locale.';
        this.loading = false;
      }
    });
  }

  loadAccountProfile(): void {
    if (!this.showAccountSettings) {
      return;
    }

    this.authService.getProfile().subscribe({
      next: profile => {
        this.accountProfile = profile;
        this.accountForm.patchValue({ nome: profile.nome ?? '' }, { emitEvent: false });
        this.billingForm.patchValue({ accountHolderName: profile.nome ?? '' }, { emitEvent: false });
        this.syncPasswordValidators(profile);
      },
      error: err => {
        console.error('Errore caricamento profilo account', err);
      }
    });
  }

  loadBillingAccount(): void {
    if (!this.showBillingSettings) {
      return;
    }

    this.billingLoading = true;
    this.billingUnavailable = false;
    this.billingService.getAccount().subscribe({
      next: account => {
        this.billingAccount = account;
        this.billingLoading = false;
      },
      error: err => {
        if (err.status === 404 || err.status === 500) {
          this.billingAccount = null;
          this.billingUnavailable = true;
          this.billingLoading = false;
          return;
        }
        console.error('Errore caricamento billing locale', err);
        this.errorMessage = err.error?.message ?? 'Impossibile caricare la configurazione di billing del locale.';
        this.billingLoading = false;
      }
    });
  }

  startSepaSetup(): void {
    if (!this.billingAccount?.billingEnabled || this.billingActionLoading) {
      return;
    }

    this.billingActionLoading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.destroyIbanElement();

    this.billingService.createSetupIntent().subscribe({
      next: async response => {
        if (!response.publishableKey) {
          this.errorMessage = 'Publishable key Stripe non configurata. Impostala nel backend prima di raccogliere l’IBAN.';
          this.billingActionLoading = false;
          return;
        }

        try {
          this.pendingSetupIntent = response;
          this.billingSetupVisible = true;
          await this.ensureStripeReady(response.publishableKey);
          queueMicrotask(() => {
            try {
              this.mountIbanElement();
            } finally {
              this.billingActionLoading = false;
            }
          });
        } catch (error) {
          console.error('Errore inizializzazione Stripe SEPA', error);
          this.errorMessage = 'Impossibile inizializzare il form IBAN Stripe.';
          this.billingSetupVisible = false;
          this.pendingSetupIntent = null;
          this.billingActionLoading = false;
        }
      },
      error: err => {
        console.error('Errore creazione setup intent', err);
        this.errorMessage = err.error?.message ?? 'Impossibile avviare la configurazione SEPA.';
        this.billingActionLoading = false;
      }
    });
  }

  async confirmSepaSetup(): Promise<void> {
    if (!this.pendingSetupIntent || !this.stripeInstance || !this.ibanElement) {
      this.errorMessage = 'Configurazione Stripe non pronta.';
      return;
    }
    if (this.billingForm.invalid) {
      this.billingForm.markAllAsTouched();
      this.errorMessage = 'Inserisci il nome intestatario del conto.';
      return;
    }
    const billingEmail = this.accountProfile?.email?.trim() || this.settings?.email?.trim() || '';
    if (!billingEmail) {
      this.errorMessage = 'Email del locale mancante. Serve un indirizzo email valido per creare il mandato SEPA Stripe.';
      return;
    }

    this.billingActionLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      const result = await this.stripeInstance.confirmSepaDebitSetup(this.pendingSetupIntent.clientSecret, {
        payment_method: {
          sepa_debit: this.ibanElement,
          billing_details: {
            name: this.billingForm.getRawValue().accountHolderName,
            email: billingEmail
          }
        }
      });

      if (result.error?.message) {
        this.errorMessage = result.error.message;
        this.billingActionLoading = false;
        return;
      }

      const setupIntentId = result.setupIntent?.id || this.pendingSetupIntent.setupIntentId;
      this.billingService.completeSetupIntent(setupIntentId).subscribe({
        next: account => {
          this.billingAccount = account;
          this.billingSetupVisible = false;
          this.pendingSetupIntent = null;
          this.destroyIbanElement();
          this.billingActionLoading = false;
          this.successMessage = 'Mandato SEPA configurato. Da ora il locale può essere addebitato automaticamente.';
        },
        error: err => {
          console.error('Errore completamento setup intent', err);
          this.errorMessage = err.error?.message ?? 'Stripe ha raccolto l\'IBAN, ma WaiterO non ha completato l\'associazione del mandato.';
          this.billingActionLoading = false;
        }
      });
    } catch (error) {
      console.error('Errore conferma SEPA Stripe', error);
      this.errorMessage = 'Conferma SEPA non riuscita.';
      this.billingActionLoading = false;
    }
  }

  cancelSepaSetup(): void {
    this.billingSetupVisible = false;
    this.pendingSetupIntent = null;
    this.destroyIbanElement();
  }

  saveAccountProfile(): void {
    if (this.accountForm.invalid) {
      this.accountForm.markAllAsTouched();
      this.errorMessage = 'Inserisci un nome account valido.';
      return;
    }

    this.savingProfile = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.authService.updateProfile(this.accountForm.getRawValue().nome).subscribe({
      next: profile => {
        this.accountProfile = profile;
        this.successMessage = 'Profilo account aggiornato.';
        this.savingProfile = false;
      },
      error: err => {
        console.error('Errore aggiornamento profilo account', err);
        this.errorMessage = err.error?.message ?? 'Aggiornamento profilo non riuscito.';
        this.savingProfile = false;
      }
    });
  }

  changePassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      this.errorMessage = this.accountProfile?.hasPassword
        ? 'Inserisci password attuale e nuova password di almeno 8 caratteri.'
        : 'Inserisci una nuova password di almeno 8 caratteri.';
      return;
    }

    const raw = this.passwordForm.getRawValue();
    this.changingPassword = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.authService.changePassword(raw.currentPassword, raw.newPassword).subscribe({
      next: profile => {
        this.accountProfile = profile;
        this.syncPasswordValidators(profile);
        this.passwordForm.reset();
        this.successMessage = 'Password aggiornata.';
        this.changingPassword = false;
      },
      error: err => {
        console.error('Errore cambio password', err);
        this.errorMessage = err.error?.message ?? 'Cambio password non riuscito.';
        this.changingPassword = false;
      }
    });
  }

  addSlot(): void {
    const control = this.createSlot();
    this.serviceHoursArray.insert(0, control);
    this.newSlotControl = control;
    this.cancelDuplicate();
  }

  removeSlot(index: number): void {
    if (this.serviceHoursArray.at(index) === this.newSlotControl) {
      this.newSlotControl = null;
    }
    this.serviceHoursArray.removeAt(index);
    if (this.duplicateSourceIndex === index) {
      this.cancelDuplicate();
    } else if (this.duplicateSourceIndex !== null && index < this.duplicateSourceIndex) {
      this.duplicateSourceIndex -= 1;
    }
    if (this.serviceHoursArray.length === 0) {
      this.addSlot();
    }
  }

  startDuplicate(index: number, mode: DuplicateMode): void {
    this.duplicateSourceIndex = index;
    this.duplicateMode = mode;
    this.duplicateTargets = new Set<string>();
    this.successMessage = '';
    this.errorMessage = '';
  }

  cancelDuplicate(): void {
    this.duplicateSourceIndex = null;
    this.duplicateMode = 'slot';
    this.duplicateTargets = new Set<string>();
  }

  isDuplicateTargetSelected(dayOfWeek: string): boolean {
    return this.duplicateTargets.has(dayOfWeek);
  }

  toggleDuplicateTarget(dayOfWeek: string): void {
    if (this.duplicateTargets.has(dayOfWeek)) {
      this.duplicateTargets.delete(dayOfWeek);
      return;
    }
    this.duplicateTargets.add(dayOfWeek);
  }

  applyDuplicate(): void {
    if (this.duplicateSourceIndex === null) {
      return;
    }

    const allSlots = this.getServiceHours();
    const sourceSlot = allSlots[this.duplicateSourceIndex];
    if (!sourceSlot) {
      return;
    }

    const sourceSlots = this.duplicateMode === 'day'
      ? allSlots.filter(slot => slot.dayOfWeek === sourceSlot.dayOfWeek)
      : [sourceSlot];

    const targetDays = [...this.duplicateTargets].filter(day => day !== sourceSlot.dayOfWeek);
    if (targetDays.length === 0) {
      this.errorMessage = 'Seleziona almeno un giorno di destinazione.';
      return;
    }

    let added = 0;
    let skipped = 0;
    const currentSlots = [...allSlots];

    for (const dayOfWeek of targetDays) {
      for (const slot of sourceSlots) {
        const candidate: RestaurantServiceHour = {
          dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime
        };
        if (this.hasOverlap(candidate, currentSlots)) {
          skipped += 1;
          continue;
        }
        currentSlots.push(candidate);
        this.serviceHoursArray.push(this.createSlot(candidate));
        added += 1;
      }
    }

    this.sortServiceHours();
    this.cancelDuplicate();

    if (added === 0) {
      this.errorMessage = 'Nessuna fascia duplicata: tutte le destinazioni erano gia occupate o in sovrapposizione.';
      return;
    }

    this.successMessage = skipped > 0
      ? `Duplicate ${added} fasce. Saltate ${skipped} per sovrapposizione.`
      : `Duplicate ${added} fasce con successo.`;
    this.errorMessage = '';
  }

  applySuggestion(suggestion: AddressSuggestion): void {
    this.selectedSuggestion = suggestion;
    this.form.patchValue({
      address: this.bestAddressValue(suggestion),
      city: suggestion.city ?? ''
    }, { emitEvent: false });
    this.addressSuggestions = [];
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage = 'Compila correttamente i campi richiesti.';
      return;
    }

    const raw = this.form.getRawValue();
    if (!this.containsStreetNumber(raw.address)) {
      this.errorMessage = 'Inserisci un indirizzo completo di numero civico.';
      return;
    }

    const selectedSuggestion = this.selectedSuggestion;
    const selectedSuggestionStillMatches = !!selectedSuggestion
      && this.bestAddressValue(selectedSuggestion) === raw.address
      && (selectedSuggestion.city ?? '') === (raw.city ?? '');

    if (!selectedSuggestionStillMatches || !selectedSuggestion.hasStreetNumber) {
      this.errorMessage = 'Seleziona un suggerimento Google con civico verificato prima di salvare.';
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.addressSuggestions = [];

    const serviceHours = (raw.serviceHours as RestaurantServiceHour[])
      .filter(slot => slot.dayOfWeek && slot.startTime && slot.endTime)
      .sort((left, right) => this.compareSlots(left, right));

    const invalidSlot = serviceHours.find(slot => slot.startTime === slot.endTime);
    if (invalidSlot) {
      this.errorMessage = `La fascia ${this.dayLabel(invalidSlot.dayOfWeek)} ${invalidSlot.startTime}-${invalidSlot.endTime} non e valida.`;
      return;
    }

    const overlapMessage = this.findOverlapMessage(serviceHours);
    if (overlapMessage) {
      this.errorMessage = overlapMessage;
      return;
    }

    const payload = {
      nome: raw.nome,
      address: raw.address,
      city: raw.city,
      allowedRadiusMeters: raw.allowedRadiusMeters,
      latitude: selectedSuggestion.latitude,
      longitude: selectedSuggestion.longitude,
      formattedAddress: selectedSuggestion.formattedAddress,
      hasStreetNumber: selectedSuggestion.hasStreetNumber,
      serviceHours
    };

    this.settingsService.updateSettings(payload).subscribe({
      next: settings => {
        this.settings = settings;
        this.successMessage = 'Impostazioni locale aggiornate.';
        this.saving = false;
        this.loadSettings();
      },
      error: err => {
        console.error('Errore aggiornamento impostazioni locale', err);
        this.errorMessage = err.error?.message ?? 'Aggiornamento impostazioni non riuscito.';
        this.saving = false;
      }
    });
  }

  mapEmbedUrl(): SafeResourceUrl | null {
    if (!this.settings?.latitude || !this.settings?.longitude) {
      return null;
    }

    const lat = this.settings.latitude;
    const lon = this.settings.longitude;
    const offset = 0.003;
    const bbox = [lon - offset, lat - offset, lon + offset, lat + offset].join('%2C');
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lon}`
    );
  }

  trackSuggestion(index: number, suggestion: AddressSuggestion): string {
    return `${suggestion.formattedAddress}-${index}`;
  }

  dayLabel(dayOfWeek: string): string {
    return this.weekdays.find(day => day.value === dayOfWeek)?.label ?? dayOfWeek;
  }

  isNewSlot(index: number): boolean {
    return this.serviceHoursArray.at(index) === this.newSlotControl;
  }

  logout(): void {
    this.authService.logout();
  }

  private syncPasswordValidators(profile: BackofficeProfile): void {
    const currentPasswordControl = this.passwordForm.controls.currentPassword;
    if (profile.hasPassword) {
      currentPasswordControl.setValidators([Validators.required]);
    } else {
      currentPasswordControl.clearValidators();
    }
    currentPasswordControl.updateValueAndValidity({ emitEvent: false });
  }
  private setupAddressAutocomplete(): void {
    this.form.controls.address.valueChanges.pipe(
      debounceTime(350),
      distinctUntilChanged(),
      switchMap(query => {
        this.selectedSuggestion = null;
        if (!query || query.trim().length < 3) {
          this.addressSuggestions = [];
          this.searchingAddress = false;
          return of([]);
        }
        this.searchingAddress = true;
        return this.settingsService.searchAddress(query, this.form.controls.city.value);
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: suggestions => {
        this.addressSuggestions = suggestions;
        this.searchingAddress = false;
      },
      error: err => {
        console.error('Errore ricerca indirizzi', err);
        this.addressSuggestions = [];
        this.searchingAddress = false;
        this.errorMessage = 'Ricerca indirizzo non disponibile in questo momento.';
      }
    });
  }

  private bestAddressValue(suggestion: AddressSuggestion): string {
    if (suggestion.hasStreetNumber) {
      return suggestion.address;
    }

    if (this.containsStreetNumber(suggestion.address)) {
      return suggestion.address;
    }

    const formattedLine = suggestion.formattedAddress.split(',')[0]?.trim();
    if (formattedLine && this.containsStreetNumber(formattedLine)) {
      return formattedLine;
    }

    return suggestion.address;
  }

  private containsStreetNumber(value: string | null | undefined): boolean {
    return !!value && /\d/.test(value);
  }

  private sortServiceHours(): void {
    const sorted = this.getServiceHours()
      .sort((left, right) => this.compareSlots(left, right));
    this.serviceHoursArray.clear();
    sorted.forEach(slot => this.serviceHoursArray.push(this.createSlot(slot)));
    this.newSlotControl = null;
  }

  private getServiceHours(): RestaurantServiceHour[] {
    return this.serviceHoursArray.getRawValue() as RestaurantServiceHour[];
  }

  private compareSlots(left: RestaurantServiceHour, right: RestaurantServiceHour): number {
    const leftIndex = this.weekdays.findIndex(day => day.value === left.dayOfWeek);
    const rightIndex = this.weekdays.findIndex(day => day.value === right.dayOfWeek);
    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }
    return left.startTime.localeCompare(right.startTime) || left.endTime.localeCompare(right.endTime);
  }

  private hasOverlap(candidate: RestaurantServiceHour, slots: RestaurantServiceHour[]): boolean {
    const candidateIntervals = this.toWeekIntervals(candidate);

    return slots.some(slot => this.toWeekIntervals(slot).some(slotInterval =>
      candidateIntervals.some(candidateInterval =>
        candidateInterval.start < slotInterval.end && candidateInterval.end > slotInterval.start
      )
    ));
  }

  private toMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(value => Number(value));
    return (hours * 60) + minutes;
  }

  private toWeekIntervals(slot: RestaurantServiceHour): Array<{ start: number; end: number }> {
    const dayIndex = this.weekdays.findIndex(day => day.value === slot.dayOfWeek);
    const startMinutes = this.toMinutes(slot.startTime);
    const endMinutes = this.toMinutes(slot.endTime);
    const dayOffset = dayIndex * 1440;

    if (endMinutes > startMinutes) {
      return [{ start: dayOffset + startMinutes, end: dayOffset + endMinutes }];
    }

    const nextDayOffset = ((dayIndex + 1) % this.weekdays.length) * 1440;
    return [
      { start: dayOffset + startMinutes, end: dayOffset + 1440 },
      { start: nextDayOffset, end: nextDayOffset + endMinutes }
    ];
  }

  private findOverlapMessage(slots: RestaurantServiceHour[]): string | null {
    const intervals = slots.flatMap(slot => this.toWeekIntervals(slot).map(interval => ({ slot, interval })))
      .sort((left, right) => left.interval.start - right.interval.start);

    for (let index = 1; index < intervals.length; index++) {
      const previous = intervals[index - 1];
      const current = intervals[index];
      if (current.interval.start < previous.interval.end) {
        return `Le fasce ${this.formatSlotLabel(previous.slot)} e ${this.formatSlotLabel(current.slot)} si sovrappongono.`;
      }
    }
    return null;
  }

  private formatSlotLabel(slot: RestaurantServiceHour): string {
    const overnightSuffix = this.toMinutes(slot.endTime) <= this.toMinutes(slot.startTime)
      ? ' (+1 giorno)'
      : '';
    return `${this.dayLabel(slot.dayOfWeek)} ${slot.startTime}-${slot.endTime}${overnightSuffix}`;
  }

  private createSlot(slot?: Partial<RestaurantServiceHour>) {
    return this.fb.nonNullable.group({
      dayOfWeek: [slot?.dayOfWeek ?? 'MONDAY', Validators.required],
      startTime: [slot?.startTime ?? '19:00', Validators.required],
      endTime: [slot?.endTime ?? '22:30', Validators.required]
    });
  }

  private async ensureStripeReady(publishableKey: string): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      throw new Error('Stripe disponibile solo in ambiente browser');
    }
    await this.loadStripeScript();
    if (!window.Stripe) {
      throw new Error('Stripe.js non disponibile');
    }
    this.stripeInstance = window.Stripe(publishableKey);
  }

  private loadStripeScript(): Promise<void> {
    if (window.Stripe) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-waitero-stripe="true"]');
      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('Stripe.js load failed')), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://js.stripe.com/v3/';
      script.async = true;
      script.dataset['waiteroStripe'] = 'true';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Stripe.js load failed'));
      document.head.appendChild(script);
    });
  }

  private mountIbanElement(): void {
    if (!this.stripeInstance) {
      throw new Error('Stripe non inizializzato');
    }
    this.destroyIbanElement();
    const mountTarget = document.getElementById('restaurant-billing-iban-element');
    if (!mountTarget) {
      throw new Error('Contenitore IBAN non disponibile');
    }
    const elements = this.stripeInstance.elements();
    this.ibanElement = elements.create('iban', {
      supportedCountries: ['SEPA'],
      placeholderCountry: 'IT'
    });
    this.ibanElement.mount(mountTarget);
  }

  private destroyIbanElement(): void {
    if (this.ibanElement) {
      this.ibanElement.destroy();
      this.ibanElement = null;
    }
  }
}


