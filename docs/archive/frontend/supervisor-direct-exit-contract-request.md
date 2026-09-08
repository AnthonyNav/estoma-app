> Archivo de trazabilidad: refleja el estado de su fecha original, no el estado vigente. Consultar el [índice actual](../../README.md).

# Solicitud: cierre por supervisor sin envío previo del alumno

Decisión de producto: el supervisor debe poder capturar los materiales y liberar la cita aunque el alumno no haya enviado su formulario. El contrato vigente de salida exige EXIT_SUBMITTED; no es suficiente eliminar la condición del frontend.

## Confirmaciones requeridas de backend

1. Transición autorizada IN_PROGRESS → COMPLETED para SUPERVISOR_LAVADO, con asignación activa. Confirmar si se amplía POST /api/v1/wash/executions/{id}/complete conservando finalMaterials, expectedVersion e Idempotency-Key, o entregar endpoint/DTO alternativo. Mantener EXIT_SUBMITTED → COMPLETED.
2. Materiales: las cuatro cantidades completas, enteras no negativas, al menos una positiva y límites actuales. Confirmar que submittedExitMaterials y exitSubmittedAt permanecen null cuando no hubo envío del alumno; no fabricar un envío ni atribuírselo al alumno.
3. Auditoría: identificar al supervisor que capturó y cerró, fecha y origen de los materiales. Precisar campos públicos si deben mostrarse; conservar originales cuando sí exista declaración del alumno.
4. Concurrencia: si el alumno envía mientras el supervisor captura, expectedVersion debe resolver el conflicto. Documentar error y relectura para revisar los materiales recibidos antes de una nueva confirmación. Reintentos de la misma intención conservan clave/cuerpo; no duplicar cierre ni liberación.
5. Lecturas: lookup/manual/QR en IN_PROGRESS deben permitir identificar esta atención para revisión; nextAction/capacidad inequívoca para habilitar cierre directo. Home y lectura exacta deben reflejar COMPLETED, finalExitMaterials, completedAt, asignación activa null y última asignación. Confirmar cierre de cita y liberación de recursos.
6. Despliegue: OpenAPI actualizado, activación/flag si corresponde y fixtures de ambos caminos, conflicto de versión, reintento y recarga.

El QR del alumno permanece oculto durante IN_PROGRESS conforme a la decisión anterior de interfaz; la búsqueda manual permite identificarlo. Confirmar si el QR de ingreso previamente disponible sigue siendo válido para lookup en este estado cuando se escanee una copia.

## Prueba conjunta requerida

Sin envío del alumno: localizar cita IN_PROGRESS → capturar materiales supervisor → complete → operación SUCCEEDED → lectura exacta/Home COMPLETED con declaración original null y recursos liberados.

Con envío del alumno: EXIT_SUBMITTED → revisar/corregir → complete, preservando originales y finales por separado.

Este documento no cambia ni certifica el contrato vigente; la habilitación del nuevo camino queda pendiente de respuesta backend.
