> Archivo de trazabilidad: refleja el estado de su fecha original, no el estado vigente. Consultar el [índice actual](../../README.md).

# Contrato de frontend: Reasignaciones pendientes

Verificación: 6 de septiembre de 2026. Alcance exclusivo de Lavado. Este documento describe el comportamiento implementado; la disponibilidad del entorno y la evidencia E2E se distinguen al final. Todas las rutas incluyen `/api/v1`.

## 1. Cuándo se permite reasignar

El supervisor debe estar autenticado, tener `SUPERVISOR_LAVADO`, acceso activo a Lavado y contexto de autorización disponible. El permiso actual es global a Lavado; no existe un filtro de autorización por clínica/sede implementado.

La ejecución debe seguir en `PENDING_REASSIGNMENT`, con `expectedVersion` igual a su versión actual. La cita debe estar `SCHEDULED` o `IN_PROGRESS`, su horario debe estar activo y las proyecciones de Appointments y configuración de recursos disponibles.

Se cubren ambos orígenes: autorización inicial sin espacio y pérdida/cambio de recurso después de iniciar el lavado. No se permite reasignar directamente una ejecución que continúa en `IN_PROGRESS`: primero debe existir la transición legítima a pendiente. No debe fabricarla el frontend.

Puede existir una asignación activa anterior: backend la libera y crea la nueva, iniciando limpieza cuando corresponde. Si no hay asignación activa, crea una `INITIAL`; si la hay, crea una `REASSIGNMENT`. No inferir el tipo sólo a partir de si el lavado había iniciado. La tarjeta nunca debe inventar cabina o tina cuando la asignación sea nula.

El comando actual no impone una ventana de minutos ni exige `now < endsAt` para reasignar. Sí revalida estado del horario, compatibilidad, capacidad, cierres, limpieza e indisponibilidad al ejecutar. No reutilizar la ventana de llegada como límite de reasignación ni prometer un plazo adicional que backend no aplica.

## 2. Consultas y selección

- Listado: `GET /api/v1/wash/supervision/pending-reassignments`.
- Candidatos: `GET /api/v1/wash/supervision/pending-reassignments/{washExecutionId}/candidates`.
- Confirmación: `POST /api/v1/wash/executions/{washExecutionId}/reassignment`.
- Cancelación clínica: `POST /api/v1/wash/executions/{washExecutionId}/clinic-cancel`.
- Estado de operación: usar el `pollPath` del `202`.

El listado devuelve `{ "items": [...] }`; no tiene paginación ni un total independiente. Ordena por `authorizedAt` ascendente (nulos al final) y luego `washExecutionId` ascendente; filtra estado pendiente sin limitar explícitamente al día actual. Los eventos actuales no garantizan poblar `authorizedAt`: puede quedar nulo y no debe utilizarse como hora de autorización confirmada. La consulta de candidatos es una lectura local sin reservas ni comandos síncronos. Al seleccionar una ejecución, refrescar candidatos y comprobar su `executionVersion`; nunca enviar la versión de una tarjeta antigua si la lectura nueva difiere.

El listado actual usa LEFT JOIN y puede devolver filas parciales con HTTP 200. No garantiza que todas sean seleccionables. Los campos base provienen de la ejecución pendiente (`washExecutionId`, `washExecutionStatus`, `executionVersion`), pero alumno, cita y recursos dependen de otras proyecciones. `authorizedAt`, `activeResourceAssignment` y materiales enviados pueden ser nulos legítimamente; no se ha implementado todavía un indicador público `selectable` ni un rechazo global por toda fila incompleta. Si una fila recibida carece de identidad de ejecución, versión válida o contexto necesario para identificar al alumno y la cita, tratarla como incompleta: no habilitar comandos ni rellenar datos supuestos. Reconsultar y reportar inconsistencia. Esto es una defensa del cliente, no una garantía de que el backend admite deliberadamente filas incompletas.

## 3. Candidatos: parejas indivisibles

Cada elemento contiene `cabinId`, `cabinCode`, `cabinName`, `tankId`, `tankCode`, `tankName`, `availableCapacity`. Es una pareja válida de cabina y tina para esa ejecución y horario en el instante `snapshotGeneratedAt`. Front debe seleccionar ambos IDs del mismo elemento; no combinar candidatos.

`availableCapacity` representa plazas restantes de la tina para el horario, calculadas por el owner a partir de capacidad configurada menos asignaciones activas. No representa un número de instrumentos ni una reserva para el alumno. Siempre es positivo en un candidato válido.

El orden lo define el owner. En la implementación actual `recommendedCandidate` es el primer candidato y es `null` cuando la lista está vacía. La recomendación orienta la selección; no confirma ni reserva recursos. El POST revalida la pareja bajo bloqueo y puede rechazarla si otro proceso consumió su capacidad.

