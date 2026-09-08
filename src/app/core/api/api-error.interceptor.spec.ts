import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { apiErrorInterceptor } from './api-error.interceptor';
import { ApplicationError } from './application-error';
describe('Operation errors without a Problem body', () => {
  it('preserves a 404 status when the operation endpoint returns an empty body', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    let error: ApplicationError | undefined;
    TestBed.inject(HttpClient)
      .get('/api/v1/operations/missing')
      .subscribe({ error: (value: ApplicationError) => (error = value) });
    const http = TestBed.inject(HttpTestingController);
    http
      .expectOne('/api/v1/operations/missing')
      .flush(null, { status: 404, statusText: 'Not Found' });
    expect(error instanceof ApplicationError).toBeTrue();
    expect(error?.status).toBe(404);
    expect(error?.kind).toBe('not-found');
    expect(error?.code).toBeUndefined();
    http.verify();
  });
});
