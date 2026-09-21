import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { AcceptedOperation, DurableOperation } from '../../../core/api/durable-operation';
import { CrearRegistroCommand, REGISTROS_GATEWAY } from '../domain/ports/registros.gateway';

@Injectable({ providedIn: 'root' })
export class CrearRegistroUseCase {
  private readonly gateway = inject(REGISTROS_GATEWAY);

  execute(command: CrearRegistroCommand): Observable<AcceptedOperation> {
    return this.gateway.crearRegistro(command);
  }

  getOperation(operationId: string): Observable<DurableOperation> {
    return this.gateway.getOperation(operationId);
  }
}
