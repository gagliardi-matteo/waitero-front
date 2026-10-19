import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { BackofficeEventService } from './backoffice-event.service';
import { RestaurantOrderService } from './restaurant-order.service';

describe('BackofficeEventService', () => {
  let service: BackofficeEventService;
  let restaurantOrderService: jasmine.SpyObj<RestaurantOrderService>;

  beforeEach(() => {
    restaurantOrderService = jasmine.createSpyObj<RestaurantOrderService>('RestaurantOrderService', ['connectToStream']);
    TestBed.configureTestingModule({
      providers: [
        BackofficeEventService,
        { provide: RestaurantOrderService, useValue: restaurantOrderService }
      ]
    });
    service = TestBed.inject(BackofficeEventService);
  });

  afterEach(() => service.stop());

  it('ignores a delayed error from an obsolete stream after reconnect', fakeAsync(() => {
    const first = new FakeEventSource();
    const second = new FakeEventSource();
    restaurantOrderService.connectToStream.and.returnValues(first as unknown as EventSource, second as unknown as EventSource);

    service.start();
    first.emit('error');
    tick(3000);
    second.emit('open');
    expect(service.currentState()).toBe('open');

    first.emitEvenIfClosed('error');

    expect(second.closed).toBeFalse();
    expect(service.currentState()).toBe('open');
  }));

  it('emits a resync signal after a lost connection is restored', fakeAsync(() => {
    const first = new FakeEventSource();
    const second = new FakeEventSource();
    restaurantOrderService.connectToStream.and.returnValues(first as unknown as EventSource, second as unknown as EventSource);
    const events: unknown[] = [];
    service.ordersUpdated$.subscribe(event => events.push(event.payload));

    service.start();
    first.emit('error');
    tick(3000);
    second.emit('open');

    expect(events).toEqual([null]);
  }));

  it('does not reconnect after stop while a retry is pending', fakeAsync(() => {
    const first = new FakeEventSource();
    restaurantOrderService.connectToStream.and.returnValue(first as unknown as EventSource);
    service.start();
    first.emit('error');

    service.stop();
    tick(3000);

    expect(restaurantOrderService.connectToStream).toHaveBeenCalledTimes(1);
    expect(service.currentState()).toBe('idle');
  }));

  it('keeps start idempotent while connected', () => {
    const stream = new FakeEventSource();
    restaurantOrderService.connectToStream.and.returnValue(stream as unknown as EventSource);

    service.start();
    service.start();

    expect(restaurantOrderService.connectToStream).toHaveBeenCalledTimes(1);
  });
});

class FakeEventSource {
  closed = false;
  private listeners = new Map<string, Array<() => void>>();

  addEventListener(name: string, listener: EventListenerOrEventListenerObject): void {
    const callback = typeof listener === 'function' ? listener : () => listener.handleEvent(new Event(name));
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), () => callback(new Event(name))]);
  }

  close(): void { this.closed = true; }

  emit(name: string): void {
    if (!this.closed) this.emitEvenIfClosed(name);
  }

  emitEvenIfClosed(name: string): void {
    (this.listeners.get(name) ?? []).forEach(listener => listener());
  }
}
