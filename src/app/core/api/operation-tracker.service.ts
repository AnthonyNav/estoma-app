import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, timer } from 'rxjs';
import { switchMap, takeWhile } from 'rxjs/operators';

import { environment } from '../../../environments/environment';

export type OperationStatus = 'PENDING' | 'SUCCEEDED' | 'REJECTED' | 'FAILED' | 'EXPIRED';

export interface OperationResult {
  operationId: string;
  status: OperationStatus;
}

@Injectable({ providedIn: 'root' })
export class OperationTrackerService {
  private readonly http = inject(HttpClient);

  track(operationId: string, intervalMs = 1_000): Observable<OperationResult> {
    return timer(0, intervalMs).pipe(
      switchMap(() =>
        this.http.get<OperationResult>(
          `${environment.apiBaseUrl}/operations/${encodeURIComponent(operationId)}`,
        ),
      ),
      takeWhile((operation) => operation.status === 'PENDING', true),
    );
  }
}
