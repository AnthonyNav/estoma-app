# Registro y revisión de salida

Fuente: [confirmación backend](../archive/backend/contrato-front-salida-lavado.md). Aplican las [reglas comunes](common.md) y la [lectura exacta](execution-read.md). Contrato desplegado exige EXIT_SUBMITTED. El [cierre directo](../pending/direct-supervisor-exit.md) está aprobado como producto, pero aún en implementación backend.

## Flujo y permisos

1. El alumno consulta `GET /api/v1/wash/student/home`. Sólo una ejecución propia en `IN_PROGRESS` puede enviar su formulario de salida.
2. El alumno envía materiales y la versión de Wash Execution mediante `POST /api/v1/wash/executions/{washExecutionId}/exit`.
3. Espera la operación y vuelve a consultar Home. `EXIT_SUBMITTED` significa “formulario enviado, pendiente de revisión”; todavía no es salida autorizada y mantiene la asignación activa.
4. El supervisor autenticado con `SUPERVISOR_LAVADO` y acceso activo a Lavado realiza `POST /api/v1/wash/supervision/lookup`. La lectura recupera materiales enviados, ejecución y versión actual. No registrar nuevamente llegada.
5. Con ejecución `EXIT_SUBMITTED`, el supervisor revisa los valores, puede modificarlos y envía todos los materiales finales mediante `POST /api/v1/wash/executions/{washExecutionId}/complete`.
6. Espera `SUCCEEDED` y la convergencia de lecturas antes de mostrar la salida finalizada. Backend lleva la ejecución a `COMPLETED`, libera recursos e inicia limpieza cuando corresponde; la cita converge a `COMPLETED` mediante su propio evento.

El BFF y el owner comprueban que quien envía el formulario es el alumno dueño de esa ejecución. Para completar, backend exige supervisor autorizado. Identidades y horas se derivan del servidor, no se reciben del formulario.

## Formulario del alumno

Se envían cuatro cantidades enteras:

| Campo                       | Significado                      |
| --------------------------- | -------------------------------- |
| `packageCount`              | Paquetes.                        |
| `greenPaperCassette8Count`  | Papel verde para cassette de 8.  |
| `greenPaperCassette10Count` | Papel verde para cassette de 10. |
| `witnessTapePortionCount`   | Porciones de cinta testigo.      |

Cada valor debe ser mayor o igual a cero y al menos uno debe ser positivo. Enviar las cuatro claves explícitamente, incluyendo ceros; no enviar decimales, negativos ni cadenas. El contrato usa enteros de 32 bits; no hay un máximo de negocio menor definido. No aplicar reglas de materiales según tipo de cita que backend no haya establecido.

Bearer e `Idempotency-Key` son necesarios. `expectedVersion` es `appointment.washExecution.executionVersion` de Home (equivale al campo `version` de esa misma ejecución), nunca `appointmentVersion`.

```json
{
  "materials": {
    "packageCount": 2,
    "greenPaperCassette8Count": 1,
    "greenPaperCassette10Count": 0,
    "witnessTapePortionCount": 2
  },
  "expectedVersion": 2
}
```

El formulario completo en cero produce `400 BFF.INVALID_REQUEST` antes de aceptar el comando. El owner vuelve a validar cantidades, propiedad, versión, estado y consistencia de fechas. La hora de envío no puede ser anterior al inicio del lavado. No existe un mínimo de minutos de lavado ni una ventana de salida adicional implementada en este comando.

Tras enviar, conservar el borrador asociado a la intención y bloquear envíos nuevos mientras el resultado esté pendiente o ambiguo. Un `202` no permite mostrar autorización. Cuando converge `EXIT_SUBMITTED`, mostrar los valores enviados y espera de revisión. No hay un endpoint implementado para que el alumno sustituya el envío mientras permanece en `EXIT_SUBMITTED`.

## Revisión y corrección del supervisor

Lookup es lectura y no necesita `Idempotency-Key`. Por ahora puede usarse matrícula exacta; QR real depende de activar la emisión y lectura. La futura selección por `appointmentId` pertenece al directorio manual y no está disponible en el OpenAPI desplegado.

En lookup, los datos relevantes son:

- `washExecution.washExecutionId`, `washExecution.status`, `washExecution.executionVersion`;
- `washExecution.exitSubmittedAt` y `washExecution.submittedExitMaterials`;
- `activeResourceAssignment`, con cabina y tina actuales.

`nextAction=EXIT_REVIEW` también puede aparecer mientras la ejecución todavía está `IN_PROGRESS`. Por sí solo no habilita completar: exigir `washExecution.status=EXIT_SUBMITTED` y materiales enviados presentes. Si no se han enviado, indicar que falta el formulario del alumno. Si falta contexto obligatorio para un estado que debería tenerlo, backend devuelve `503 BFF.PROJECTION_UNAVAILABLE`; no precargar ceros para ocultarlo.

Precargar la edición desde `submittedExitMaterials`. El supervisor puede conservar, aumentar o disminuir cada cantidad, respetando las mismas validaciones. Enviar el objeto completo, no un PATCH ni diferencias:

```json
{
  "finalMaterials": {
    "packageCount": 2,
    "greenPaperCassette8Count": 1,
    "greenPaperCassette10Count": 1,
    "witnessTapePortionCount": 2
  },
  "expectedVersion": 3
}
```

Este POST **autoriza y completa** la salida al aplicarse. No existe otro booleano de aprobación ni un endpoint adicional para autorizar después. No envía las verificaciones de identidad/requisitos usadas en ingreso. La edición puede mantenerse como borrador local hasta confirmar; no hay guardado parcial de revisión en backend.

