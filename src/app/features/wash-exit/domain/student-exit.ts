import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AcceptedOperation,
  DurableOperation,
} from '../../wash-appointments/domain/models/appointment-registration';
export interface ExitMaterials {
  packageCount: number;
  greenPaperCassette8Count: number;
  greenPaperCassette10Count: number;
  witnessTapePortionCount: number;
}
export const materialFields = [
  {
    key: 'packageCount',
    label: 'Paquetes',
    description: 'Paquetes preparados para esterilizar',
    icon: 'M4 7l8-4 8 4v10l-8 4-8-4V7Zm0 0 8 4 8-4M12 11v10',
  },
  {
    key: 'greenPaperCassette8Count',
    label: 'Papel verde · cassette de 8',
    description: 'Cantidad de papel utilizado',
    icon: 'M6 3h9l4 4v14H6V3Zm8 0v5h5M9 12h7m-7 4h7',
  },
  {
    key: 'greenPaperCassette10Count',
    label: 'Papel verde · cassette de 10',
    description: 'Cantidad de papel utilizado',
    icon: 'M6 3h9l4 4v14H6V3Zm8 0v5h5M9 12h7m-7 4h7',
  },
  {
    key: 'witnessTapePortionCount',
    label: 'Cinta testigo',
    description: 'Número de porciones utilizadas',
    icon: 'M12 3a8 8 0 1 0 8 8v9h-8M12 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  },
] as const;
export function validMaterials(value: ExitMaterials | null | undefined): value is ExitMaterials {
  return (
    !!value &&
    materialFields.every(
      ({ key }) => Number.isInteger(value[key]) && value[key] >= 0 && value[key] <= 2147483647,
    ) &&
    materialFields.some(({ key }) => value[key] > 0)
  );
}
export function emptyMaterials(): ExitMaterials {
  return {
    packageCount: 0,
    greenPaperCassette8Count: 0,
    greenPaperCassette10Count: 0,
    witnessTapePortionCount: 0,
  };
}
export interface StudentExitCommand {
  washExecutionId: string;
  expectedVersion: number;
  materials: ExitMaterials;
  idempotencyKey: string;
}
export interface StudentExitGateway {
  submit(command: StudentExitCommand): Observable<AcceptedOperation>;
  operation(id: string): Observable<DurableOperation>;
}
export const STUDENT_EXIT_GATEWAY = new InjectionToken<StudentExitGateway>('STUDENT_EXIT_GATEWAY');
