import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { HttpAuthenticationAdapter, loginPayload } from './http-authentication.adapter';
import { sessionInterceptor } from './session.interceptor';
import { SessionStore } from '../../application/session-store.service';
import { AUTHENTICATION_GATEWAY } from '../../domain/ports/authentication.gateway';
import { apiErrorInterceptor } from '../../../../core/api/api-error.interceptor';
import { ApplicationError } from '../../../../core/api/application-error';
describe('Authentication HTTP boundary', () => {
  let http: HttpTestingController;
  let adapter: HttpAuthenticationAdapter;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([sessionInterceptor, apiErrorInterceptor])),
        provideHttpClientTesting(),
        HttpAuthenticationAdapter,
        { provide: AUTHENTICATION_GATEWAY, useExisting: HttpAuthenticationAdapter },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    adapter = TestBed.inject(HttpAuthenticationAdapter);
  });
  afterEach(() => http.verify());
  it('classifies trimmed ASCII digits without changing password or dropping leading zeroes', () => {
    expect(loginPayload({ identifier: ' 001234 ', password: '  Keep Me  ' })).toEqual({
      loginType: 'MATRICULA',
      loginIdentifier: '001234',
      password: '  Keep Me  ',
    });
    for (const identifier of ['admin01', '12 34', 'user@example.invalid', '１２３'])
      expect(loginPayload({ identifier, password: 'x' }).loginType).toBe('USERNAME');
  });
  it('sends one canonical login request without system, bearer or idempotency key', () => {
    adapter.signIn({ identifier: ' 202257019 ', password: ' secret ' }).subscribe();
    const r = http.expectOne('/api/v1/auth/login');
    expect(r.request.body).toEqual({
      loginType: 'MATRICULA',
      loginIdentifier: '202257019',
      password: ' secret ',
    });
    expect(r.request.headers.has('Authorization')).toBeFalse();
    expect(r.request.headers.has('Idempotency-Key')).toBeFalse();
    r.flush({});
  });
  it('attaches bearer only to relative BFF requests', () => {
    TestBed.inject(SessionStore).session.set({
      accountId: 'a',
      sessionId: 's',
      accessToken: 'fixture-access',
      refreshToken: 'fixture-refresh',
      authState: 'NORMAL',
      accessExpiresAt: Date.now() + 60000,
    });
    adapter.profile().subscribe();
    const request = http.expectOne('/api/v1/me');
    expect(request.request.headers.get('Authorization')).toBe('Bearer fixture-access');
    request.flush({});
    TestBed.inject(HttpClient).get('https://example.invalid/api/v1/me').subscribe();
    const external = http.expectOne('https://example.invalid/api/v1/me');
    expect(external.request.headers.has('Authorization')).toBeFalse();
    external.flush({});
  });
  it('retains public error code and traceId without a second login attempt', () => {
    let error: ApplicationError | undefined;
    adapter
      .signIn({ identifier: 'person', password: 'fixture' })
      .subscribe({ error: (e) => (error = e) });
    http
      .expectOne('/api/v1/auth/login')
      .flush(
        { code: 'BFF.AUTHENTICATION_INVALID', traceId: 'fixture-trace', detail: 'Denied' },
        { status: 401, statusText: 'Unauthorized' },
      );
    expect(error?.code).toBe('BFF.AUTHENTICATION_INVALID');
    expect(error?.traceId).toBe('fixture-trace');
    http.expectNone('/api/v1/auth/login');
  });
  it('sends confirmation neither to password change nor login', () => {
    adapter.changePassword(null, 'a long new password').subscribe();
    const r = http.expectOne('/api/v1/me/password');
    expect(r.request.body).toEqual({ currentPassword: null, newPassword: 'a long new password' });
    r.flush({});
  });
});
