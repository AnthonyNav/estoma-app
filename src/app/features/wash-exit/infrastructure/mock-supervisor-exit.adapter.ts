import { inject, Injectable } from '@angular/core';
import { MockWashJourneyStore } from '../../wash-student-home/infrastructure/mock/mock-wash-journey.store';
import { CompleteExitCommand, SupervisorExitGateway } from '../domain/supervisor-exit';
@Injectable()
export class MockSupervisorExitAdapter implements SupervisorExitGateway {
  private readonly journey = inject(MockWashJourneyStore);
  complete(command: CompleteExitCommand) {
    return this.journey.completeStudentExit(command);
  }
  operation(id: string) {
    return this.journey.getOperation(id);
  }
  detail(id: string) {
    return this.journey.supervisorExecutionDetail(id);
  }
}
