import { ApplicationError } from '../../../core/api/application-error';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { OperationTrackerService } from '../../../core/api/operation-tracker.service';
import { SessionStore } from '../../authentication/application/session-store.service';
import { SessionLifecycleService } from '../../../core/session/session-lifecycle.service';
import { DurableOperation } from '../domain/models/appointment-registration';
import { AppointmentCancellationService } from './appointment-cancellation.service';
import { WashAppointmentRegistrationUseCase } from './wash-appointment-registration.use-case';

describe('AppointmentCancellationService', () => {
  beforeEach(() => sessionStorage.removeItem('estoma.cancellation.receipts.v1'));
  afterEach(() => sessionStorage.removeItem('estoma.cancellation.receipts.v1'));
  let api: jasmine.SpyObj<WashAppointmentRegistrationUseCase>;
  let operations: Subject<DurableOperation>;
  let service: AppointmentCancellationService;
  beforeEach(() => {
    api = jasmine.createSpyObj('api', ['cancel', 'getOperation']);
    operations = new Subject();
    TestBed.configureTestingModule({
      providers: [
        { provide: WashAppointmentRegistrationUseCase, useValue: api },
        { provide: OperationTrackerService, useValue: { trackWith: () => operations } },
      ],
    });
    TestBed.inject(SessionStore).session.set({
      accountId: 'a',
      sessionId: 's',
      accessToken: 't',
      refreshToken: null,
      authState: 'NORMAL',
      accessExpiresAt: Date.now() + 60000,
    });
    service = TestBed.inject(AppointmentCancellationService);
    api.cancel.and.returnValue(
      of({
        operationId: 'op',
        status: 'PENDING',
        submittedAt: '',
        pollPath: '/api/v1/operations/op',
      }),
    );
  });
  it('restores the accepted receipt after reload and polls without another cancellation', () => {
    service.start('appointment', 3);
    const command = service.pending()!.command;
    const restored = TestBed.runInInjectionContext(() => new AppointmentCancellationService());
    expect(restored.pending()?.command).toEqual(command);
    restored.resume();
    expect(api.cancel).toHaveBeenCalledTimes(1);
  });
  it('does not submit when the receipt cannot be persisted', () => {
    spyOn(Storage.prototype, 'setItem').and.throwError('storage unavailable');
    service.start('appointment', 3);
    expect(api.cancel).not.toHaveBeenCalled();
    expect(service.pending()).toBeNull();
  });
  it('reuses the original command after an ambiguous response and prevents double submission', () => {
    api.cancel.and.returnValue(throwError(() => new Error('network')));
    service.start('appointment', 3);
    service.start('appointment', 3);
    service.resume();
    expect(api.cancel).toHaveBeenCalledTimes(2);
    expect(api.cancel.calls.argsFor(0)[0]).toEqual(api.cancel.calls.argsFor(1)[0]);
  });
  for (const status of ['PENDING', 'SUCCEEDED', 'FAILED', 'EXPIRED'] as const) {
    it(`retains reconciliation data for ${status}`, () => {
      service.start('appointment', 3);
      operations.next({ operationId: 'op', status });
      expect(service.pending()?.operationId).toBe('op');
      expect(api.cancel).toHaveBeenCalledTimes(1);
      if (status === 'SUCCEEDED') {
        service.resume();
        expect(api.cancel).toHaveBeenCalledTimes(1);
      }
    });
  }
  it('clears definitive rejection and asks Home to refresh', () => {
    service.start('appointment', 3);
    operations.next({
      operationId: 'op',
      status: 'REJECTED',
      errorCode: 'CANCELLATION_DEADLINE_PASSED',
    });
    expect(service.pending()).toBeNull();
    expect(service.message()).toContain('plazo');
    expect(service.settled()).toBe(1);
  });
  it('isolates pending operations across accounts and stops old polling on logout', () => {
    service.start('appointment', 3);
    const session = TestBed.inject(SessionStore);
    const original = session.session()!;
    session.clear();
    TestBed.inject(SessionLifecycleService).end();
    session.session.set({ ...original, accountId: 'b' });
    operations.next({ operationId: 'op', status: 'SUCCEEDED' });
    expect(service.pending()).toBeNull();
    expect(service.settled()).toBe(0);
    session.session.set(original);
    expect(service.pending()?.operationId).toBe('op');
  });
  for (const status of [400, 403, 422]) {
    it(`preserves the original cancellation when access changes after a lost response (HTTP ${status})`, () => {
      api.cancel.and.returnValue(throwError(() => new Error('lost response')));
      service.start('appointment', 3);
      const original = service.pending()!.command;
      api.cancel.and.returnValue(
        throwError(() => new ApplicationError('forbidden', 'Forbidden', status)),
      );
      const restored = TestBed.runInInjectionContext(() => new AppointmentCancellationService());
      restored.resume();
      expect(restored.pending()?.command).toEqual(original);
      expect(api.cancel.calls.mostRecent().args[0]).toEqual(original);
    });
  }
  it('requests Home reconciliation when operation tracking fails', () => {
    service.start('appointment', 3);
    operations.error(new ApplicationError('not-found', '', 404));
    expect(service.settled()).toBe(1);
    expect(service.pending()?.operationId).toBe('op');
  });
});
