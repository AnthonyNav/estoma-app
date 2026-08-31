import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { SessionStoreService } from '../../features/authentication/application/session-store.service';

export const authTokenInterceptor: HttpInterceptorFn = (request, next) => {
  const token = inject(SessionStoreService).accessToken();
  if (!token || request.url.includes('/auth/')) {
    return next(request);
  }
  return next(request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
