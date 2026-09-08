> Archivo de trazabilidad: refleja el estado de su fecha original, no el estado vigente. Consultar el [índice actual](../../README.md).

# Reglas para el listado y flujo Front de reasignaciones pendientes

**Fecha de análisis:** 2026-09-06

**Alcance:** actualización contractual Front/BFF; investigación de solo lectura sobre el código vigente.

**Fuentes principales:** `wash-reassignment-client-contract.md`, `frontend-v1-contract-freeze.md`,
`wash-sup-02-resolver-reasignacion-pendiente.md`, BFF `platform-bff` y Front `estoma-app`.

## 1. Estado real encontrado

El BFF ya expone estas cuatro rutas:

```text
GET  /api/v1/wash/supervision/pending-reassignments
GET  /api/v1/wash/supervision/pending-reassignments/{washExecutionId}/candidates
POST /api/v1/wash/executions/{washExecutionId}/reassignment
POST /api/v1/wash/executions/{washExecutionId}/clinic-cancel
```

La primera consulta selecciona `wash_execution_read_model.status = PENDING_REASSIGNMENT` y ordena
por `authorized_at ASC NULLS LAST, wash_execution_id ASC`. La respuesta no está paginada.

El Front actual no implementa estas rutas. La tarjeta de Home sólo muestra
`pendingReassignmentsCount`; no existen modelos, gateway, adapter, workflow ni páginas de detalle de
reasignación. El `getDirectory()` existente corresponde a citas manuales y actualmente devuelve
`SUPERVISOR_DIRECTORY_NOT_AVAILABLE`; no debe reutilizarse como bandeja de reasignaciones.

## 2. Garantías actuales del listado

La respuesta que genera hoy el código garantiza por construcción:

```text
items                                   lista no nula
washExecutionId                         UUID no nulo (PK de la fila seleccionada)
washExecutionStatus                     exactamente PENDING_REASSIGNMENT
executionVersion                        BIGINT no nulo en DB; el DTO Java es long
authorizedAt                            nullable
qrUsageContext                          siempre NONE
```

No existe hoy validación `executionVersion > 0` en esta lectura. La tabla lo declara `NOT NULL`, pero
no tiene un `CHECK` positivo.

El resto depende de `LEFT JOIN` y columnas nullable:

- `appointment` puede ser `null`; si existe, su ID, status, studentAccountId y
  appointmentTimeSlotId provienen de columnas no nulas, pero tipo, instrumentos, pieza y curso pueden
  ser `null`;
- `appointmentTimeSlot` se crea cuando existe Appointment, pero serviceDate, horas y timezone pueden
  ser `null` si falta o está incompleta la proyección de slot;
- `courseSectionReference` puede ser `null`; si existe el ID, NRC/nombre todavía pueden ser `null`;
- `student` se crea cuando existe Appointment, pero personId, nombre compuesto, matrícula, semestre y
  academicStatus pueden ser `null` por falta de proyecciones relacionadas;
- `activeResourceAssignment` es `null` sin asignación activa; si existe, tipo/fecha y Cabin/Tank o sus
  nombres/códigos pueden ser `null`;
- `submittedExitMaterials` es `null` cuando los cuatro contadores faltan y puede ser un objeto parcial
  si sólo algunos están presentes.

Por tanto, el runtime actual **no garantiza que todo item HTTP 200 sea presentable o seleccionable**.
El único identificador de selección garantizado es `washExecutionId`; abrir candidatos con él puede
terminar en 503 por estado, snapshot o readiness.

## 3. Expectativa propuesta para conectar el Front

Para que una futura respuesta `200` sea consumible sin decisiones ambiguas, se propone que cada
elemento cumpla:

```text
washExecutionId                         requerido, UUID
washExecutionStatus                     requerido, exactamente PENDING_REASSIGNMENT
executionVersion                        requerido, entero > 0
authorizedAt                            nullable
appointment                             requerido
  appointmentId                         requerido
  appointmentType                       requerido
  instrumentCount                       nullable por contrato
  pieceType                             nullable por contrato
  appointmentStatus                     requerido
  courseSectionReference                nullable por contrato
    courseSectionId                     requerido si existe objeto
    nrc / name                          nullable
  appointmentTimeSlot                   requerido
    appointmentTimeSlotId                requerido
    serviceDate / startsAt / endsAt      requeridos
    timezone                             requerido
student                                 requerido
  accountId / personId                  requeridos
  displayName / enrollment               requeridos
  currentSemester                       requerido
  academicStatus                        nullable
activeResourceAssignment                nullable por significado funcional
submittedExitMaterials                  nullable por significado funcional
qrUsageContext                          requerido, NONE
```

