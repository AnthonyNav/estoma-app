import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { HttpWashAdministrationAdapter } from './http-wash-administration.adapter';

describe('HttpWashAdministrationAdapter', () => {
  let adapter: HttpWashAdministrationAdapter;
  let http: jasmine.SpyObj<HttpClient>;

  beforeEach(() => {
    http = jasmine.createSpyObj<HttpClient>('HttpClient', ['get', 'post', 'put', 'patch']);
    http.get.and.returnValue(of({ supervisors: [] }));
    http.post.and.returnValue(
      of({ operationId: 'operation-1', pollPath: '/api/v1/operations/operation-1' }),
    );
    http.put.and.returnValue(
      of({ operationId: 'operation-1', pollPath: '/api/v1/operations/operation-1' }),
    );
    http.patch.and.returnValue(
      of({ operationId: 'operation-1', pollPath: '/api/v1/operations/operation-1' }),
    );
    TestBed.configureTestingModule({
      providers: [HttpWashAdministrationAdapter, { provide: HttpClient, useValue: http }],
    });
    adapter = TestBed.inject(HttpWashAdministrationAdapter);
  });

  it('sends the complete atomic day proposal without an idempotency header in preview', () => {
    adapter
      .previewWeekDay({
        calendarId: 'calendar-1',
        dayOfWeek: 2,
        expectedSchedules: [{ scheduleId: 'schedule-1', expectedVersion: 3 }],
        desiredIntervals: [{ openingTime: '08:00', closingTime: '12:00', slotDurationMinutes: 60 }],
        idempotencyKey: 'key-1',
      })
      .subscribe();

    expect(http.post).toHaveBeenCalledWith(
      '/api/v1/admin/wash/operation/current-week/days/2/impact-preview',
      {
        calendarId: 'calendar-1',
        expectedSchedules: [{ scheduleId: 'schedule-1', expectedVersion: 3 }],
        desiredIntervals: [{ openingTime: '08:00', closingTime: '12:00', slotDurationMinutes: 60 }],
      },
    );
  });

  it('sends version and reason for administrative resource deactivation', () => {
    adapter
      .changeResourceStatus({
        resourceType: 'TANK',
        resourceId: 'tank-1',
        action: 'deactivate',
        expectedVersion: 4,
        reason: 'Mantenimiento',
        idempotencyKey: 'key-2',
      })
      .subscribe();

    const [, body, options] = http.post.calls.mostRecent().args;
    expect(body).toEqual({ expectedVersion: 4, reason: 'Mantenimiento' });
    const headers = (options as { headers: { get: (name: string) => string | null } }).headers;
    expect(headers.get('Idempotency-Key')).toBe('key-2');
  });

  it('unwraps the canonical supervisors response', () => {
    http.get.and.returnValue(of({ supervisors: [{ accountId: 'supervisor-1' }] }));
    let supervisors: unknown;

    adapter.loadSupervisors('').subscribe((response) => (supervisors = response));

    expect(supervisors).toEqual([{ accountId: 'supervisor-1' }]);
  });
});
