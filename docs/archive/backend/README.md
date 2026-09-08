> Archivo de trazabilidad: refleja el estado de su fecha original, no el estado vigente. Consultar el [índice actual](../../README.md).

# Contratos backend para Lavado

Referencia desplegada observada: BFF `9c6f418`, Wash Execution `7c837a6`, Appointments `efd426f`; réplicas disponibles. Estos datos y el OpenAPI no sustituyen una prueba autenticada del recorrido completo.

- [OpenAPI vigente](../../contracts/bff-9c6f418.openapi.json): descargado del BFF y comparado como JSON con el commit desplegado. Las copias `dff3ea2`, `237f5c0`, `76b44bd`, `d1cb63d`, `c7b84fd` y el candidato `e6c7ee8f` son históricas.
- [Llegada explícita y decisión](contrato-front-llegada-explicita.md): encadenamiento desde Aprobar/Rechazar, precondiciones y recuperación.
- [Rechazo con motivo libre](contrato-front-rechazo-ingreso.md): ampliación HTTP desplegada, pendiente de habilitación y certificación.
- [Cierre directo por supervisor](contrato-front-cierre-directo-supervisor.md): decisión de producto confirmada, ampliación backend en implementación; aún no desplegada.
- [Registro y autorización de salida](contrato-front-salida-lavado.md): envío del alumno, revisión/corrección del supervisor y cierre.
- [Consulta exacta después del cierre](contrato-front-lectura-exacta-supervisor.md): endpoint por `washExecutionId` ya desplegado; conserva la identidad de la atención incluso entre días.
- [Reasignaciones pendientes](contrato-front-reasignaciones.md) y [ejemplos sintéticos](../../contracts/examples/ejemplos-reasignaciones.json): reglas y errores. La lógica de estos documentos continúa vigente aunque cite la versión anterior compatible.

- [Preparación para integrar](estado-integracion-backend.md): respuestas a los cuatro puntos, alcance pendiente y evidencias disponibles.

## Estado de integración

- PR157 (reader BFF), PR158 (owner nullable), PR159 (consulta exacta), PR160 (HTTP rechazo) y PR161 (cancelación proyectada) están integrados y desplegados. PR161 corrige nuevos eventos y redelivery original; no acredita reparación de históricos.
- La adaptación HTTP para rechazo por motivo libre de [PR160](https://github.com/AnthonyNav/estoma-services/pull/160) está desplegada en `dff3ea2`. El OpenAPI vivo coincide con el commit. La capacidad nueva queda apagada por defecto; habilitar owner antes que BFF y certificar el recorrido. No reinterpretar `false/false` como neutro. El candidato d42ba762 queda histórico.
- QR está implementado, pero su activación y certificación siguen pendientes. Los indicadores del OpenAPI distinguen capacidad implementada de activación por defecto.
- Candidatos de reasignación siguen pendientes de habilitar y certificar en el entorno de integración.
- PR156, que endurece las filas incompletas de reasignación, sigue pendiente de comprobar la integridad de la población antes de desplegarlo.
- El directorio manual y lookup por `appointmentId` siguen pendientes. Ruta propuesta: `/api/v1/wash/supervision/manual-appointments`; falta definir visibilidad global o por clínica/sede.
- Las cuentas/citas sintéticas vigentes y el recorrido conjunto de salida continúan pendientes. Los ejemplos guardados no son datos provisionados.

## Reglas de interacción

Consultar una tarjeta o QR no registra llegada. Confirmar presencia requiere una acción explícita antes del POST de llegada. `nextAction=ENTRY` no acredita presencia.

`registeredAppointments` de Home cuenta todas las citas del día, incluidos terminales. La etiqueta compatible es “Citas del día”; no representa el total activo del futuro directorio.

Las tarjetas no conceden autorización para comandos. Usar versiones de lecturas actualizadas y esperar la operación más la convergencia de la misma atención antes de confirmar el resultado.