`authorizedAt = null` no impide seleccionar: el orden canónico lo coloca al final y la tarjeta puede
usar el horario de la cita. `activeResourceAssignment = null` representa el caso válido de asignación
inicial ausente. Cuando existe, toda la asignación, Cabin y Tank deben venir completas. Los materiales
de salida no autorizan esta acción y pueden ser `null`; si se conservan en el DTO, un objeto presente
debe contener sus cuatro contadores íntegros y no negativos.

La implementación BFF actual compone `appointment`, `student`, curso, horario, asignación y
materiales desde `LEFT JOIN` sin una validación de integridad equivalente a la usada por el lookup.
Puede producir `appointment = null`, `student = null`, subobjetos parciales o materiales parciales con
HTTP 200. Esto contradice la promesa de una tarjeta utilizable. Antes de conectar el Front, el BFF debe
validar la población completa y devolver el error controlado de proyección para toda la consulta si un
pendiente carece de contexto obligatorio. No se debe ocultar la fila, inventar texto ni convertir la
degradación en una bandeja vacía.

Una vez implementado ese hardening, la regla de selección propuesta queda simple:

```text
todo item recibido en una respuesta 200 endurecida es seleccionable
```

El Front no calcula `selectable` a partir de nulos. Valida el contrato completo en el adapter; una
respuesta inválida se trata como indisponibilidad de datos y no muestra botones de acción.

## 4. Abrir un pendiente y seleccionar candidato

Al seleccionar una tarjeta, el Front conserva al menos:

```text
washExecutionId
appointmentId
```

Después consulta `GET .../{washExecutionId}/candidates`. La fotografía de candidatos es la única
fuente para `executionVersion`, recomendación, pares Cabin/Tank y capacidad que se usan al confirmar.
No se reutiliza la versión del listado si difiere de la fotografía.

Reglas de selección:

- `recommendedCandidate = candidates[0]` cuando la lista no está vacía;
- `recommendedCandidate = null` junto con `candidates = []` significa ausencia demostrada de opciones;
- sólo se puede seleccionar un par exacto presente en `candidates[]`;
- al refrescar candidatos, se descarta la selección si el par dejó de aparecer o cambió la versión;
- una lista vacía habilita la cancelación `CAPACITY_LOSS`, pero no la ejecuta automáticamente;
- un `503` nunca habilita cancelación, porque no demuestra ausencia de alternativas.

La lectura de candidatos puede devolver 503 cuando el flag está apagado, la ejecución ya no está
pendiente, la proyección no está READY, falta snapshot, la versión no coincide o el snapshot expiró.
Todos estos casos se presentan como disponibilidad temporal y provocan refresco de bandeja; no son
“sin candidatos”.

## 5. Confirmación y relectura posterior

Reasignar envía una intención explícita:

```text
POST /wash/executions/{washExecutionId}/reassignment
Idempotency-Key estable
{ cabinId, tankId, expectedVersion: candidates.executionVersion }
```

Cancelar por falta de capacidad envía:

```text
POST /wash/executions/{washExecutionId}/clinic-cancel
Idempotency-Key estable
{ cancellationSubreason: CAPACITY_LOSS, cancellationReason?, expectedVersion }
```

`202` sólo confirma persistencia durable en BFF. El Front consulta
`GET /api/v1/operations/{operationId}` hasta un estado terminal.

Después de `SUCCEEDED`, la ausencia de la fila en la bandeja no basta como confirmación de la vista
final. Cuando esté disponible, el Front debe preferir la cita exacta mediante el lookup
`APPOINTMENT_ID` previsto por el directorio:

```json
{
  "lookupType": "APPOINTMENT_ID",
  "appointmentId": "<appointmentId de la tarjeta>"
}
```

