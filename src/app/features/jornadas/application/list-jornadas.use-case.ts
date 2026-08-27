import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { Jornada, TipoJornada } from '../domain/models/jornada';
import { JORNADAS_GATEWAY } from '../domain/ports/jornadas.gateway';

@Injectable({ providedIn: 'root' })
export class ListJornadasUseCase {
  private readonly gateway = inject(JORNADAS_GATEWAY);

  execute(): Observable<Jornada[]> {
    return this.gateway.listJornadas();
  }

  tipos(): Observable<TipoJornada[]> {
    return this.gateway.listTiposJornada();
  }
}
