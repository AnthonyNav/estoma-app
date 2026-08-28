import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of, throwError, timer } from 'rxjs';
import { exhaustMap, mergeMap, takeWhile } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { ApplicationError } from './application-error';

export type OperationStatus = 'PENDING' | 'SUCCEEDED' | 'REJECTED' | 'FAILED' | 'EXPIRED';

export interface OperationResult {
  operationId: string;
  status: OperationStatus;
}

export interface OperationTrackingOptions {
  intervalMs?: number;
  maxPendingPolls?: number;
}

@Injectable({ providedIn: 'root' })
export class OperationTrackerService {
  private readonly http = inject(HttpClient);

  track(operationId: string, options: OperationTrackingOptions = {}): Observable<OperationResult> {
    return this.trackWith(
      () =>
        this.http.get<OperationResult>(
          `${environment.apiBaseUrl}/operations/${encodeURIComponent(operationId)}`,
        ),
      options,
    );
  }

  trackWith<T extends OperationResult>(
    loadOperation: () => Observable<T>,
    { intervalMs = 1_000, maxPendingPolls = 60 }: OperationTrackingOptions = {},
  ): Observable<T> {
    let pendingPolls = 0;

    return timer(0, intervalMs).pipe(
      exhaustMap(() => loadOperation()),
      mergeMap((operation) => {
        if (operation.status !== 'PENDING') {
          return of(operation);
        }

        pendingPolls += 1;
        return pendingPolls < maxPendingPolls
          ? of(operation)
          : throwError(
              () =>
                new ApplicationError(
                  'temporary',
                  'La operación sigue pendiente. Vuelve a consultar su estado en unos momentos.',
                ),
            );
      }),
      takeWhile((operation) => operation.status === 'PENDING', true),
    );
  }
}
