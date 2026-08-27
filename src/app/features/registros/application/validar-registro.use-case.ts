import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { Registro } from '../domain/models/registro';
import { REGISTROS_GATEWAY, RechazarRegistroCommand } from '../domain/ports/registros.gateway';

@Injectable({ providedIn: 'root' })
export class ValidarRegistroUseCase {
  private readonly gateway = inject(REGISTROS_GATEWAY);

  confirmar(registroId: string): Observable<Registro> {
    return this.gateway.confirmarRegistro(registroId);
  }

  rechazar(command: RechazarRegistroCommand): Observable<Registro> {
    return this.gateway.rechazarRegistro(command);
  }
}
