import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { CustomerOrderService } from './customer-order.service';
import { AuthContextService } from './auth-context.service';
import { DemoContextService } from './demo-context.service';

describe('CustomerOrderService submit idempotency', () => {
  let service: CustomerOrderService;
  let http: HttpTestingController;
  let demo: DemoContextService;

  const payload = {
    token: 'qr',
    restaurantId: '11',
    tableId: '7',
    sessionId: 'session',
    noteCucina: 'senza sale',
    items: [{ dishId: 3, quantity: 1 }]
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    });
    service = TestBed.inject(CustomerOrderService);
    http = TestBed.inject(HttpTestingController);
    demo = TestBed.inject(DemoContextService);
    demo.deactivate();
    TestBed.inject(AuthContextService).setContext('jwt', '11', '7', 'device', null, null, false);
    for (let index = localStorage.length - 1; index >= 0; index--) {
      const key = localStorage.key(index);
      if (key?.startsWith('waiteroSubmitIntent:')) localStorage.removeItem(key);
    }
  });

  afterEach(() => {
    demo.deactivate();
    http.verify();
  });

  it('reuses one request id across retry, refresh-equivalent recreation and tabs', () => {
    const first = service.getOrCreateSubmitRequestId(payload);
    const retry = service.getOrCreateSubmitRequestId(payload);
    expect(retry).toBe(first);

    const secondInstance = TestBed.runInInjectionContext(() => new CustomerOrderService());
    expect(secondInstance.getOrCreateSubmitRequestId(payload)).toBe(first);
  });

  it('creates a new id after confirmation so identical later orders remain distinct', () => {
    const first = service.getOrCreateSubmitRequestId(payload);
    service.completeSubmitIntent(payload, first);
    expect(service.getOrCreateSubmitRequestId(payload)).not.toBe(first);
  });

  it('sends the persistent request id to the API', () => {
    const requestId = service.getOrCreateSubmitRequestId(payload);
    service.submitOrder({ ...payload, requestId }).subscribe();
    const request = http.expectOne(req => req.url.endsWith('/customer/orders'));
    expect(request.request.body.requestId).toBe(requestId);
    request.flush({});
  });

  it('sends demo waiter calls to the session API instead of simulating success', () => {
    demo.activate('demo-session');
    service.callWaiter({ token: 'qr', restaurantId: '11', tableId: '7' }).subscribe();
    const request = http.expectOne(req => req.url.endsWith('/customer/demo/call-waiter'));
    expect(request.request.method).toBe('POST');
    expect(request.request.params.get('token')).toBe('demo-session');
    request.flush({ message: 'OK' });
  });

  it('also sends the persistent request id to the demo API', () => {
    demo.activate('demo-token');
    const requestId = service.getOrCreateSubmitRequestId(payload);
    service.submitOrder({ ...payload, requestId }).subscribe();
    const request = http.expectOne(req => req.url.endsWith('/customer/demo/orders'));
    expect(request.request.body.requestId).toBe(requestId);
    request.flush({});
  });});
