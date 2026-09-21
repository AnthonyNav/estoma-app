import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { AcceptedOperation, DurableOperation } from '../../../core/api/durable-operation';
import { CancelarJornadaCommand, JORNADAS_GATEWAY } from '../domain/ports/jornadas.gateway';

@Injectable({ providedIn: 'root' })
export class CancelarJornadaUseCase {
  private readonly gateway = inject(JORNADAS_GATEWAY);

  execute(command: CancelarJornadaCommand): Observable<AcceptedOperation> {
    return this.gateway.cancelarJornada(command);
  }

  getOperation(operationId: string): Observable<DurableOperation> {
    return this.gateway.getOperation(operationId);
  }
}