No hay endpoint de “rechazar salida”, devolver el formulario al alumno, reabrir un lavado completado o modificar materiales después de `COMPLETED`. Si se requiere ese flujo deberá acordarse aparte; no representarlo con el rechazo de ingreso ni con cancelación clínica.

## Operación, versiones y resultado final

Cada intención usa su propia `Idempotency-Key`. Reintentar la misma intención conserva clave, ruta y cuerpo, incluida la versión. El POST devuelve `operationId`, `status`, `pollPath` y `submittedAt`.

- Envío aplicado: operación `SUCCEEDED`, `data.status=EXIT_SUBMITTED`.
- Cierre aplicado: operación `SUCCEEDED`, `data.status=COMPLETED`.

No inferir la versión nueva a partir del Result: volver a leer. Aunque cada transición incrementa la versión de ejecución, puede haber otros cambios concurrentes. Las versiones de ejecución y cita son independientes.

Home del alumno expone al converger:

| Estado de ejecución | Datos esperados                                                                                                                                            |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `IN_PROGRESS`       | Asignación activa. Aún no hay envío de salida.                                                                                                             |
| `EXIT_SUBMITTED`    | `exitSubmittedAt`, `submittedExitMaterials`, asignación activa; pendiente supervisor.                                                                      |
| `COMPLETED`         | `completedAt`, `finalExitMaterials`, materiales enviados conservados, `activeResourceAssignment=null`, `lastResourceAssignment` con la última cabina/tina. |

Backend conserva los materiales originales en la proyección de lectura y los finales por separado; no usar el objeto final para reescribir lo enviado por el alumno en UI. La ejecución cerrada tiene `qrUsageContext=NONE`; no ofrecer otra revisión por el mismo QR.

El lookup de supervisor selecciona citas activas y tiene reglas de fallback por matrícula; no es un endpoint histórico exacto de ejecuciones completadas. Después del cierre puede dejar de devolver la cita o cambiar su acción. No exigir que devuelva siempre el DTO completo de `COMPLETED`, ni aceptar una cita diferente como confirmación del cierre. La operación confirma el comando; Home del alumno confirma su estado final. Para reconciliar esa misma ejecución, usar la lectura exacta por ID ya desplegada y documentada al final.

## Errores y recuperación

Separar rechazo HTTP del POST de rechazo del owner después de `202`:

| Situación                                                          | Respuesta / acción                                                                                                                                                                     |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cuerpo inválido, cantidades negativas/vacías o versión no positiva | `400 BFF.INVALID_REQUEST`; corregir antes de enviar.                                                                                                                                   |
| Sin sesión / sesión inválida                                       | `401 BFF.AUTHENTICATION_REQUIRED` o `BFF.AUTHENTICATION_INVALID`; recuperar sesión sin duplicar intención pendiente.                                                                   |
| Sin permisos o ejecución ajena                                     | `403 BFF.ACCESS_DENIED`; no reintentar automáticamente.                                                                                                                                |
| Misma clave con otra intención                                     | `409 BFF.IDEMPOTENCY_CONFLICT`; conservar la intención original y reconciliar.                                                                                                         |
| Proyección incompleta                                              | `503 BFF.PROJECTION_UNAVAILABLE`; esperar y refrescar. El handler genérico no garantiza `Retry-After`.                                                                                 |
| `VERSION_CONFLICT` en operación                                    | Refrescar ejecución y formulario; otra acción avanzó su estado. No sobrescribir la versión y reenviar sin confirmar una intención nueva.                                               |
| `INVALID_WASH_EXECUTION_STATUS` en operación                       | La ejecución ya no admite esa transición; reconsultar estado.                                                                                                                          |
| Materiales vacíos/negativos                                        | HTTP público: `400 BFF.INVALID_REQUEST`. `EMPTY_EXIT` / `INVALID_EXIT_VALUES` son validaciones internas durante el mapping; no prometerlas como `errorCode` de una operación aceptada. |
| `INVALID_EXIT` / `INVALID_COMPLETION`                              | Contexto o fechas incompatibles con la transición; no fabricar otra hora desde frontend.                                                                                               |
| `APPOINTMENT_CONTEXT_UNAVAILABLE`                                  | Falta contexto owner para validar el envío; esperar recuperación.                                                                                                                      |
| `ACTIVE_RESOURCE_ASSIGNMENT_NOT_FOUND`                             | El cierre no tiene asignación activa requerida; refrescar y reportar si persiste.                                                                                                      |

Los rechazos funcionales del owner están en `OperationResponse.errorCode` en raíz y la operación queda `REJECTED`; una entrada wire inválida anterior al caso de uso sigue otra ruta y no garantiza Result funcional. Una espera agotada, `FAILED` o `EXPIRED` no demuestra ausencia de efectos: conservar identificador y reconsultar operación/estado antes de permitir otro comando.

Para soportar recarga, persistir por cuenta el recibo mínimo y la intención exacta pendiente (operación, pollPath, clave, ejecución, cuerpo/versión). No guardar bearer ni QR con el recibo. No existe recuperación automática de todas las operaciones del usuario si se pierden las referencias. Recomendación de polling, no SLA: 1 segundo inicialmente, luego 2–5 segundos con backoff; respetar `Retry-After` cuando exista y suspender consultas de pantallas ocultas.

## Pruebas

student-exit.service.spec.ts, supervisor-exit.service.spec.ts y adapters HTTP. Captura/corrección, cierre y recarga probados con mocks; prueba autenticada conjunta pendiente.
