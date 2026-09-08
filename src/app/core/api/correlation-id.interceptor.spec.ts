import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { correlationIdInterceptor } from './correlation-id.interceptor';

describe('Correlation and command identity', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([correlationIdInterceptor])),
        provideHttpClientTesting(),
      ],
    }),
  );
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  for (const url of ['/api/v1/auth/login', '/api/v1/wash/supervision/lookup']) {
    it(`does not invent an idempotency key for ${url}`, () => {
      TestBed.inject(HttpClient).post(url, {}).subscribe();
      const request = TestBed.inject(HttpTestingController).expectOne(url);
      expect(request.request.headers.has('Idempotency-Key')).toBeFalse();
      expect(request.request.headers.get('X-Correlation-Id')).toMatch(/^[0-9a-f-]{36}$/);
      request.flush({});
    });
  }
  it('preserves command identity across separate HTTP attempts', () => {
    const client = TestBed.inject(HttpClient);
    const http = TestBed.inject(HttpTestingController);
    const correlations: string[] = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      client
        .post(
          '/api/v1/wash/appointments',
          { instrumentCount: 2 },
          { headers: { 'Idempotency-Key': 'original-intent' } },
        )
        .subscribe();
      const request = http.expectOne('/api/v1/wash/appointments');
      expect(request.request.headers.get('Idempotency-Key')).toBe('original-intent');
      correlations.push(request.request.headers.get('X-Correlation-Id')!);
      request.flush({});
    }
    expect(correlations[0]).not.toBe(correlations[1]);
  });
});
