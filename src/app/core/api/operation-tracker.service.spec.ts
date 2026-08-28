import { HttpClient } from '@angular/common/http';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of } from 'rxjs';

import { ApplicationError } from './application-error';
import { OperationTrackerService } from './operation-tracker.service';

describe('OperationTrackerService', () => {
  let service: OperationTrackerService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: HttpClient, useValue: {} }],
    });
    service = TestBed.inject(OperationTrackerService);
  });

  it('stops polling when the operation reaches a terminal status', fakeAsync(() => {
    const statuses: ('PENDING' | 'SUCCEEDED')[] = ['PENDING', 'PENDING', 'SUCCEEDED'];
    const receivedStatuses: string[] = [];

    service
      .trackWith(
        () =>
          of({
            operationId: 'operation-1',
            status: statuses.shift() ?? 'SUCCEEDED',
          }),
        { intervalMs: 1, maxPendingPolls: 5 },
      )
      .subscribe((operation) => receivedStatuses.push(operation.status));

    tick(2);

    expect(receivedStatuses).toEqual(['PENDING', 'PENDING', 'SUCCEEDED']);
  }));

  it('fails after the configured number of pending polls', fakeAsync(() => {
    let receivedError: unknown;

    service
      .trackWith(() => of({ operationId: 'operation-1', status: 'PENDING' as const }), {
        intervalMs: 1,
        maxPendingPolls: 2,
      })
      .subscribe({ error: (error: unknown) => (receivedError = error) });

    tick(1);

    expect(receivedError).toEqual(
      jasmine.objectContaining({ kind: 'temporary' } as Partial<ApplicationError>),
    );
  }));
});
