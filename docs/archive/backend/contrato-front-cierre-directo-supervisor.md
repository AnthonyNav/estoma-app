> Archivo de trazabilidad: refleja el estado de su fecha original, no el estado vigente. Consultar el [índice actual](../../README.md).

# Cierre por supervisor sin envío previo del alumno

Decisión de producto confirmada por el usuario el 7 de septiembre de 2026 UTC. **Ampliación en implementación, no disponible ni certificada en el despliegue actual `9c6f418`.** Hasta desplegar y habilitar los cambios, el owner mantiene la exigencia de `EXIT_SUBMITTED`.

## 1. Transición y solicitud

Conservaremos `POST /api/v1/wash/executions/{washExecutionId}/complete`, sesión `SUPERVISOR_LAVADO`, `finalMaterials`, `expectedVersion` e `Idempotency-Key`.

- Nueva rama: `IN_PROGRESS → COMPLETED`, con asignación activa, cierre capturado por el supervisor y sin evento/formulario de envío del alumno.
- Rama existente: `EXIT_SUBMITTED → COMPLETED`, con revisión/corrección y originales conservados en su evento y proyección.
- `PENDING_ENTRY`, `PENDING_REASSIGNMENT` y estados terminales no habilitan cierre. El owner valida actor, estado, versión y asignación antes de mutar.

```json
{
  "finalMaterials": {
    "packageCount": 2,
    "greenPaperCassette8Count": 1,
    "greenPaperCassette10Count": 0,
    "witnessTapePortionCount": 2
  },
  "expectedVersion": 2
}
```

Los cuatro valores deben enviarse completos como enteros JSON no negativos, con al menos uno positivo. El límite de representación actual es entero de 32 bits (máximo 2147483647 por campo); no hay un máximo funcional menor confirmado. No inventar límites nuevos ni completar campos ausentes silenciosamente. El endurecimiento de validación HTTP para exigir los cuatro valores explícitos queda incluido en el trabajo BFF pendiente.

## 2. Materiales y auditoría

Sin envío del alumno, `exitSubmittedAt` y `submittedExitMaterials` deben permanecer null al converger la lectura. No fabricar `WashExitSubmitted`, fecha, autor ni materiales del alumno.

El owner registra al supervisor en `completed_by_account_id` y el instante real en `completed_at`, además del actor del Command y `completedByAccountId/completedAt` del evento de cierre. Los materiales finales proceden del supervisor en ambos caminos; la presencia o ausencia real de la tupla `exit_submitted_by_account_id/exit_submitted_at` distingue si hubo declaración del alumno.

Si sí hubo envío, sus originales se conservan en `WashExitSubmitted` y `submittedExitMaterials` del BFF; los finales en `finalExitMaterials`. Las columnas de materiales vigentes del owner se sustituyen por los finales al completar, como en el comportamiento actual. No confundir esa persistencia con la proyección de originales.

Los DTO públicos actuales exponen `completedAt`, `finalExitMaterials`, `exitSubmittedAt` y `submittedExitMaterials`; no exponen el identificador del supervisor que cerró ni un enum de origen. La auditoría de identidad está en owner/evento. No inferir autoría a partir de una ausencia temporal de proyección ni mostrar un autor inventado. Si la interfaz necesita mostrar quién cerró una atención histórica, requerirá exponer ese dato en una ampliación específica.

## 3. Concurrencia y recuperación

Alumno y supervisor compiten por la misma versión de ejecución. Una solicitud válida con versión positiva obsoleta se acepta como operación HTTP `202` y termina `REJECTED` con `errorCode=VERSION_CONFLICT`; no debe cerrar ni liberar parcialmente.

Si gana el envío del alumno, releer la misma ejecución: aparecerá `EXIT_SUBMITTED` con los materiales originales. El supervisor debe revisarlos y confirmar de nuevo; no reenviar automáticamente con la versión nueva. Si gana el cierre directo, el envío posterior no debe reabrir ni modificar la atención.