Para reasignación exitosa, esperar convergencia hasta observar la misma cita, ejecución
`IN_PROGRESS`, `executionVersion` mayor a la enviada y `activeResourceAssignment` completa. Para
cancelación exitosa, esperar la misma cita en estado terminal/`nextAction = NONE`. Durante el intervalo
asíncrono se muestra “resultado confirmado, actualizando datos”, no otro botón de envío.

Si la relectura devuelve temporalmente el estado anterior o 503, se reintenta sólo la lectura con
backoff acotado. No se reenvía el Command. Si el lookup exacto devuelve 404 después de éxito, se
refresca la bandeja y se presenta una inconsistencia recuperable; no se fabrica el estado final.

La ruta `APPOINTMENT_ID` todavía no está en la base BFF pública inspeccionada. Mientras se integra, el
lookup vigente `STUDENT_ENROLLMENT` es un fallback válido cuando la matrícula identifica de forma
inequívoca la cita esperada: el BFF falla con 503 si encuentra más de una cita activa. El Front debe
verificar que el `appointmentId` devuelto coincide con el conservado; un resultado distinto no confirma
la operación. Este fallback permite el flujo actual y no elimina la mejora exacta por ID.

## 6. Recuperación tras recarga o pérdida de red

El BFF no ofrece una ruta para enumerar operaciones pendientes de un actor; recuperar una operación
requiere conocer su `operationId`. El Front debe persistir un recibo mínimo por cuenta y ejecución en
almacenamiento durable del navegador:

```text
accountId
kind = REASSIGNMENT | CAPACITY_LOSS_CANCELLATION
washExecutionId
appointmentId
idempotencyKey
request funcional completo
operationId?          // se agrega al recibir 202
createdAt
```

No se guarda el QR ni PII de presentación. La clave queda aislada por `accountId`; logout limpia el
estado visible y nunca permite que otra cuenta continúe la operación anterior.

Al iniciar/reabrir la aplicación:

1. Si existe `operationId`, consultar `/operations/{operationId}` y continuar polling.
2. Si sólo existe la intención con `idempotencyKey` porque la respuesta del POST se perdió, repetir el
   mismo POST una vez con la misma key y body. La idempotencia devuelve la operación ganadora.
3. Si el resultado es `SUCCEEDED`, conservar el recibo hasta completar la relectura exacta descrita
   arriba.
4. Si es `REJECTED`, limpiar la selección, releer bandeja/candidatos y exigir una decisión nueva.
5. Si es `FAILED` o `EXPIRED`, conservar `operationId` y mostrar una conclusión no exitosa; no crear
   otra intención automática.
6. Si polling o relectura fallan por red/503, conservar el recibo para que “Reintentar consulta” reanude
   el mismo flujo.

Una selección guardada antes de enviar no constituye una operación. Tras recarga u offline se vuelve a
consultar candidatos y se exige confirmación explícita; nunca se autoenvía una selección vieja.

## 7. Errores HTTP y resultados asíncronos

### Antes de aceptar la operación

| HTTP                      | Código público vigente                                       | Conducta Front                                                                         |
| ------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| 400                       | `BFF.INVALID_REQUEST`                                        | Corregir forma/datos; no reintentar automáticamente.                                   |
| 401                       | `BFF.AUTHENTICATION_REQUIRED` o `BFF.AUTHENTICATION_INVALID` | Renovar/reautenticar según ciclo global.                                               |
| 403                       | `BFF.ACCESS_DENIED`                                          | Mostrar acceso denegado; no reintentar.                                                |
| 409                       | `BFF.IDEMPOTENCY_CONFLICT`                                   | Bloquear nuevo envío: la misma key se usó con otra intención.                          |
| 503                       | `BFF.PROJECTION_UNAVAILABLE` o dependencia temporal          | Conservar selección/recibo sólo para consulta; refrescar datos antes de confirmar.     |
| red/timeout sin respuesta | sin certeza de aceptación                                    | Conservar misma key y body; permitir reanudar, nunca generar otra key automáticamente. |

El BFF vigente no emite 422 para estas rutas; el Front no debe depender de ese código como validación
funcional.

### Después de `202`

Los rechazos funcionales no son HTTP 4xx retrospectivos. Aparecen en el recurso de operación:

