import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { Subject } from 'rxjs';
import { DemoClientPageComponent } from './demo-client-page.component';
import { DemoSession, DemoSessionService } from '../../services/demo-session.service';
import { AuthContextService } from '../../services/auth-context.service';
import { DeviceIdService } from '../../services/device-id.service';

describe('Demo client session recovery', () => {
  let response: Subject<DemoSession>;
  let sessions: jasmine.SpyObj<DemoSessionService>;
  const session: DemoSession = { token: 'demo', restaurantId: 1, tableId: 2,
    tablePublicId: 'table', restaurantName: 'Demo', expiresAt: '2099-01-01' };
  beforeEach(() => {
    response = new Subject<DemoSession>();
    sessions = jasmine.createSpyObj('DemoSessionService', ['current']);
    sessions.current.and.callFake(() => response.asObservable());
    TestBed.configureTestingModule({ providers: [
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ s: 'demo' }) } } },
      { provide: DemoSessionService, useValue: sessions },
      { provide: AuthContextService, useValue: { setContext: jasmine.createSpy('setContext') } },
      { provide: DeviceIdService, useValue: { getOrCreate: () => 'device' } }
    ] });
  });
  function create() {
    const component = TestBed.runInInjectionContext(() => new DemoClientPageComponent());
    component.ngOnInit();
    return component;
  }
  it('bounds a stalled request and allows retry of the same valid session', fakeAsync(() => {
    const component = create();
    tick(10_000);
    expect(component.loading).toBeFalse();
    expect(component.loadFailed).toBeTrue();
    expect(component.expired).toBeFalse();
    expect(response.observed).toBeFalse();
    component.loadSession();
    response.next(session);
    response.complete();
    expect(sessions.current.calls.allArgs()).toEqual([['demo'], ['demo']]);
    expect(component.session).toBe(session);
    expect(component.loadFailed).toBeFalse();
  }));
  it('preserves retry for network errors while marking invalid sessions expired', () => {
    const component = create();
    response.error({ status: 0 });
    expect(component.loadFailed).toBeTrue();
    expect(component.expired).toBeFalse();
    response = new Subject<DemoSession>();
    component.loadSession();
    response.error({ status: 410 });
    expect(component.expired).toBeTrue();
    expect(component.loadFailed).toBeFalse();
  });
});
