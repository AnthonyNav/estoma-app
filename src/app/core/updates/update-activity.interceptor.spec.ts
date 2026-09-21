import { HttpRequest, HttpResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import { updateActivityInterceptor } from './update-activity.interceptor';
import { UpdateSafetyService } from './update-safety.service';

describe('updateActivityInterceptor', () => {
  it('tracks actual subscriptions and releases the gate on success, cancellation and error', () => {
    const safety = { requests: signal(0) };
    TestBed.configureTestingModule({
      providers: [{ provide: UpdateSafetyService, useValue: safety }],
    });
    for (const outcome of ['success', 'cancel', 'error']) {
      const response = new Subject<HttpResponse<unknown>>();
      const request = TestBed.runInInjectionContext(() =>
        updateActivityInterceptor(new HttpRequest('POST', '/api/v1/action', {}), () => response),
      );
      expect(safety.requests()).toBe(0);
      const subscription = request.subscribe({ error: jasmine.createSpy('error') });
      expect(safety.requests()).toBe(1);
      if (outcome === 'success') response.complete();
      else if (outcome === 'error') response.error(new Error('offline'));
      else subscription.unsubscribe();
      expect(safety.requests()).toBe(0);
    }
  });
});
