import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { Jornada } from '../domain/models/jornada';
import { CancelarJornadaCommand, JORNADAS_GATEWAY } from '../domain/ports/jornadas.gateway';

@Injectable({ providedIn: 'root' })
export class CancelarJornadaUseCase {
  private readonly gateway = inject(JORNADAS_GATEWAY);

  execute(command: CancelarJornadaCommand): Observable<Jornada> {
    return this.gateway.cancelarJornada(command);
  }
}
