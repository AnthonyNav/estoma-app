import { inject, Injectable } from '@angular/core';
import { MockWashJourneyStore } from '../../wash-student-home/infrastructure/mock/mock-wash-journey.store';
import { StudentExitCommand, StudentExitGateway } from '../domain/student-exit';
@Injectable()
export class MockStudentExitAdapter implements StudentExitGateway {
  private readonly journey = inject(MockWashJourneyStore);
  submit(command: StudentExitCommand) {
    return this.journey.submitStudentExit(command);
  }
  operation(id: string) {
    return this.journey.getOperation(id);
  }
}
