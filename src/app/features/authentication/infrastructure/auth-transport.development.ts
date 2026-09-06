import { HttpInterceptorFn } from '@angular/common/http';
import { authFixtureInterceptor } from './fixtures/auth-fixture.interceptor';
export const authTransportInterceptors: HttpInterceptorFn[] = [authFixtureInterceptor];
