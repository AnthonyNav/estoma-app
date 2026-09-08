import { ApplicationError } from '../../../core/api/application-error';
import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { StudentExitService } from './student-exit.service';
import {
  STUDENT_EXIT_GATEWAY,
  StudentExitGateway,
  emptyMaterials,
  validMaterials,
} from '../domain/student-exit';
import { STUDENT_WASH_HOME_GATEWAY } from '../../wash-student-home/domain/ports/student-wash-home.gateway';
import { StudentWashHome } from '../../wash-student-home/domain/models/student-wash-home';
import { SessionStore } from '../../authentication/application/session-store.service';
import { OperationTrackerService } from '../../../core/api/operation-tracker.service';
import { DurableOperation } from '../../wash-appointments/domain/models/appointment-registration';
const materials = { ...emptyMaterials(), packageCount: 2 };
const home = {
  student: { firstName: 'Ana', fullName: 'Ana García', studentEnrollment: '201945678' },
  serviceDate: '2026-09-06',
  appointment: {
    appointmentId: 'appointment',
    appointmentStatus: 'IN_PROGRESS',
    appointmentType: 'NORMAL',
    appointmentVersion: 99,
    qrUsageContext: 'NONE',
    qrRepresentation: null,
    washExecution: { washExecutionId: 'execution', status: 'IN_PROGRESS', executionVersion: 3 },
  },
} as StudentWashHome;
describe('Student exit', () => {
  let api: jasmine.SpyObj<StudentExitGateway>,
    operations: Subject<DurableOperation>,
    flow: StudentExitService;
  beforeEach(() => {
    sessionStorage.removeItem('estoma.student-exit.receipts.v1');
    api = jasmine.createSpyObj('exit', ['submit', 'operation']);
    operations = new Subject();
    TestBed.configureTestingModule({
      providers: [
        { provide: STUDENT_EXIT_GATEWAY, useValue: api },
        {
          provide: STUDENT_WASH_HOME_GATEWAY,
          useValue: {
            loadHome: () =>
              of({
                ...home,
                appointment: {
                  ...home.appointment!,
                  washExecution: {
                    ...home.appointment!.washExecution!,
                    status: 'EXIT_SUBMITTED',
                    executionVersion: 4,
                    submittedExitMaterials: materials,
                  },
                },
              }),
          },
        },
        { provide: OperationTrackerService, useValue: { trackWith: () => operations } },
      ],
    });
    TestBed.inject(SessionStore).session.set({
      accountId: 'student',
      sessionId: 's',
      accessToken: 'secret-token',
      refreshToken: null,
      authState: 'NORMAL',
      accessExpiresAt: Date.now() + 60000,
    });
    api.submit.and.returnValue(
      of({
        operationId: 'op',
        status: 'PENDING',
        pollPath: '/api/v1/operations/op',
        submittedAt: new Date().toISOString(),
      }),
    );
    flow = TestBed.inject(StudentExitService);
  });
  afterEach(() => sessionStorage.removeItem('estoma.student-exit.receipts.v1'));
  it('rejects empty, fractional, negative and overflowing quantities', () => {
    expect(validMaterials(emptyMaterials())).toBeFalse();
    for (const packageCount of [-1, 1.5, 2147483648, NaN])
      expect(validMaterials({ ...materials, packageCount })).toBeFalse();
    expect(validMaterials(materials)).toBeTrue();
    flow.start(home, emptyMaterials());
    expect(api.submit).not.toHaveBeenCalled();
  });
  it('uses execution version, waits for confirmation and prevents duplicate submissions', fakeAsync(() => {
    flow.start(home, materials);
    flushMicrotasks();
    flow.start(home, materials);
    expect(api.submit).toHaveBeenCalledTimes(1);
    expect(api.submit.calls.mostRecent().args[0].expectedVersion).toBe(3);
    operations.next({ operationId: 'op', status: 'PENDING' });
    flushMicrotasks();
    expect(flow.settled()).toBeNull();
    operations.next({ operationId: 'op', status: 'SUCCEEDED' });
    flushMicrotasks();
    expect(flow.pending()).toBeNull();
    expect(flow.settled()?.appointment?.washExecution?.status).toBe('EXIT_SUBMITTED');
  }));
  it('preserves the exact request when its response is lost', fakeAsync(() => {
    api.submit.and.returnValue(throwError(() => new Error('offline')));
    flow.start(home, materials);
    flushMicrotasks();
    const original = api.submit.calls.mostRecent().args[0];
    void flow.resume();
    flushMicrotasks();
    expect(api.submit.calls.mostRecent().args[0]).toEqual(original);
    expect(sessionStorage.getItem('estoma.student-exit.receipts.v1')).not.toContain('secret-token');
    const restored = TestBed.runInInjectionContext(() => new StudentExitService());
    expect(restored.pending()?.command).toEqual(original);
  }));
  it('keeps inconclusive operations and blocks resubmission', fakeAsync(() => {
    spyOn(TestBed.inject(STUDENT_WASH_HOME_GATEWAY), 'loadHome').and.returnValue(of(home));
    flow.start(home, materials);
    flushMicrotasks();
    operations.next({ operationId: 'op', status: 'EXPIRED' });
    flushMicrotasks();
    flow.start(home, materials);
    expect(api.submit).toHaveBeenCalledTimes(1);
    expect(flow.pending()?.operationId).toBe('op');
    expect(flow.settled()).toBeNull();
  }));
  for (const status of [400, 403, 422]) {
    it(`retains an earlier uncertain intent when a retry returns ${status} (HTTP ${status})`, fakeAsync(() => {
      api.submit.and.returnValue(throwError(() => new Error('response lost')));
      flow.start(home, materials);
      flushMicrotasks();
      const original = api.submit.calls.mostRecent().args[0];
      api.submit.and.returnValue(
        throwError(() => new ApplicationError('forbidden', 'Access changed', status)),
      );
      const restored = TestBed.runInInjectionContext(() => new StudentExitService());
      void restored.resume();
      flushMicrotasks();
      expect(api.submit.calls.mostRecent().args[0]).toEqual(original);
      expect(restored.pending()?.command).toEqual(original);
    }));
  }
  it('reconciles expired tracking when the same student submission is visible', fakeAsync(() => {
    flow.start(home, materials);
    flushMicrotasks();
    operations.next({ operationId: 'op', status: 'EXPIRED' });
    flushMicrotasks();
    expect(flow.pending()).toBeNull();
    expect(flow.settled()?.appointment?.washExecution?.status).toBe('EXIT_SUBMITTED');
    expect(api.submit).toHaveBeenCalledTimes(1);
  }));
});
