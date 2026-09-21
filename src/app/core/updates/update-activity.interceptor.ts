import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { defer, finalize } from 'rxjs';
import { UpdateSafetyService } from './update-safety.service';

export const updateActivityInterceptor: HttpInterceptorFn = (request, next) => {
  const safety = inject(UpdateSafetyService);
  return defer(() => {
    safety.requests.update((count) => count + 1);
    return next(request).pipe(finalize(() => safety.requests.update((count) => count - 1)));
  });
};
