import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, PLATFORM_ID, inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged, from, of, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AddressSuggestion, RestaurantServiceHour, RestaurantSettings, RestaurantSettingsService } from '../../services/restaurant-settings.service';
import { environment } from '../../../environments/environment';

declare const google: any;

type DuplicateMode = 'slot' | 'day';

@Component({
  selector: 'app-restaurant-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './restaurant-settings.component.html',
  styleUrl: './restaurant-settings.component.scss'
})
export class RestaurantSettingsComponent {
  loading = true;
  saving = false;
  searchingAddress = false;
  errorMessage = '';
  successMessage = '';
  settings: RestaurantSettings | null = null;
  addressSuggestions: AddressSuggestion[] = [];
  selectedSuggestion: AddressSuggestion | null = null;
  duplicateSourceIndex: number | null = null;
  duplicateMode: DuplicateMode = 'slot';
  duplicateTargets = new Set<string>();

  private fb = inject(FormBuilder);
  private settingsService = inject(RestaurantSettingsService);
  private sanitizer = inject(DomSanitizer);
  private destroyRef = inject(DestroyRef);
  private platformId = inject(PLATFORM_ID);
  private googlePlacesReady: Promise<void> | null = null;

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

  constructor() {
    this.setupAddressAutocomplete();
    this.loadSettings();
  }

  get serviceHoursArray(): FormArray {
    return this.form.controls.serviceHours;
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
        this.serviceHoursArray.clear();
        settings.serviceHours.forEach(slot => this.serviceHoursArray.push(this.createSlot(slot)));
        if (settings.serviceHours.length === 0) {
          this.addSlot();
        }
        this.cancelDuplicate();
        this.loading = false;
      },
      error: err => {
        console.error('Errore caricamento impostazioni ristorante', err);
        this.errorMessage = 'Impossibile caricare le impostazioni del ristorante.';
        this.loading = false;
      }
    });
  }

  addSlot(): void {
    this.serviceHoursArray.push(this.createSlot());
  }

  removeSlot(index: number): void {
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
      .filter(slot => slot.dayOfWeek && slot.startTime && slot.endTime);

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
        this.successMessage = 'Impostazioni ristorante aggiornate.';
        this.saving = false;
        this.loadSettings();
      },
      error: err => {
        console.error('Errore aggiornamento impostazioni ristorante', err);
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
        return from(this.searchAddressWithGoogle(query, this.form.controls.city.value));
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: suggestions => {
        this.addressSuggestions = suggestions;
        this.searchingAddress = false;
      },
      error: err => {
        console.error('Errore ricerca indirizzi Google', err);
        this.addressSuggestions = [];
        this.searchingAddress = false;
      }
    });
  }

  private async searchAddressWithGoogle(query: string, city?: string): Promise<AddressSuggestion[]> {
    if (!isPlatformBrowser(this.platformId)) {
      return [];
    }

    await this.ensureGooglePlacesLoaded();
    const input = city && city.trim() ? `${query}, ${city.trim()}` : query;
    const predictions = await this.fetchPredictions(input);
    const suggestions = await Promise.all(predictions.slice(0, 5).map(prediction => this.fetchSuggestionDetails(prediction)));

    return suggestions
      .filter((suggestion): suggestion is AddressSuggestion => !!suggestion)
      .sort((left, right) => Number(right.hasStreetNumber) - Number(left.hasStreetNumber));
  }

  private ensureGooglePlacesLoaded(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return Promise.resolve();
    }
    if (this.googlePlacesReady) {
      return this.googlePlacesReady;
    }
    if ((window as any).google?.maps?.places) {
      this.googlePlacesReady = Promise.resolve();
      return this.googlePlacesReady;
    }
    if (!environment.googleMapsApiKey) {
      this.googlePlacesReady = Promise.reject(new Error('Google Maps API key is missing'));
      return this.googlePlacesReady;
    }

    this.googlePlacesReady = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(environment.googleMapsApiKey)}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Google Maps script load failed'));
      document.head.appendChild(script);
    });

    return this.googlePlacesReady;
  }

  private fetchPredictions(input: string): Promise<any[]> {
    return new Promise(resolve => {
      const service = new google.maps.places.AutocompleteService();
      service.getPlacePredictions(
        {
          input,
          componentRestrictions: { country: 'it' },
          types: ['address']
        },
        (predictions: any[] | null, status: string) => {
          if (status !== google.maps.places.PlacesServiceStatus.OK || !predictions) {
            resolve([]);
            return;
          }
          resolve(predictions);
        }
      );
    });
  }

  private fetchSuggestionDetails(prediction: any): Promise<AddressSuggestion | null> {
    return new Promise(resolve => {
      const service = new google.maps.places.PlacesService(document.createElement('div'));
      service.getDetails(
        {
          placeId: prediction.place_id,
          fields: ['address_components', 'formatted_address', 'geometry']
        },
        (place: any, status: string) => {
          if (status !== google.maps.places.PlacesServiceStatus.OK || !place?.geometry?.location) {
            resolve(null);
            return;
          }

          const route = this.googleAddressComponent(place.address_components, 'route');
          const streetNumber = this.googleAddressComponent(place.address_components, 'street_number');
          const city = this.googleAddressComponent(place.address_components, 'locality')
            ?? this.googleAddressComponent(place.address_components, 'administrative_area_level_3')
            ?? this.googleAddressComponent(place.address_components, 'administrative_area_level_2');

          resolve({
            address: route && streetNumber ? `${route}, ${streetNumber}` : route ?? prediction.description,
            city: city ?? null,
            formattedAddress: place.formatted_address ?? prediction.description,
            latitude: place.geometry.location.lat(),
            longitude: place.geometry.location.lng(),
            hasStreetNumber: !!streetNumber
          });
        }
      );
    });
  }

  private googleAddressComponent(components: any[] | undefined, type: string): string | null {
    const component = components?.find(item => item.types?.includes(type));
    return component?.long_name ?? null;
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
    const candidateStart = this.toMinutes(candidate.startTime);
    const candidateEnd = this.toMinutes(candidate.endTime);

    return slots.some(slot => {
      if (slot.dayOfWeek !== candidate.dayOfWeek) {
        return false;
      }
      const slotStart = this.toMinutes(slot.startTime);
      const slotEnd = this.toMinutes(slot.endTime);
      return candidateStart < slotEnd && candidateEnd > slotStart;
    });
  }

  private toMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(value => Number(value));
    return (hours * 60) + minutes;
  }

  private createSlot(slot?: Partial<RestaurantServiceHour>) {
    return this.fb.nonNullable.group({
      dayOfWeek: [slot?.dayOfWeek ?? 'MONDAY', Validators.required],
      startTime: [slot?.startTime ?? '19:00', Validators.required],
      endTime: [slot?.endTime ?? '22:30', Validators.required]
    });
  }
}