El snapshot interno dura 10 segundos. El BFF sólo devuelve uno vigente y con la misma versión que su proyección de ejecución; `freshUntil` no forma parte del DTO HTTP. No calcular que una elección sigue reservada durante esos 10 segundos. El refresco de background por defecto es cada 5 segundos cuando está habilitado. Recomendación de UI, no SLA: actualizar cada 5 segundos mientras la pantalla sea visible, con backoff ante fallos y respetando `Retry-After`.

## 4. Sin opciones y cancelación

`200` con `candidates: []` y `recommendedCandidate: null` confirma que el owner evaluó un contexto disponible y no encontró parejas elegibles al generar el snapshot. Mostrar espera/sin recursos y permitir actualizar.

`503 BFF.PROJECTION_UNAVAILABLE` significa que no hay una respuesta confiable: flag apagado, proyección ausente, ejecución que ya no está pendiente, snapshot ausente/vencido/futuro o versión distinta. No mostrar “no hay recursos” ni habilitar cancelación por falta de capacidad basándose en ese error. Refrescar listado/lookup para distinguir una ejecución resuelta de indisponibilidad temporal.

Un supervisor autorizado puede solicitar cancelación clínica de una ejecución pendiente. Para falta de recursos usar `cancellationSubreason: "CAPACITY_LOSS"`, motivo explicativo y la versión actual. Backend vuelve a comprobar ausencia de alternativas al ejecutar; si ya existe una devuelve `CAPACITY_ALTERNATIVE_AVAILABLE`. La lista vacía no autoriza una cancelación automática ni evita esta comprobación.

## 5. Confirmación y desaparición del listado

El POST de reasignación usa bearer e `Idempotency-Key`, con este cuerpo:

```json
{
  "cabinId": "cccccccc-cccc-cccc-cccc-cccccccccccc",
  "tankId": "dddddddd-dddd-dddd-dddd-dddddddddddd",
  "expectedVersion": 3
}
```

`202` sólo significa recepción durable. Esperar la operación hasta `SUCCEEDED`; el resultado de reasignación contiene `data.status: "IN_PROGRESS"` y `data.tankId`. No promete devolver cabina, todos los detalles de asignación ni una versión nueva en `data`.

Después refrescar el listado y el lookup de supervisión ya contratado para obtener ejecución/versionado y asignación actualizados. La ejecución desaparece del listado cuando la proyección BFF deja `PENDING_REASSIGNMENT`, no necesariamente en el mismo instante que el Result. El lookup por matrícula debe identificar inequívocamente la cita; el lookup público por `appointmentId` sigue pendiente del directorio. Si no puede identificarse inequívocamente, no confirmar una asignación perteneciente a otra cita.

Una vez convergido se espera ejecución `IN_PROGRESS` y asignación activa con cabina/tina del backend. Home del supervisor permite refrescar el contador de pendientes. La cita del ingreso inicial converge a `IN_PROGRESS` mediante su propio evento; las versiones de Appointments y Wash Execution pertenecen a agregados distintos y no deben compararse entre sí.

## 6. Errores, reintentos y recarga

Los códigos de rechazo del owner se consultan en `OperationResponse.errorCode` en raíz después del `202`; no son rechazos HTTP tardíos del POST.

