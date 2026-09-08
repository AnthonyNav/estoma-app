# Reglas comunes

Fuentes: OpenAPI vigente y aclaraciones backend enlazadas en cada contrato. Ver [validación](../testing/validation.md).

La [matriz de excepciones](exceptions.md) precisa qué respuestas del POST descartan una operación nueva para ese intento, cuáles son ambiguas, la retención mínima de idempotencia y los huecos de retención/lecturas/carreras. Incluye [13 ejemplos sintéticos](examples/wash-exceptions.examples.json), sin certificar fixtures vivas.

- Llamar exclusivamente al BFF bajo /api/v1. Guards no sustituyen autorización backend.
- Cada intención usa Idempotency-Key. Reintentar conserva ruta, cuerpo y versión; otra intención requiere confirmación deliberada y nueva clave.
- 202 confirma recepción durable, no éxito. Conservar operationId, pollPath, clave y cuerpo; consultar operación. Un recibo recuperado por idempotencia puede incluir cualquier estado válido, no sólo PENDING.
- PENDING mantiene seguimiento. SUCCEEDED exige reconciliar la misma entidad antes de anunciar el resultado.
- REJECTED de operación rechaza el comando, no acredita un ingreso rechazado. errorCode funcional está en raíz.
- FAILED, EXPIRED, timeout y respuesta perdida no prueban ausencia de efectos. No generar otra intención automáticamente.
- No inferir operación si el POST falla sin referencia; distinguir errores definitivos de ambiguos según endpoint. Un 400/403 en un reintento no descarta los efectos de un intento anterior incierto.
- Cancelación del alumno usa versión de cita; ingreso, reasignación y salida usan versión de ejecución. No intercambiarlas ni inventar versiones.
- Respetar Retry-After cuando exista y acotar consultas. Un 503 de proyección no equivale a lista vacía.
- Mantener identidad de cita/ejecución durante relecturas. Ingreso, reasignación, cancelación clínica y cierre del supervisor consultan la ejecución exacta. Otra cita por matrícula o un Home vacío no confirman la anterior.
- Recibos aislados por cuenta, sin bearer ni QR. No se garantiza recuperar operaciones cuyos identificadores y claves se perdieron.

## Persistencia del cliente

Entrada, reasignación, salidas, reserva y cancelación del alumno conservan recibos en sessionStorage, aislados por cuenta. Recargar en la misma pestaña permite retomar la operación o reenviar la misma intención con su clave original si se perdió la respuesta. No se inicia un comando nuevo si no puede guardarse su recibo.

Cerrar la pestaña o borrar almacenamiento puede perder referencias; no existe recuperación garantizada desde backend sin ellas. La sesión real sigue requiriendo autenticación tras recargar. Los recibos no incluyen tokens ni QR.

Tokens y perfil permanecen en memoria. El service worker no cachea autenticación ni operaciones de negocio.
