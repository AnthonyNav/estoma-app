> Archivo de trazabilidad: refleja el estado de su fecha original, no el estado vigente. Consultar el [índice actual](../../README.md).

Revisado contra `aa93cd2` (HEAD antes de los commits) y los cambios locales de Lavado. No hay PR/base de destino identificados; esta revisión corresponde al conjunto local solicitado.

Veredicto: **aprobar condicionado**.

Motivo: el conjunto implementa los recorridos del contrato vigente y pasa las verificaciones locales. La integración real y el nuevo cierre sin envío del alumno no están certificados.

## Lo verificado

- Modelos, adaptadores HTTP, guards, configuración de mocks, operaciones y consumidores de las vistas de agendamiento, inicio del alumno, ingreso, reasignación y salida.
- Acceso automático de preview limitado a desarrollo con mocks habilitados; integración y producción lo deshabilitan.
- Consulta de alumno sin POST de llegada; aprobación encadena dos intenciones con claves diferentes. Rechazo libre omite checks y permanece deshabilitado en integración.
- Salida vigente exige EXIT_SUBMITTED. Cantidades completas, versión de ejecución e idempotencia en complete; confirmación por lectura exacta de la misma atención y recursos liberados.
- Recibos de entrada y salida separados por cuenta; recuperación tras recarga en navegador. No se guardan bearer ni QR en esos recibos.
- Se retiraron las importaciones de tests a docs/contracts: los ejemplos sintéticos propios de pruebas viven en src/app/features/wash-supervision/testing/entry-responses.fixture.json. Esto permite excluir docs y contratos de los commits.

## Seguimiento

### ⚪ F-1 — Nuevo cierre directo requiere ampliación backend

Hecho: contrato-front-salida-lavado.md exige EXIT_SUBMITTED; canCompleteExit conserva esa condición. El usuario requiere ahora que el supervisor capture y cierre también desde IN_PROGRESS.

La decisión de producto ya está tomada. Falta definir/habilitar el comando, conservar la ausencia de declaración del alumno, resolver concurrencia con su envío y verificar lectura final/liberación. Detalle en supervisor-direct-exit-contract-request.md. No se habilitó una transición rechazada por el contrato vigente.

### ⚪ F-2 — Activaciones y certificación externas pendientes

Rechazo libre, QR y candidatos requieren las activaciones documentadas. Directorio por nombre y appointmentId sigue sin endpoint operativo confirmado. Las cuentas/citas vigentes y la prueba conjunta siguen pendientes. No se realizaron consultas ni mutaciones contra backend remoto.

## Pruebas

- Ejecutadas: pnpm test:ci (120 aprobadas), pnpm lint y pnpm build. Repetidas sobre worktree limpio de 8e7ecdf, sin docs/contratos pendientes: format:check, lint, 120 tests y build aprobados.
- Navegador con mocks: búsqueda manual y QR simulado hacia revisión; espera sin formulario conforme al contrato vigente; corrección de cantidades; cierre; recuperación al recargar; siguiente escáner sin cámara activa. Sin desbordamiento a 320, 390, 768 y 1440 px.
- Inspeccionadas: errores, estado incierto, aislamiento de cuentas, claves idempotentes, rechazo sin evaluación, validadores y lectura histórica con materiales enviados null.
- Faltantes: prueba autenticada conjunta con BFF/owners y nuevo camino IN_PROGRESS → COMPLETED.

No se certifica producción con fixtures. Los ocho commits deben revisarse como una serie de dependencias; las verificaciones funcionales corresponden al conjunto final.

## Decisión

**aprobar condicionado** para conservar y revisar el código del contrato vigente. La habilitación real depende de las pruebas y activaciones anteriores; el cierre directo permanece pendiente de contrato backend.

## Serie guardada

- 2315b0a feat(wash): define lifecycle models and integration configuration
- fe98403 feat(wash): add validated HTTP adapters and local journey fixtures
- c768110 feat(wash): coordinate booking entry reassignment and exit operations
- 00fdc58 feat(booking): refine regulation details and time slot registration
- 2a33f49 feat(student): add appointment status cancellation and exit review screens
- a05da1a feat(supervision): add dashboard scanner directory and reassignments
- 2dec2ad feat(supervision): verify entry with approval and reason-only rejection
- 8e7ecdf feat(app): connect wash routes and enforce authenticated system context

Ningún cambio de docs/contratos forma parte de la serie. No se hizo push.
