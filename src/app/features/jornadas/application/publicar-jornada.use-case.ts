import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { Jornada } from '../domain/models/jornada';
import { JORNADAS_GATEWAY, PublicarJornadaCommand } from '../domain/ports/jornadas.gateway';

@Injectable({ providedIn: 'root' })
export class PublicarJornadaUseCase {
  private readonly gateway = inject(JORNADAS_GATEWAY);

  execute(command: PublicarJornadaCommand): Observable<Jornada> {
    return this.gateway.publicarJornada(command);
  }
}
