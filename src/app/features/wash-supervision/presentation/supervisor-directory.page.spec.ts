import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { WashEntrySupervisionUseCase } from '../application/wash-entry-supervision.use-case';
import { SupervisorEntryWorkflowService } from '../application/supervisor-entry-workflow.service';
import { SupervisorDirectoryPage } from './supervisor-directory.page';
import examples from '../testing/entry-responses.fixture.json';
import { SupervisorEntryLookup } from '../domain/models/supervisor-entry';

describe('Real supervisor directory', () => {
  const row = examples.lookupBeforeArrival as SupervisorEntryLookup;
  let api: jasmine.Spy;
  let search: jasmine.Spy;
  let navigate: jasmine.Spy;
  beforeEach(() => {
    api = jasmine
      .createSpy()
      .and.returnValue(of({ serviceDate: row.serviceDate, items: [row], nextOffset: 25 }));
    search = jasmine.createSpy();
    navigate = jasmine.createSpy().and.resolveTo(true);
    TestBed.configureTestingModule({
      providers: [
        { provide: WashEntrySupervisionUseCase, useValue: { getDirectory: api } },
        { provide: Router, useValue: { navigate } },
        {
          provide: SupervisorEntryWorkflowService,
          useValue: {
            search,
            reset: () => {},
            busy: signal(false),
            pending: signal(null),
            error: signal(null),
          },
        },
      ],
    }).overrideComponent(SupervisorDirectoryPage, { set: { template: '', imports: [] } });
  });
  it('loads real data and follows server pagination', () => {
    const page = TestBed.createComponent(SupervisorDirectoryPage).componentInstance;
    expect(api).toHaveBeenCalledOnceWith({ query: '', status: 'ALL', offset: 0 });
    expect(page.rows()).toEqual([row]);
    api.and.returnValue(of({ serviceDate: row.serviceDate, items: [], nextOffset: null }));
    page.load(true);
    expect(api.calls.mostRecent().args[0].offset).toBe(25);
    expect(page.nextOffset()).toBeNull();
  });
  it('does not navigate from a stale row before a fresh lookup succeeds', () => {
    const page = TestBed.createComponent(SupervisorDirectoryPage).componentInstance;
    page.select(row);
    expect(navigate).not.toHaveBeenCalled();
    expect(search.calls.mostRecent().args[0]).toEqual({
      lookupType: 'STUDENT_ENROLLMENT',
      studentEnrollment: row.student.studentEnrollment,
    });
    search.calls.mostRecent().args[1]();
    expect(navigate).toHaveBeenCalledOnceWith(['/wash/supervision/entry']);
  });
});