| Código del owner                                                         | Acción del cliente                                                                                                                                                    |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VERSION_CONFLICT`                                                       | Refrescar ejecución y candidatos. Confirmar de nuevo cualquier intención distinta con nueva clave; no sustituir silenciosamente la versión de la intención pendiente. |
| `WASH_EXECUTION_NOT_PENDING_REASSIGNMENT`                                | Refrescar listado/lookup; otro proceso pudo resolverla. No repetir la selección.                                                                                      |
| `TANK_CAPACITY_EXHAUSTED` / `RESOURCE_NOT_AVAILABLE`                     | La pareja dejó de estar disponible; refrescar candidatos y permitir una nueva elección explícita.                                                                     |
| `INVALID_RESOURCE_COMBINATION`                                           | Refrescar candidatos; enviar una pareja completa del owner. Si persiste, reportar contrato inconsistente.                                                             |
| `APPOINTMENT_CONTEXT_UNAVAILABLE` / `RESOURCE_CONFIGURATION_UNAVAILABLE` | Esperar contexto disponible; no convertirlo en lista vacía.                                                                                                           |
| `CAPACITY_ALTERNATIVE_AVAILABLE`                                         | Cancelación por capacidad rechazada; actualizar candidatos y ofrecer reasignación.                                                                                    |
| `ACTOR_NOT_AUTHORIZED`                                                   | Revisar sesión/permisos; no reintentar automáticamente el comando.                                                                                                    |

En HTTP, sesión/permisos, validación y conflictos de idempotencia se resuelven antes de aceptar el comando. Consultar el contrato de integración general para códigos exactos; los errores de proyección usan `503`; el handler genérico actual no añade `Retry-After` para candidatos. Respetarlo si una capa intermedia lo incluye, sin asumir su presencia. No inferir una operación creada si el POST fue rechazado sin `operationId`.

Para recuperar tras recargar, el frontend debe conservar por cuenta la intención pendiente: `operationId`, `pollPath`, `Idempotency-Key`, ruta, cuerpo exacto y ejecución. Guardar únicamente lo necesario, sin bearer ni QR; descartar/aislar al cambiar de cuenta. Consultar primero el `pollPath` autenticado. El backend no ofrece un endpoint público para listar automáticamente todas las operaciones perdidas del cliente.

Si se perdió el `202` pero se conserva clave y cuerpo exactos, reenviar la misma intención permite la deduplicación existente; no generar otra clave. Si se perdieron también esas referencias, una lectura del estado ayuda a reconciliar, pero no demuestra por sí sola que no exista un comando aún en tránsito.

`FAILED`, `EXPIRED`, desconexión o timeout de UI no prueban que el owner no produjo efectos. Conservar la referencia, refrescar operación y estado; no habilitar un comando nuevo sólo porque venció la espera. La recuperación inequívoca de terminales técnicos permanece como limitación conocida: no hay contrato de reintento ciego seguro ni de recuperación de operaciones sin identificador.

## 7. Ejemplos y fixtures

Los ejemplos acompañantes son sintéticos contrastados con DTO/código, no respuestas reales anonimizadas ni citas vigentes. La fixture existente está en `platform-bff/e2e/fixtures/reassignment-candidates`, runner `platform-bff/e2e/runner/run-reassignment-candidates.mjs`.

Ese runner prepara una ejecución pendiente sintética, verifica candidatos reales por Query/Result y cambia exclusivamente la tina propia para comprobar `200` vacío. Limpia sus datos al terminar. No certifica creación real del pendiente, POST de reasignación, cancelación clínica ni conflictos de selección. Falta extender la fixture y capturar esos recorridos completos; no entregar sus IDs históricos como cuentas/citas vigentes.

## 8. Estado operativo verificado

Verificado por lectura del clúster el 6 de septiembre de 2026:

| Entorno                | Estado observado                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `develop`              | BFF `develop-76b44bd`, Wash Execution `develop-c6eb2c2`, una réplica lista de cada uno. La variable `BFF_WASH_REASSIGNMENT_CANDIDATES_ENABLED` no está presente en el proceso BFF; el valor por defecto del código es `false`. No se certifica candidatos habilitado.                                                                                                                |
| `wash-e2e`             | Variable de candidatos explícitamente `false` en BFF. Imágenes fijadas a digests anteriores; no es un entorno habilitado para pruebas manuales actuales.                                                                                                                                                                                                                             |
| Bridge de reasignación | [PR153](https://github.com/AnthonyNav/estoma-services/pull/153), commit `4afc6984a0ed02c3aa879ff7adf1e7061af1a8f9`, integrado en `develop` mediante squash `c6eb2c26752c03da1adcbf302564d4a2e4e113a7`. Despliegue verificado: `develop-c6eb2c2`, una réplica deseada, actualizada, lista y disponible. Acepta aliases canónicos y legacy; no cambia el payload HTTP mostrado arriba. |

El bridge ya está desplegado, pero todavía no se entrega un entorno con candidatos habilitado. El ensayo histórico de candidatos no sustituye esta activación. La corrección de concurrencia para cancelación por capacidad de PR146 sí forma parte de `develop-7c508c2`; distinguirla del bridge de PR153.

Fuentes: `PendingReassignmentsResponse`, `WashSupervisionQueryService`, `ReassignmentCandidatesService`, `ReassignmentCandidatesResponse`, `WashController`, `ResourceAllocator`, `WashExecutionCommandService`, `OperationResponse` y documentación `wash-execution-service/docs/reassignment_candidates_query.md`.

Ejemplos: [respuestas sintéticas completas](../../contracts/examples/ejemplos-reasignaciones.json). Auditoría de campos actuales: [reglas del listado](reglas-listado-reasignacion.md).

Corrección en revisión: [PR156](https://github.com/AnthonyNav/estoma-services/pull/156) valida el contexto obligatorio de todas las filas y devuelve 503 si falta, conservando nulos funcionales. Tiene 199 unitarias +79 IT aprobadas; todavía no está desplegado. No aplicar sus garantías como si ya fueran las del OpenAPI 76b44bd.
