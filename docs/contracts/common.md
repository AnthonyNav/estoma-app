# Reglas comunes

Fuentes: OpenAPI vigente y aclaraciones backend enlazadas en cada contrato. Ver [validación](../testing/validation.md).

- Llamar exclusivamente al BFF bajo /api/v1. Guards no sustituyen autorización backend.
- Cada intención usa Idempotency-Key. Reintentar conserva ruta, cuerpo y versión; otra intención requiere confirmación deliberada y nueva clave.
- 202 confirma recepción durable, no éxito. Conservar operationId, pollPath, clave y cuerpo; consultar operación.
- PENDING mantiene seguimiento. SUCCEEDED exige reconciliar la misma entidad antes de anunciar el resultado.
- REJECTED de operación rechaza el comando, no acredita un ingreso rechazado. errorCode funcional está en raíz.
- FAILED, EXPIRED, timeout y respuesta perdida no prueban ausencia de efectos. No generar otra intención automáticamente.
- No inferir operación si el POST falla sin referencia; distinguir errores definitivos de ambiguos según endpoint.
- Cancelación del alumno usa versión de cita; ingreso, reasignación y salida usan versión de ejecución. No intercambiarlas ni inventar versiones.
- Respetar Retry-After cuando exista y acotar consultas. Un 503 de proyección no equivale a lista vacía.
- Mantener identidad de cita/ejecución durante relecturas. Otra cita por matrícula no confirma la anterior.
- Recibos aislados por cuenta, sin bearer ni QR. No se garantiza recuperar operaciones cuyos identificadores y claves se perdieron.

## Persistencia del cliente

Entrada, reasignación y salidas conservan recibos en sessionStorage para recarga en la misma pestaña. Cerrar la pestaña puede perderlos.

Reserva y cancelación del alumno mantienen seguimiento en memoria: recargar pierde la referencia. Consultar Home no demuestra que no exista una solicitud en tránsito. Esa recuperación sigue pendiente de cerrar antes de certificarla.

Tokens y perfil permanecen en memoria. El service worker no cachea autenticación ni operaciones de negocio.
