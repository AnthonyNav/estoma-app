import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { Registro } from '../domain/models/registro';
import { CrearRegistroCommand, REGISTROS_GATEWAY } from '../domain/ports/registros.gateway';

@Injectable({ providedIn: 'root' })
export class CrearRegistroUseCase {
  private readonly gateway = inject(REGISTROS_GATEWAY);

  execute(command: CrearRegistroCommand): Observable<Registro> {
    return this.gateway.crearRegistro(command);
  }
}
