# Validación

Ejecutar pnpm format:check, pnpm lint, pnpm test:ci y pnpm build con Node 22, pnpm fijado por packageManager y Chrome/Chromium. CHROME_BIN permite indicar su ejecutable.

## Evidencia local

Código 8e7ecdf: formato, lint, 120 pruebas y build aprobados en worktree limpio. [Revisión original](../archive/frontend/pre-pr-wash-review.md).

Navegador con mocks: consulta sin llegada automática; aprobación con claves diferentes y recarga; revisión de salida por manual/QR simulado, cantidades corregidas, cierre y siguiente escáner inactivo. Sin desbordamiento a 320, 390, 768 y 1440 px.

HttpTestingController y mocks no certifican backend, QR real ni liberación distribuida.

## Integración pendiente

- Login, ambos roles, acceso denegado y expiración.
- Reserva/cancelación → operación → misma cita; recuperación de referencias.
- Lookup sin mutación → llegada → aprobación/rechazo habilitado → misma ejecución.
- Pendiente → candidatos → reasignación/cancelación por capacidad, conflictos y actualización.
- Alumno envía → supervisor corrige → complete → lectura exacta/Home con originales/finales separados y recursos liberados.
- Cierre directo sólo tras versión compatible: originales null y finales capturados por supervisor.
- Idempotencia, respuesta perdida, versión obsoleta, proyección retrasada, recarga y cleanup.

Cada evidencia incluirá fecha, entorno, commits, flags, caso, resultado y log sanitizado.
