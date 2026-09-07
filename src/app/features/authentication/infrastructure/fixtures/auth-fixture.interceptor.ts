import { environment } from '../../../../../environments/environment';
import {
  HttpErrorResponse,
  HttpHeaders,
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { mergeMap, of, throwError, timer } from 'rxjs';
import data from './auth-responses.json';
interface Reply {
  status: number;
  body: unknown;
  method?: string;
  path?: string;
}
type Operation = 'login' | 'profile' | 'password' | 'refresh' | 'logout';
interface Scenario {
  login: string[];
  profile: string[];
  password: string[];
  refresh: string[];
  logout: string[];
  accessLifetimeSeconds?: number;
}
const routes: Record<string, Operation> = {
  '/api/v1/auth/login': 'login',
  '/api/v1/me': 'profile',
  '/api/v1/me/password': 'password',
  '/api/v1/auth/refresh': 'refresh',
  '/api/v1/auth/logout': 'logout',
};
@Injectable({ providedIn: 'root' })
export class AuthFixtureTransport {
  private readonly scenarioName =
    new URLSearchParams(location.search).get('authFixture') ??
    (environment.enableSupervisorPreview && location.pathname.startsWith('/wash/supervision')
      ? 'supervisor'
      : 'normal');
  private readonly scenario: Scenario | undefined = (data.scenarios as Record<string, Scenario>)[
    this.scenarioName
  ];
  private readonly calls: Partial<Record<Operation, number>> = {};
  private serial = 0;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private restricted = false;
  private consumed = false;
  response(request: HttpRequest<unknown>, operation: Operation) {
    if (!this.scenario)
      return this.error(
        {
          status: 400,
          body: { code: 'FIXTURE.UNKNOWN_SCENARIO', traceId: 'fixture-unknown-scenario' },
        },
        request.url,
      );
    const body = request.body as Record<string, unknown> | null;
    const expectedMethod = operation === 'profile' ? 'GET' : 'POST';
    if (request.method !== expectedMethod) return this.error(data.responses.request, request.url);
    if (operation === 'login') {
      const keys = Object.keys(body ?? {});
      if (
        !body ||
        !['MATRICULA', 'USERNAME'].includes(String(body['loginType'])) ||
        typeof body['loginIdentifier'] !== 'string' ||
        !body['loginIdentifier'].trim() ||
        typeof body['password'] !== 'string' ||
        !body['password'] ||
        keys.some(
          (key) => !['loginType', 'loginIdentifier', 'password', 'deviceName'].includes(key),
        )
      )
        return this.error(data.responses.request, request.url);
      if (this.consumed) return this.error(data.responses.invalid, request.url);
    } else if (operation !== 'refresh') {
      if (
        !this.accessToken ||
        request.headers.get('Authorization') !== `Bearer ${this.accessToken}`
      )
        return this.error(data.responses.expired, request.url);
      if (this.restricted && operation === 'profile')
        return this.error(data.responses.forbidden, request.url);
    }
    if (
      operation === 'refresh' &&
      (!body ||
        !this.refreshToken ||
        body['refreshToken'] !== this.refreshToken ||
        body['sessionId'] !== '22222222-2222-4222-8222-222222222222')
    )
      return this.error(data.responses.invalid, request.url);
    if (
      operation === 'password' &&
      (!body ||
        body['currentPassword'] !== null ||
        typeof body['newPassword'] !== 'string' ||
        body['newPassword'].length < 15 ||
        body['newPassword'].length > 128 ||
        Object.keys(body).some((key) => !['currentPassword', 'newPassword'].includes(key)))
    )
      return this.error(data.responses.request, request.url);
    const index = this.calls[operation] ?? 0;
    this.calls[operation] = index + 1;
    const replies = this.scenario[operation];
    const reply = (data.responses as Record<string, Reply>)[
      replies[Math.min(index, replies.length - 1)]
    ];
    if (reply.status !== 200) return this.error(reply, request.url);
    let result = structuredClone(reply.body);
    if (operation === 'login' || operation === 'password' || operation === 'refresh') {
      const template = JSON.stringify(result);
      if (template.includes('{{accessToken}}')) {
        this.serial++;
        const lifetime = operation === 'login' ? (this.scenario.accessLifetimeSeconds ?? 900) : 900;
        const encode = (value: unknown) =>
          btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
        this.accessToken = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ exp: Math.floor(Date.now() / 1000) + lifetime, fixture: true, jti: this.serial })}.fixture-not-a-real-signature`;
        this.restricted =
          (result as { authState?: string }).authState === 'PASSWORD_CHANGE_REQUIRED';
        this.refreshToken = this.restricted ? null : `fixture-refresh-${this.serial}`;
        this.consumed ||= this.restricted;
        result = JSON.parse(
          template
            .replaceAll('{{accessToken}}', this.accessToken)
            .replaceAll('{{refreshToken}}', this.refreshToken ?? '')
            .replaceAll('{{sessionExpiresAt}}', new Date(Date.now() + 14 * 86400000).toISOString()),
        );
      }
    }
    if (operation === 'logout') {
      this.accessToken = null;
      this.refreshToken = null;
    }
    return of(new HttpResponse({ status: 200, body: result, url: request.url }));
  }
  private error(reply: Reply, url: string) {
    return throwError(
      () =>
        new HttpErrorResponse({
          status: reply.status,
          error: structuredClone(reply.body),
          url,
          headers: new HttpHeaders({ 'Content-Type': 'application/problem+json' }),
        }),
    );
  }
}
export const authFixtureInterceptor: HttpInterceptorFn = (request, next) => {
  const operation = routes[request.url.split('?')[0]];
  if (!operation) return next(request);
  const transport = inject(AuthFixtureTransport);
  return timer(450).pipe(mergeMap(() => transport.response(request, operation)));
};
