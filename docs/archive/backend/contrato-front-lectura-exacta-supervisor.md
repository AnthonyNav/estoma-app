> Archivo de trazabilidad: refleja el estado de su fecha original, no el estado vigente. Consultar el [índice actual](../../README.md).

# Consulta exacta de una atención del supervisor

**Integrada en [PR159](https://github.com/AnthonyNav/estoma-services/pull/159) y desplegada en BFF `237f5c07`.** Réplica disponible observada y OpenAPI descargado comparado como JSON con el commit. La versión actual compatible es BFF `9c6f418`; la referencia vigente es [bff-9c6f418.openapi.json](../../contracts/bff-9c6f418.openapi.json); la copia candidata se conserva sólo como histórico. Falta certificar el recorrido autenticado completo con datos sintéticos vigentes.

```http
GET /api/v1/wash/supervision/executions/{washExecutionId}
Authorization: Bearer <access-token>
```

Exige sesión válida, rol `SUPERVISOR_LAVADO` y acceso activo a `LAVADO_ULTRASONICO`. Conserva la autorización vigente de Lavado; no define el alcance del futuro directorio por clínica/sede. La consulta es sólo lectura y no registra llegada, aprueba ni asigna recursos.

## Cómo confirmar el cierre

1. Conservar el `washExecutionId` de la atención seleccionada, la versión y el recibo de la operación de `/complete`.
2. Esperar que la operación termine en `SUCCEEDED`.
3. Consultar este mismo ID hasta observar `washExecution.status=COMPLETED`, una versión posterior a la enviada y los materiales finales esperados. Nunca sustituirlo por otra cita recuperada por matrícula.
4. Confirmar `activeResourceAssignment=null`, `lastResourceAssignment` presente, `completedAt` y `finalExitMaterials`. Los materiales originales permanecen separados en `submittedExitMaterials` cuando están proyectados; el contrato conserva su nulabilidad histórica.

La consulta funciona para días anteriores y devuelve únicamente el ID solicitado. `serviceDate` informa la fecha de esa cita; no selecciona la cita de hoy ni una ejecución más reciente. Las versiones de cita y ejecución son independientes: no deben compararse entre sí.

## Respuesta

El `200` siempre incluye `serviceDate`, `student`, `appointment` y `washExecution`:

- Alumno: `studentAccountId`, `displayName`, `studentEnrollment`, `currentSemester`.
- Cita: `appointmentId`, `appointmentVersion`, `appointmentStatus`, `appointmentType`, `appointmentTimeSlot` con ID, inicio, fin y zona. `instrumentCount`, `pieceType` y `courseSectionReference` admiten null; en un curso presente, `nrc` y `name` también pueden faltar.
- Ejecución: `washExecutionId`, `status`, `version`, `executionVersion`, `arrivedAt`; `version` es alias de `executionVersion` y siempre coincide. También incluye `rejectionReason`, `exitSubmittedAt`, `submittedExitMaterials`, `completedAt`, `finalExitMaterials`, `activeResourceAssignment` y `lastResourceAssignment`, con null según el estado.

Los materiales presentes incluyen los cuatro contadores enteros no negativos y al menos uno positivo. No mezclar valores enviados con finales. Cada asignación presente incluye su ID, tipo, cabina y tina completos; no combinar recursos de asignaciones diferentes.

| Estado                 | Contexto requerido                                                                                                                                                                                                                                                                                                         |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PENDING_ENTRY`        | Cita `SCHEDULED`, sin asignación.                                                                                                                                                                                                                                                                                          |
| `ENTRY_REJECTED`       | Cita `ENTRY_REJECTED`, motivo no vacío, sin asignación.                                                                                                                                                                                                                                                                    |
| `PENDING_REASSIGNMENT` | Cita `SCHEDULED` o `IN_PROGRESS`; puede faltar asignación por capacidad inicial o conservar la anterior tras pérdida de recursos.                                                                                                                                                                                          |
| `IN_PROGRESS`          | Cita `IN_PROGRESS`, asignación activa.                                                                                                                                                                                                                                                                                     |
| `EXIT_SUBMITTED`       | Cita `IN_PROGRESS`, asignación activa, fecha y materiales enviados.                                                                                                                                                                                                                                                        |
| `COMPLETED`            | Cita `COMPLETED`, fecha/materiales finales, sin asignación activa y con última asignación.                                                                                                                                                                                                                                 |
| `CANCELLED`            | Cita `CANCELLED`, sin asignación activa. La corrección de liberaciones por cancelación está integrada en [PR161](https://github.com/AnthonyNav/estoma-services/pull/161) (`9c6f4189`), ya desplegada con réplica disponible. No repara históricos automáticamente: si todavía aparece activa, esta lectura responde `503`. |

No devuelve `nextAction` ni concede permisos para ejecutar comandos. Para revisar y completar se mantienen los guards y lecturas del flujo contratado.

## Errores y actualización

| HTTP  | Código                         | Acción                                                                                                            |
| ----- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `400` | `BFF.INVALID_REQUEST`          | Corregir el UUID enviado.                                                                                         |
| `401` | `BFF.AUTHENTICATION_REQUIRED`  | Recuperar sesión conservando el recibo de la operación, sin reenviar comandos automáticamente.                    |
| `403` | `BFF.ACCESS_DENIED`            | Detener acceso al detalle.                                                                                        |
| `404` | `BFF.WASH_EXECUTION_NOT_FOUND` | El ID no existe en la proyección disponible; no buscar otra cita como sustituto ni concluir que un comando falló. |
| `503` | `BFF.PROJECTION_UNAVAILABLE`   | Todavía no puede componerse una lectura confiable; actualizar con espera acotada y reportar si persiste.          |

READY no garantiza que todos los eventos ya convergieron. Tras `SUCCEEDED` puede haber un estado anterior o un `503` temporal. No hay garantía nueva de `Retry-After`; respetarlo si aparece y usar espera creciente/acotada según la política de operaciones existente. No repetir `/complete` con una clave nueva para acelerar una lectura.

## Verificación y pendientes

PostgreSQL cubre ejecución cerrada de otro día aunque el alumno tenga otra cita actual, joins incompletos y materiales originales/finales. HTTP cubre 200/400/401/403/404/503. Merge y despliegue están confirmados. Falta la prueba conjunta con cuentas/cita sintéticas vigentes. El listado manual y la activación del QR siguen siendo entregas separadas.
