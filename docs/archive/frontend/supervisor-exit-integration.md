> Archivo de trazabilidad: refleja el estado de su fecha original, no el estado vigente. Consultar el [índice actual](../../README.md).

# Revisión de salida del supervisor

El QR y la búsqueda manual conservan su lookup de entrada y muestran la revisión cuando `nextAction=EXIT_REVIEW`. Una aprobación de ingreso recién confirmada mantiene su propia pantalla de éxito; la siguiente búsqueda se resuelve según el estado actual, sin repetir llegada.

- `IN_PROGRESS`: espera del formulario del alumno, sin acción para completar. Consulta visible cada cinco segundos.
- `EXIT_SUBMITTED`: exige versión positiva, fecha de envío, las cuatro cantidades válidas y asignación activa. Precarga valores finales desde los originales, permite aumentarlos/disminuirlos y muestra qué cambió. No existe rechazo de salida ni se envían booleanos de ingreso.
- Autorizar: POST `/wash/executions/{id}/complete` con `finalMaterials`, `expectedVersion` e Idempotency-Key. Persiste intención exacta y referencia por cuenta en sessionStorage, sin bearer/QR. La recarga espera primero la restauración de sesión y luego retoma la solicitud.
- Confirmación: espera SUCCEEDED y consulta exacta de la misma ejecución/cita, versión posterior, ambos estados COMPLETED, recursos liberados, última asignación y valores finales coincidentes. No usa matrícula o QR como prueba histórica del cierre. Una lectura atrasada/no disponible conserva la referencia y no repite complete. FAILED/EXPIRED no habilitan otro comando.
- Resultado: materiales finales y botones «Escanear siguiente alumno» / «Volver al inicio». El escáner queda inactivo hasta que se solicite la cámara.

## Consulta exacta desplegada

El contrato vigente confirma BFF dff3ea2 y GET `/api/v1/wash/supervision/executions/{washExecutionId}`. `enableSupervisorExecutionRead=true` habilita la comprobación exacta. Los registros históricos pueden devolver `submittedExitMaterials=null`; siguen siendo obligatorios los materiales finales, fecha de cierre y última asignación para confirmar un cierre. No se sustituye esta lectura por matrícula ni QR si falla.

La búsqueda manual en integración dispone de matrícula exacta mediante el lookup existente; el listado y búsqueda por nombre siguen siendo demo hasta que backend entregue el directorio. QR real continúa sujeto a su activación por backend.

## Probar localmente

`http://127.0.0.1:4200/wash/supervision/manual?washFixture=supervisor-exit`

En una demo limpia, Ana está lista para revisión y Carlos/María todavía no envían su formulario. Si existe un envío simulado previo del alumno en la pestaña, se usa ese estado en lugar de inventar otra declaración. El cierre actualiza Home, elimina el QR, conserva los materiales originales y guarda por separado los finales y la última asignación.

Para reiniciar una demo sin solicitudes pendientes, eliminar `estoma.supervisor-exit.demo.v1`, `estoma.supervisor-exit.receipts.v1` y las claves `estoma.exit.review.*`. Si también se quiere descartar el envío previo del alumno, eliminar su demo según `student-exit-integration.md`. No eliminar referencias de solicitudes reales pendientes.

Pendientes externos: validación integrada de lectura exacta, directorio, activación QR, cuentas/cita vigentes y certificación conjunta. Las pruebas de navegador usan lectura QR simulada sin activar la cámara y no certifican QR real.
