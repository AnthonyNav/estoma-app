import { Injectable, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Observable } from 'rxjs';

import { StudentWashHome } from '../../domain/models/student-wash-home';
import { StudentWashHomeGateway } from '../../domain/ports/student-wash-home.gateway';
import { MockWashJourneyStore, StudentHomeFixture } from './mock-wash-journey.store';

const fixtures: readonly StudentHomeFixture[] = [
  'loading',
  'no-appointment',
  'scheduled-no-qr',
  'scheduled-entry-qr',
  'pending-entry',
  'pending-reassignment',
  'in-progress',
  'exit-submitted',
  'completed',
  'cancelled',
  'missed',
  'entry-rejected',
  'temporary-unavailable',
  'forbidden',
  'offline',
];

@Injectable()
export class MockStudentWashHomeAdapter implements StudentWashHomeGateway {
  private readonly route = inject(ActivatedRoute);
  private readonly journey = inject(MockWashJourneyStore);

  loadHome(): Observable<StudentWashHome> {
    return this.journey.loadStudentHome(this.readFixture());
  }

  private readFixture(): StudentHomeFixture | null {
    const fixture = this.route.snapshot.queryParamMap.get('fixture');
    return fixture && fixtures.includes(fixture as StudentHomeFixture)
      ? (fixture as StudentHomeFixture)
      : null;
  }
}
