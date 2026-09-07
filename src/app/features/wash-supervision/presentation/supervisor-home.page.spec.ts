import { SupervisorExitService } from '../../wash-exit/application/supervisor-exit.service';
import { ReassignmentWorkflowService } from '../application/reassignment-workflow.service';
import { signal } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { SessionLifecycleService } from '../../../core/session/session-lifecycle.service';
import { SupervisorEntryWorkflowService } from '../application/supervisor-entry-workflow.service';
import { WashEntrySupervisionUseCase } from '../application/wash-entry-supervision.use-case';
import { SupervisorHomePage } from './supervisor-home.page';

describe('Supervisor home automatic refresh', () => {
  const home = {
    serviceDate: '2026-09-06',
    pendingReassignmentsCount: 0,
    summary: {
      registeredAppointments: 12,
      inProcessAppointments: 5,
      completedAppointments: 4,
      deniedAppointments: 1,
      cancelledAppointments: 0,
    },
  };
  let getHome: jasmine.Spy;
  beforeEach(() => {
    getHome = jasmine.createSpy('getHome').and.returnValue(of(home));
    TestBed.configureTestingModule({
      providers: [
        { provide: SupervisorExitService, useValue: { pending: signal(null) } },
        { provide: ReassignmentWorkflowService, useValue: { pending: signal(null) } },
        { provide: WashEntrySupervisionUseCase, useValue: { getHome } },
        { provide: SupervisorEntryWorkflowService, useValue: { pending: signal(null) } },
      ],
    }).overrideComponent(SupervisorHomePage, { set: { template: '', imports: [] } });
  });
  it('loads on entry, refreshes every three minutes and stops on leaving', fakeAsync(() => {
    const fixture = TestBed.createComponent(SupervisorHomePage);
    expect(getHome).toHaveBeenCalledTimes(1);
    tick(179999);
    expect(getHome).toHaveBeenCalledTimes(1);
    tick(1);
    expect(getHome).toHaveBeenCalledTimes(2);
    fixture.destroy();
    tick(180000);
    expect(getHome).toHaveBeenCalledTimes(2);
  }));
  it('retains the last counters after failure, recovers and stops on logout', fakeAsync(() => {
    const fixture = TestBed.createComponent(SupervisorHomePage);
    getHome.and.returnValue(throwError(() => new Error('offline')));
    tick(180000);
    expect(fixture.componentInstance.home()).toEqual(home);
    expect(fixture.componentInstance.error()).toBeTrue();
    getHome.and.returnValue(of({ ...home, pendingReassignmentsCount: 2 }));
    tick(180000);
    expect(fixture.componentInstance.home()?.pendingReassignmentsCount).toBe(2);
    expect(fixture.componentInstance.error()).toBeFalse();
    TestBed.inject(SessionLifecycleService).end();
    tick(180000);
    expect(getHome).toHaveBeenCalledTimes(3);
    fixture.destroy();
  }));
});
