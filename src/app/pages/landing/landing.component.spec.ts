import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { NgForm } from '@angular/forms';
import { LandingComponent } from './landing.component';
import { AuthInterceptor } from '../../auth/auth.interceptor';
import { AuthService } from '../../auth/AuthService';

describe('Landing contact form', () => {
  let page: LandingComponent;
  let http: HttpTestingController;
  let auth: { ensureValidAccessToken: jasmine.Spy };
  let form: NgForm;
  beforeEach(() => {
    auth = { ensureValidAccessToken: jasmine.createSpy() };
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([AuthInterceptor])), provideHttpClientTesting(), provideRouter([]),
      { provide: AuthService, useValue: auth }
    ] });
    page = TestBed.runInInjectionContext(() => new LandingComponent());
    http = TestBed.inject(HttpTestingController);
    form = { invalid: false, value: { name: 'Mario', venue: 'Locale', email: 'cliente@example.com', city: 'Roma' },
      resetForm: jasmine.createSpy() } as unknown as NgForm;
  });
  afterEach(() => http.verify());

  it('submits anonymously without token refresh and confirms success', () => {
    page.submitDemo(form);
    const request = http.expectOne(req => req.url.endsWith('/contact/demo'));
    expect(auth.ensureValidAccessToken).not.toHaveBeenCalled();
    expect(request.request.headers.has('Authorization')).toBeFalse();
    request.flush(null, { status: 202, statusText: 'Accepted' });
    expect(page.formSuccess).toBeTrue();
    expect(form.resetForm).toHaveBeenCalled();
    expect(page.sending).toBeFalse();
  });

  for (const status of [0, 400, 429, 502, 503]) {
    it(`keeps form data and explains failure for status ${status}`, () => {
      page.submitDemo(form);
      const request = http.expectOne(req => req.url.endsWith('/contact/demo'));
      if (status === 0) request.error(new ProgressEvent('error'));
      else request.flush({}, { status, statusText: 'Failed' });
      expect(page.formSuccess).toBeFalse();
      expect(page.sending).toBeFalse();
      expect(form.resetForm).not.toHaveBeenCalled();
      expect(page.formNotice).not.toContain('info@cdevia.com');
      if (status !== 400) expect(page.formNotice).toContain('info@waiter-o.com');
    });
  }
});
