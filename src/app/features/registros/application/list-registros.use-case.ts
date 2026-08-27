import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { Registro } from '../domain/models/registro';
import { REGISTROS_GATEWAY } from '../domain/ports/registros.gateway';

@Injectable({ providedIn: 'root' })
export class ListRegistrosUseCase {
  private readonly gateway = inject(REGISTROS_GATEWAY);

  execute(): Observable<Registro[]> {
    return this.gateway.listRegistros();
  }
}