Cada intención conserva su clave y cuerpo para reintentos. Una nueva confirmación tras conflicto usa la versión leída y una nueva clave deliberada. Guardar recibo de operación por cuenta para recarga. `FAILED`, `EXPIRED` o timeout requieren reconciliación con operación y lectura exacta, no otro cierre a ciegas.

## 4. Lecturas y capacidad de cierre

Se añadirá `canComplete` a las lecturas del supervisor por lookup y por ejecución exacta. **El campo todavía no existe en el contrato desplegado.** Se calculará tras validar el contexto:

- `EXIT_SUBMITTED` con asignación activa: true para el camino existente.
- `IN_PROGRESS` con asignación activa: true sólo con la nueva capacidad habilitada.
- Resto: false.

Es una indicación basada en la lectura actual; no sustituye las comprobaciones owner ni `expectedVersion`. `nextAction=EXIT_REVIEW` seguirá identificando el contexto de revisión, pero no debe usarse solo para habilitar cierre directo.

Después de `SUCCEEDED`, consultar `GET /api/v1/wash/supervision/executions/{washExecutionId}` hasta observar la misma ejecución `COMPLETED`, versión posterior, `completedAt`, materiales finales exactos, `activeResourceAssignment=null` y `lastResourceAssignment`. Appointments debe converger a cita `COMPLETED`. Si Home aún selecciona esa misma cita, debe reflejar los mismos datos; no usar otra cita de Home como prueba del cierre.

El cierre conserva la liberación de cabina/tina del owner y el tratamiento de limpieza por tipo de cita. No omitir periodos de limpieza que correspondan: liberación de asignación no implica disponibilidad inmediata de un recurso sujeto a limpieza.

## 5. QR y búsqueda manual

Ocultar el QR del alumno durante `IN_PROGRESS` es una decisión de interfaz y no revoca por sí sola una copia. La implementación de lookup QR admite citas activas `IN_PROGRESS` y ejecuciones `IN_PROGRESS/EXIT_SUBMITTED`, siempre que la representación siga vigente, coincida la fecha de servicio y las proyecciones estén listas. La activación y la prueba con QR real siguen pendientes; no se entrega aquí un QR vigente certificado. `COMPLETED` deja de ser atención activa para ese lookup.

El directorio por nombre/matrícula y selección inicial exacta por `appointmentId` **todavía no están implementados**. Falta cerrar su alcance global o por clínica/sede. Actualmente existe lookup por matrícula exacta; al seleccionarlo debe comprobarse el `appointmentId` esperado. La lectura exacta por ejecución ya está desplegada.

## 6. Implementación y despliegue pendientes

- Owner: dominio, migración de restricciones SQL, flag `ESTOMA_DIRECT_SUPERVISOR_COMPLETION_ENABLED` apagado por defecto, conservación de auditoría, atomicidad y concurrencia.
- BFF: capacidad inequívoca de lectura, validación de materiales, OpenAPI y pruebas de proyecciones con originales null en cierre directo. Flag de presentación/compatibilidad apagado hasta verificar owner.
- Desplegar versiones compatibles, habilitar owner de forma homogénea y después la capacidad BFF/front. Un resultado rechazado con una clave no se reejecuta por activar un flag más tarde.
- Fixtures y E2E: ambos caminos, conflicto concurrente, reintento idéntico, recarga, lectura exacta y recursos liberados. El trabajo de colección del camino existente continúa; no certifica esta rama nueva.

## Prueba conjunta de aceptación

1. Sin envío: localizar ejecución `IN_PROGRESS` → leer capacidad/versión → supervisor captura → `/complete` → operación `SUCCEEDED` → lectura exacta/cita `COMPLETED`, originales y fecha de envío null, finales exactos y asignación liberada.
2. Con envío: alumno `/exit` → `EXIT_SUBMITTED` → supervisor revisa/corrige → `/complete` → originales y finales separados, sin doble cierre.
3. En ambos: reintento de la misma intención devuelve la misma operación; conflicto de versión exige relectura y nueva confirmación; recarga recupera el recibo y la misma ejecución.