```text
PENDING   → continuar consulta
SUCCEEDED → releer por APPOINTMENT_ID o matrícula inequívoca y luego bandeja
REJECTED  → mostrar errorCode, releer pendiente+candidatos, no auto-resubmit
FAILED    → resultado técnico terminal; conservar referencia y escalar/reintentar sólo mediante acción nueva
EXPIRED   → resultado terminal sin confirmación; conservar referencia y no asumir éxito
```

Errores owner de reasignación que requieren actualización y nueva selección:

```text
INVALID_RESOURCE_COMBINATION
RESOURCE_NOT_AVAILABLE
TANK_CAPACITY_EXHAUSTED
VERSION_CONFLICT
```

`WASH_EXECUTION_NOT_PENDING_REASSIGNMENT` obliga a cerrar el detalle si la bandeja/lookup confirma que
el estado avanzó. `WASH_EXECUTION_NOT_FOUND` y `APPOINTMENT_CONTEXT_UNAVAILABLE` se muestran como
estado no resoluble localmente y requieren releer antes de otra acción. Los códigos desconocidos usan
un mensaje genérico y conservan `operationId`; el Front no deriva reglas owner nuevas.

En cancelación, cualquier `REJECTED` implica refrescar candidatos. Si ahora existe una alternativa, se
cierra la opción de cancelar y se vuelve a selección. La fotografía vacía anterior no autoriza un
segundo envío.

`GET /operations/{operationId}` devuelve 404 cuando la operación no existe o no es visible para la
cuenta actual. Un recibo propio que termina en 404 se conserva como referencia y se presenta para
soporte; no se transforma en éxito, rechazo ni nuevo Command.

## 8. Cambios contractuales concretos

Actualizar `wash-reassignment-client-contract.md`, el caso de uso WASH-SUP-02 y el freeze Front para:

1. documentar por separado las garantías actuales y la propuesta de un `200` completo/seleccionable;
2. exigir 503 para contexto obligatorio incompleto en vez de objetos parciales;
3. separar lista vacía, candidatos vacíos confiables y 503;
4. fijar selección exclusivamente desde el snapshot y descarte al refrescar;
5. preferir lookup exacto `APPOINTMENT_ID` después de éxito y permitir temporalmente matrícula sólo
   cuando devuelve inequívocamente el `appointmentId` esperado;
6. fijar el recibo durable por cuenta y recuperación tras recarga;
7. separar errores HTTP previos a aceptación de `operation.status/errorCode` posteriores;
8. eliminar 422 de matrices Front para estas rutas mientras el BFF no lo exponga;
9. indicar que el Front de reasignación aún no está implementado y no debe inferirse de la tarjeta Home.

## 9. Pruebas que deberá exigir la implementación Front

- adapter acepta los dos nulos funcionales y rechaza `appointment`, `student` o asignación parcial;
- lista vacía muestra empty; 503 muestra indisponibilidad y nunca cancelación;
- toda tarjeta válida abre candidatos con su `washExecutionId`;
- recomendada coincide con el primer candidato y manual sólo permite pares presentes;
- refresh elimina una selección desaparecida y adopta la nueva `executionVersion`;
- POST usa key estable y bloquea doble submit;
- timeout de POST reusa exactamente key/body; 400/403/409 no generan otra operación;
- REJECTED por cada código recuperable refresca lista+candidatos sin auto-resubmit;
- SUCCEEDED prefiere `APPOINTMENT_ID` o usa matrícula inequívoca, espera
  versión/estado/asignación convergentes y después refresca lista;
- recibo sobrevive reload, reanuda polling y queda aislado por cuenta/logout;
- FAILED, EXPIRED y 404 de operación conservan referencia y no se presentan como éxito;
- offline conserva sólo selección efímera antes de submit y nunca la envía al reconectar.

## 10. Archivos Front esperados

Sin fijar nombres inexistentes como contrato, el cambio debe incluir:

- modelos de lista, candidatos, requests y estado durable;
- extensiones del gateway/use case y adapter HTTP con validación runtime;
- workflow de reasignación separado del flujo de llegada/decisión;
- páginas de bandeja y detalle, más navegación desde Home;
- storage de recibos por cuenta y cleanup en el ciclo de sesión;
- mensajes por código owner y estados de loading/empty/unavailable/offline;
- specs de adapter, workflow, recovery tras reload, componentes y rutas.

No se realizaron cambios en BFF/Front, no se ejecutó Maven y no se tocó runtime.
