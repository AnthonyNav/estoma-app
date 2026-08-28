import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { StudentWashHome } from '../../domain/models/student-wash-home';
import { StudentWashHomeGateway } from '../../domain/ports/student-wash-home.gateway';

@Injectable()
export class HttpStudentWashHomeAdapter implements StudentWashHomeGateway {
  private readonly http = inject(HttpClient);

  loadHome(): Observable<StudentWashHome> {
    return this.http.get<StudentWashHome>(`${environment.apiBaseUrl}/wash/student/home`);
  }
}
