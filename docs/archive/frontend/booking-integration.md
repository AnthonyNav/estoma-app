> Archivo de trazabilidad: refleja el estado de su fecha original, no el estado vigente. Consultar el [índice actual](../../README.md).

# Agendamiento de lavado

## Recorrido local

Ejecutar `pnpm start --host 127.0.0.1` y abrir <http://127.0.0.1:4200>.
Usar matrícula `202257019`, contraseña `demo-local` y sistema Lavado ultrasónico.

Inicio sin cita → Registrar cita → aceptar reglamento → datos del instrumental y materia → horarios de hoy → confirmar → seguimiento de operación → cita programada.

El modo local simula backend. La reserva confirmada no inventa un QR cuando `qrRepresentation` es null. Los horarios se generan para el día actual en America/Mexico_City.

Para explorar fallos, abrir una nueva carga de `/authentication/sign-in?washFixture=ESCENARIO`, iniciar sesión y recorrer el registro:

| Escenario                 | Resultado                                                      |
| ------------------------- | -------------------------------------------------------------- |
| `normal`                  | Reserva confirmada                                             |
| `no-courses`              | Sin materias elegibles                                         |
| `no-slots`                | Sin cupos disponibles                                          |
| `blocked`                 | Registro bloqueado                                             |
| `availability-refreshing` | Dos respuestas 503 y recuperación automática                   |
| `schedule-offline`        | Respuesta perdida tras aceptar; reintento con la misma clave   |
| `schedule-rejected`       | Primer intento rechazado por cupo; refrescar y elegir de nuevo |
| `operation-failed`        | Resultado incierto; conservar referencia                       |
| `operation-pending`       | Espera acotada y consulta manual de la misma operación         |
| `home-lag`                | Confirmación anterior a la actualización de Inicio             |

## Backend

Referencia: `development/frontend-agendamiento-integracion.md` del repositorio Estoma. Snapshot OpenAPI de runtime `c7b84fd240601526817781fa7622b3aef34bc8a8` en `docs/contracts/bff-c7b84fd.openapi.json`.

`pnpm start:wash --host 127.0.0.1` utiliza autenticación, Inicio, agendamiento y supervisión HTTP mediante `proxy.wash.json`, con destino local `127.0.0.1:18080`. Requiere el túnel BFF previamente establecido, una cuenta de prueba habilitada y horarios/cupos aprovisionados por backend. El recorrido de ingreso del supervisor se documenta en [supervision-integration.md](supervision-integration.md). No se ha ejecutado una reserva contra el entorno remoto.

La clave de idempotencia se envía en `Idempotency-Key`. Un 202 conserva la intención y comienza consultas de la operación; sólo SUCCEEDED inicia la reconciliación con Inicio. PENDING, desconexión, FAILED y EXPIRED no habilitan un segundo POST con otra clave. REJECTED descarta la selección y actualiza disponibilidad. Los reintentos automáticos de lectura son acotados y respetan Retry-After; esperas mayores a diez segundos pasan a consulta manual.

La referencia pendiente se conserva en memoria, incluso al salir y volver a ingresar con la misma cuenta, y se aísla de otras cuentas. Una recarga completa o cerrar la pestaña borra ese estado local: al volver se consulta Inicio, pero la recuperación de una operación aún pendiente tras recargar requiere persistencia adicional o un endpoint de recuperación. No se guardan tokens ni datos de reserva en almacenamiento persistente.

## Explorar el QR

El recorrido `normal` mantiene `qrRepresentation: null` y permite actualizar la consulta desde Inicio. Para completar una reserva con QR simulado, cargar `/authentication/sign-in?washFixture=with-qr` e iniciar el recorrido desde cero. El código contiene un texto de demostración sin validez de ingreso y la UI lo identifica explícitamente. En integración HTTP sólo se representa el valor recibido, incluso antes de la ventana de llegada; el contexto determina la instrucción de uso; nunca se sustituye un null por un código local.

## Actualización de contratos y cancelación

Revisada la actualización local de `development/frontend-agendamiento-integracion.md`: el QR entregado se representa incluso con `qrUsageContext: NONE`; el contexto gobierna la acción. El documento mantiene el mismo BFF c7b84fd y señala que la entrega real del QR sigue siendo obligatoria y pendiente en backend. El mock no acredita esa integración.

Cancelación: `POST /api/v1/wash/appointments/{appointmentId}/cancel`, con `Idempotency-Key` y cuerpo `{ expectedVersion }` (reason es opcional). Botón disponible cuando Home indica `studentCancellationAction: AVAILABLE`, versión válida y estado SCHEDULED. Confirmar en un diálogo, esperar la operación y reconciliar Home; 202 no se presenta como cita cancelada. Ante respuesta perdida se preservan comando y clave; FAILED/EXPIRED conservan referencia, REJECTED actualiza Home. El estado pendiente está aislado por cuenta y permanece en memoria durante navegación/cambio de sesión; una recarga completa lo elimina, igual que la reserva.

Escenarios adicionales desde login: `washFixture=qr-before-entry` muestra QR con contexto NONE; `washFixture=cancel-deadline-passed` muestra el plazo vencido sin botón de cancelación. El modo normal y with-qr permiten cancelar y volver a consultar disponibilidad. Las reglas de penalización reales siguen siendo responsabilidad del owner; el mock no certifica ese cálculo.
