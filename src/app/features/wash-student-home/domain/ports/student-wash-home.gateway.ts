import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

import { StudentWashHome } from '../models/student-wash-home';

export interface StudentWashHomeGateway {
  loadHome(): Observable<StudentWashHome>;
}

export const STUDENT_WASH_HOME_GATEWAY = new InjectionToken<StudentWashHomeGateway>(
  'STUDENT_WASH_HOME_GATEWAY',
);
