import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MenuComponent } from './menu.component';
import { CustomerOrderService } from '../../services/customer-order.service';

describe('MenuComponent', () => {
  let component: MenuComponent;
  let fixture: ComponentFixture<MenuComponent>;
  let customerOrderService: CustomerOrderService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MenuComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MenuComponent);
    component = fixture.componentInstance;
    customerOrderService = TestBed.inject(CustomerOrderService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('closes the previous table stream before reconnecting', () => {
    const first = new FakeEventSource();
    const second = new FakeEventSource();
    spyOn(customerOrderService, 'connectToTableStream').and.returnValues(first as unknown as EventSource, second as unknown as EventSource);
    component.token = 'qr';
    component.restaurantId = '1';
    component.tableId = '2';

    component.connectTableStream();
    component.connectTableStream();

    expect(first.closed).toBeTrue();
    expect(second.closed).toBeFalse();
    first.emit('customer-order-updated');
    expect(first.listenerInvocations).toBe(0);
  });

  it('closes the active table stream when destroyed', () => {
    const stream = new FakeEventSource();
    spyOn(customerOrderService, 'connectToTableStream').and.returnValue(stream as unknown as EventSource);
    component.token = 'qr';
    component.restaurantId = '1';
    component.tableId = '2';
    component.connectTableStream();

    component.ngOnDestroy();

    expect(stream.closed).toBeTrue();
  });
});

class FakeEventSource {
  closed = false;
  listenerInvocations = 0;
  private listeners = new Map<string, Array<() => void>>();

  addEventListener(name: string, listener: EventListenerOrEventListenerObject): void {
    const callback = typeof listener === 'function' ? listener : () => listener.handleEvent(new Event(name));
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), () => {
      this.listenerInvocations++;
      callback(new Event(name));
    }]);
  }

  close(): void {
    this.closed = true;
    this.listeners.clear();
  }

  emit(name: string): void {
    if (!this.closed) (this.listeners.get(name) ?? []).forEach(listener => listener());
  }
}
