> Archivo de trazabilidad: refleja el estado de su fecha original, no el estado vigente. Consultar el [índice actual](../../README.md).

# Salida del alumno

Implementación del formulario en `/wash/student/exit`, enlazado desde Home cuando la ejecución está `IN_PROGRESS`. Los cuatro contadores se envían completos, con enteros no negativos de 32 bits y al menos uno positivo; no se inventan límites de negocio por tipo de lavado. Se utiliza `executionVersion` (alias de compatibilidad `version`), nunca la versión de la cita.

El envío utiliza `/wash/executions/{id}/exit`, Idempotency-Key y operaciones asíncronas. Tras SUCCEEDED se exige la misma cita/ejecución, versión posterior y los materiales enviados coincidentes en Home antes de mostrar espera de revisión. No se interpreta un 202 como autorización de salida. FAILED/EXPIRED y errores ambiguos conservan la intención y bloquean otro envío. El seguimiento se suspende con la pestaña oculta; la sesión terminada cancela solicitudes en curso.

El borrador y los recibos pendientes se guardan por cuenta y ejecución en sessionStorage, sin bearer ni QR. La misma pestaña permite recuperar tras recarga; cerrar la pestaña pierde ese almacenamiento. El alumno no puede modificar materiales después de EXIT_SUBMITTED. La pantalla consulta Home cada cinco segundos visibles durante la espera y presenta finalExitMaterials cuando backend refleje COMPLETED.

## Revisión local

Abrir con navegación completa:

`http://127.0.0.1:4200/wash/student/exit?fixture=in-progress&preview=student-exit`

La entrada automática de alumno es exclusiva del modo local, con mocks activos, preview habilitado y ese parámetro explícito; mantiene los controles normales de rol. No aplica a producción ni al entorno de integración. El mock registra la salida y mantiene la espera de supervisor: no la autoriza automáticamente. La revisión del supervisor se implementará después.

Para reiniciar una demostración sin operaciones pendientes, eliminar `estoma.student-exit.demo.v1`, `estoma.student-exit.receipts.v1` y las claves `estoma.exit.draft.*` del almacenamiento de sesión. Los fixtures `exit-submitted` y `completed` permiten explorar estados de lectura en una demo limpia; el estado de una operación simulada ya creada tiene prioridad.

El adaptador real está preparado según `contracts/contrato-front-salida-lavado.md` y OpenAPI 76b44bd. Siguen pendientes de backend las cuentas/cita vigentes y la certificación conjunta; los mocks no acreditan la integración real, QR activado ni el cierre por supervisor.
