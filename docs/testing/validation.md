# Validación

Ejecutar pnpm format:check, pnpm lint, pnpm test:ci y pnpm build con Node 22, pnpm fijado por packageManager y Chrome/Chromium. CHROME_BIN permite indicar su ejecutable.

## Evidencia local

Código 8e7ecdf: formato, lint, 120 pruebas y build aprobados en worktree limpio. [Revisión original](../archive/frontend/pre-pr-wash-review.md).

Navegador con mocks: consulta sin llegada automática; aprobación con claves diferentes y recarga; revisión de salida por manual/QR simulado, cantidades corregidas, cierre y siguiente escáner inactivo. Sin desbordamiento a 320, 390, 768 y 1440 px.

Cambios locales posteriores (7 de septiembre de 2026 UTC): 149 pruebas aprobadas. Cobertura de recibos 202 con estado avanzado, 404 vacío de operaciones, reintento 403 tras respuesta perdida, recuperación tras recarga, operaciones FAILED/EXPIRED con lectura coincidente y bloqueo cuando no coincide. Reasignación y cancelación clínica usan la ejecución exacta; Home no descarta una cancelación incierta por una cita distinta o ausente. Formato, lint y build aprobados. Navegador local: cierre directo con recarga durante la confirmación y cantidades conservadas; reasignación con lectura exacta y cabina/tina visibles. Las fixtures de agenda fijan la hora dentro del horario de servicio para que las pruebas no dependan de ejecutarse cerca de medianoche.

HttpTestingController y mocks no certifican backend, QR real ni liberación distribuida. La matriz de [excepciones](../contracts/exceptions.md) distingue contratos confirmados en código de correcciones y capacidades todavía pendientes de despliegue.

## Preparación tras auditoría de la imagen de47fda

El código del PR conserva las intenciones antes del POST y no las descarta ante 400/403/422 de un reintento después de una respuesta ambigua. Las pruebas incluyen llegada, decisión de ingreso, reserva, cancelación, reasignación y ambas salidas. El interceptor sólo genera correlación: las claves idempotentes pertenecen a los comandos, no a login ni lookup.

167 pruebas locales aprobadas durante la preparación. Esta evidencia no corresponde a la imagen de47fda auditada ni certifica backend. Antes de aceptación, ejecutar en navegador contra la nueva imagen: recarga entre POST/recibo, reautenticación con la misma cuenta, mismo comando/clave y reconciliación exacta sin otra mutación. Las referencias en sessionStorage sobreviven recargas de la pestaña; no se garantiza recuperación al cerrarla.

## Integración pendiente

- Login, ambos roles, acceso denegado y expiración.
- Reserva/cancelación → operación → misma cita; recuperación de referencias.
- Lookup sin mutación → llegada → aprobación/rechazo habilitado → misma ejecución.
- Pendiente → candidatos → reasignación/cancelación por capacidad, conflictos y actualización.
- Alumno envía → supervisor corrige → complete → lectura exacta/Home con originales/finales separados y recursos liberados.
- Cierre directo sólo tras versión compatible: originales null y finales capturados por supervisor.
- Idempotencia, respuesta perdida, versión obsoleta, proyección retrasada, recarga y cleanup.

Cada evidencia incluirá fecha, entorno, commits, flags, caso, resultado y log sanitizado.
