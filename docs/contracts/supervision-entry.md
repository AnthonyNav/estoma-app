# Ingreso del alumno

Fuentes: [llegada explícita](../archive/backend/contrato-front-llegada-explicita.md) y [rechazo](../archive/backend/contrato-front-rechazo-ingreso.md). Aplican las [reglas comunes](common.md); despliegue/activación en [estado](../integration/status.md). Consultar alumno no registra llegada.

## Aprobar ingreso desde una sola acción

Es compatible encadenar llegada y aprobación desde “Aprobar ingreso”, siempre que esa acción represente la confirmación del supervisor de que el alumno está presente. No requiere otra pantalla ni un endpoint combinado, pero son dos operaciones independientes, no una transacción atómica.

1. Leer el contexto actual de la cita seleccionada. Si ya existe ejecución, no volver a registrar llegada; comprobar su estado.
2. Si no hay ejecución y el alumno está presente, enviar `POST /api/v1/wash/executions/arrivals` con `appointmentId` y su propia `Idempotency-Key`.
3. Esperar `SUCCEEDED` y recuperar la ejecución correspondiente a esa misma cita, con ID y versión actuales, hasta observar `PENDING_ENTRY`. No inventar versión ni continuar sólo por recibir `202`.
4. Enviar `POST /api/v1/wash/executions/{washExecutionId}/entry-decision` con otra clave para esta operación: `decision=AUTHORIZED`, `identityConfirmed=true`, `requirementsSatisfied=true`, `expectedVersion` leída y motivo ausente/null.
5. Esperar operación y convergencia. `IN_PROGRESS` confirma ingreso con recursos; `PENDING_REASSIGNMENT` representa autorización sin recursos y debe mostrarse como tal.

Conservar por separado ambos recibos, claves y cuerpos para recuperar tras recarga. Si llegada ya terminó y decisión falla, no repetir llegada. Un timeout/FAILED/EXPIRED exige reconciliar, no empezar otra cadena. Si otro supervisor creó la ejecución (`WASH_EXECUTION_ALREADY_EXISTS`), refrescar y comprobar la misma cita/estado antes de continuar.

La llegada exige cita `SCHEDULED`, horario activo y estar entre 15 minutos antes del inicio y `arrivalToleranceUntil`, inclusive. Puede rechazar con `ARRIVAL_TOO_EARLY` o `ARRIVAL_TOLERANCE_EXCEEDED`; en ese caso no enviar decisión. El reloj y la hora de llegada los determina backend.

## Rechazar antes de haber registrado llegada

El backend actual exige ejecución existente en `PENDING_ENTRY` para cualquier decisión de ingreso. No hay un comando de rechazo de ingreso previo a llegada.

- Alumno presente, sin ejecución: “Rechazar ingreso” puede confirmar explícitamente su presencia y encadenar llegada → operación/lectura → rechazo, con las mismas garantías anteriores. No se asignan recursos al registrar llegada ni al rechazar.
- Ejecución ya en `PENDING_ENTRY`: enviar directamente la decisión con su versión actual.
- Alumno ausente: no registrar presencia para habilitar un rechazo. Un rechazo administrativo previo a llegada requeriría una regla y operación diferentes; no está incluido en el contrato actual.

## Solicitud nueva

Ruta existente: `POST /api/v1/wash/executions/{washExecutionId}/entry-decision`, con sesión de supervisor de Lavado y cabecera `Idempotency-Key`.

```json
{
  "decision": "REJECTED",
  "rejectionReason": "Motivo operativo indicado por el supervisor",
  "expectedVersion": 1
}
```

El motivo debe contener texto no blanco y tener máximo 500 caracteres. Ambos campos `identityConfirmed` y `requirementsSatisfied` pueden omitirse o enviarse como null; ambas formas representan la misma intención. No se envían al Command del owner. No sustituirlos por `false/false`: esa pareja declara dos resultados negativos y sigue siendo una intención distinta.

Para aprobar, enviar `decision=AUTHORIZED`, ambos booleanos exactamente true y motivo ausente/null. El backend deriva identidad del supervisor y hora de decisión; front no los suministra.

## Respuestas y recuperación

| Resultado                                               | Comportamiento de front                                                                                                                    |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `202`                                                   | Conservar `operationId`, `pollPath`, clave, cuerpo y versión; consultar la operación. Aún no confirmar el rechazo de ingreso.              |
| `400 BFF.INVALID_REQUEST`                               | Corregir combinación, tipos o motivo. La solicitud inválida no crea operación.                                                             |
| `401` / `403`                                           | Recuperar sesión o informar falta de acceso; no volver a enviar automáticamente.                                                           |
| `503 BFF.WASH_UNCLASSIFIED_ENTRY_REJECTION_UNAVAILABLE` | Capacidad nueva deshabilitada; no se creó operación. No convertir el motivo a `false/false` ni hacer polling de una operación inexistente. |
| `409 BFF.IDEMPOTENCY_CONFLICT`                          | La clave corresponde a otra intención; reconciliar la solicitud previa antes de crear otra.                                                |

Después de `202`, consultar `OperationResponse.status`. `SUCCEEDED` significa que el owner aceptó el comando de rechazo: refrescar la lectura exacta de esa ejecución y comprobar `ENTRY_REJECTED` con versión posterior. Un `REJECTED` de operación significa que el owner rechazó **el comando**, no que se haya registrado el rechazo de ingreso; consultar `errorCode` en raíz. `FAILED`, `EXPIRED` o un timeout no prueban ausencia de efectos: conservar la referencia y reconciliar operación y ejecución antes de otro intento.

Tras recargar, recuperar la referencia guardada para la misma cuenta. Reintentar la misma intención conserva la misma clave y cuerpo; omisión y null son equivalentes, pero cambiar a booleanos clasificados no lo es. No hay recuperación garantizada de una operación si se perdió su identificador y la clave.

## Interfaz y pruebas

Aprobar confirma presencia, identidad y requisitos sin checkboxes. Confirmar rechazo declara presencia y motivo; cancelar diálogo no modifica nada. Home llama registeredAppointments «Citas del día» y se actualiza cada tres minutos.

Pruebas: supervisor-entry-workflow.service.spec.ts, http-wash-supervision.adapter.spec.ts y wash-entry-supervision.page.spec.ts. Directorio por nombre sólo mock; HTTP usa matrícula exacta y comprueba identidad de cita.
