import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { AcceptedOperation, DurableOperation } from '../../../core/api/durable-operation';
import { JORNADAS_GATEWAY, PublicarJornadaCommand } from '../domain/ports/jornadas.gateway';

@Injectable({ providedIn: 'root' })
export class PublicarJornadaUseCase {
  private readonly gateway = inject(JORNADAS_GATEWAY);

  execute(command: PublicarJornadaCommand): Observable<AcceptedOperation> {
    return this.gateway.publicarJornada(command);
  }

  getOperation(operationId: string): Observable<DurableOperation> {
    return this.gateway.getOperation(operationId);
  }
}
