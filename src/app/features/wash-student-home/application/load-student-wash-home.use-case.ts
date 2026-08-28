import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { StudentWashHome } from '../domain/models/student-wash-home';
import { STUDENT_WASH_HOME_GATEWAY } from '../domain/ports/student-wash-home.gateway';

@Injectable({ providedIn: 'root' })
export class LoadStudentWashHomeUseCase {
  private readonly gateway = inject(STUDENT_WASH_HOME_GATEWAY);

  execute(): Observable<StudentWashHome> {
    return this.gateway.loadHome();
  }
}
