import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { SessionLifecycleService } from '../../../core/session/session-lifecycle.service';
import {
  AuthorizationStudent,
  ExceptionalAuthorizationsService,
} from '../application/exceptional-authorizations.service';
import { ExceptionalAuthorizationsPage } from './exceptional-authorizations.page';

describe('ExceptionalAuthorizationsPage session boundary', () => {
  it('clears displayed personal data and ignores late search responses after logout', () => {
    const response = new Subject<AuthorizationStudent[]>();
    TestBed.configureTestingModule({
      providers: [
        { provide: ExceptionalAuthorizationsService, useValue: { search: () => response } },
      ],
    });
    const page = TestBed.runInInjectionContext(() => new ExceptionalAuthorizationsPage());
    const student = { accountId: 'student', enrollment: '123', fullName: 'Alumno' };
    page.query = 'Alumno';
    page.search();
    page.selected.set(student);
    page.students.set([student]);
    page.reason = 'Personal reason';
    TestBed.inject(SessionLifecycleService).end();
    response.next([student]);
    expect(page.students()).toEqual([]);
    expect(page.selected()).toBeNull();
    expect(page.query).toBe('');
    expect(page.reason).toBe('');
    expect(page.loading()).toBeFalse();
  });
});
