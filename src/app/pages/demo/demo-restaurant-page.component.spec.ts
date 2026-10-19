import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of, Subject } from 'rxjs';
import { DemoRestaurantPageComponent } from './demo-restaurant-page.component';
import { DemoSessionService } from '../../services/demo-session.service';
import { BackofficeEventService, BackofficeOrderEvent } from '../../services/backoffice-event.service';
import { RestaurantOrderService } from '../../services/restaurant-order.service';
import { WaiterAlertAudioService } from '../../services/waiter-alert-audio.service';

describe('Demo restaurant waiter calls', () => {
  it('restores pending calls, receives new calls and acknowledges them', fakeAsync(() => {
    let pending = true;
    let calledAt: string | null = '2026-10-19T10:00:00';
    const updates = new Subject<BackofficeOrderEvent>();
    const sessions = {
      current: jasmine.createSpy().and.returnValue(of({ token: 'session-a' })),
      waiterCall: jasmine.createSpy().and.callFake(() => of({ pending, calledAt })),
      clearWaiterCall: jasmine.createSpy().and.callFake(() => { pending = false; calledAt = null; return of(undefined); })
    };
    const events = { ordersUpdated$: updates, start: jasmine.createSpy(), stop: jasmine.createSpy() };
    const audio = { playWaiterCallAlert: jasmine.createSpy().and.returnValue(Promise.resolve()) };
    TestBed.configureTestingModule({ providers: [
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => 'session-a' } } } },
      { provide: DemoSessionService, useValue: sessions },
      { provide: BackofficeEventService, useValue: events },
      { provide: RestaurantOrderService, useValue: { getActiveOrderSummaries: () => of([]) } },
      { provide: WaiterAlertAudioService, useValue: audio }
    ] });
    const page = TestBed.runInInjectionContext(() => new DemoRestaurantPageComponent());
    page.ngOnInit();
    tick(0);
    expect(page.waiterCallPending).toBeTrue();
    expect(audio.playWaiterCallAlert).toHaveBeenCalledTimes(1);
    tick(5000);
    expect(audio.playWaiterCallAlert).toHaveBeenCalledTimes(1);
    page.clearWaiterCall();
    expect(page.waiterCallPending).toBeFalse();
    expect(sessions.clearWaiterCall).toHaveBeenCalledTimes(1);
    pending = true;
    calledAt = '2026-10-19T10:05:00';
    updates.next({ rawEvent: new Event('orders-updated'), payload: { type: 'WAITER_CALLED' } });
    expect(page.waiterCallPending).toBeTrue();
    expect(page.received).toBeFalse();
    expect(audio.playWaiterCallAlert).toHaveBeenCalledTimes(2);
    page.ngOnDestroy();
    const requests = sessions.waiterCall.calls.count();
    tick(5000);
    expect(sessions.waiterCall.calls.count()).toBe(requests);
  }));
});
