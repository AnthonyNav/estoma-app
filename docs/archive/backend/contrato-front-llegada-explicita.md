> Archivo de trazabilidad: refleja el estado de su fecha original, no el estado vigente. Consultar el [índice actual](../../README.md).

# Llegada explícita y decisión de ingreso

Confirmación técnica contra BFF `237f5c07` y Wash Execution `7c837a6`. Las consultas de tarjeta, QR o matrícula son de sólo lectura; no deben registrar presencia.

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

El rechazo con motivo libre sin clasificar verificaciones depende de PR160, ya integrado y desplegado en BFF `dff3ea2`; habilitación y prueba distribuida todavía pendientes. Véase [contrato de rechazo](contrato-front-rechazo-ingreso.md). No enviar `false/false` para representar “no evaluado”.

La lectura exacta por ejecución ya está disponible; el directorio y la selección inicial por `appointmentId` siguen pendientes. Al recuperar contexto mediante matrícula, verificar que `appointmentId` coincide con la cita seleccionada antes de enviar comandos.
