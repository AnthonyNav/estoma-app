import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { AcceptedOperation, DurableOperation } from '../../../core/api/durable-operation';
import { REGISTROS_GATEWAY, RechazarRegistroCommand } from '../domain/ports/registros.gateway';

@Injectable({ providedIn: 'root' })
export class ValidarRegistroUseCase {
  private readonly gateway = inject(REGISTROS_GATEWAY);

  confirmar(registroId: string, idempotencyKey: string): Observable<AcceptedOperation> {
    return this.gateway.confirmarRegistro(registroId, idempotencyKey);
  }

  rechazar(command: RechazarRegistroCommand): Observable<AcceptedOperation> {
    return this.gateway.rechazarRegistro(command);
  }

  getOperation(operationId: string): Observable<DurableOperation> {
    return this.gateway.getOperation(operationId);
  }
}
