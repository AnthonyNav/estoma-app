# Fixtures locales

Ejecutar pnpm start. Base http://127.0.0.1:4200. Demos sintéticas sin validez backend. Copiar cada enlace en una pestaña nueva vacía; duplicar o recargar puede conservar una operación anterior.

## Alumno

Usar /wash/student?fixture=VALOR&preview=student-exit. Para registrar con QR simulado añadir &washFixture=with-qr; sin cita usar no-appointment. Formulario de salida: /wash/student/exit?fixture=in-progress&preview=student-exit.

| Fixture                 | Escenario                                     |
| ----------------------- | --------------------------------------------- |
| `loading`               | Carga prolongada.                             |
| `no-appointment`        | Alumno sin cita; permite iniciar el registro. |
| `scheduled-no-qr`       | Cita programada sin código disponible.        |
| `scheduled-entry-qr`    | Cita programada con código de ingreso.        |
| `pending-entry`         | Llegada registrada, pendiente de validación.  |
| `pending-reassignment`  | Ingreso autorizado, pendiente de espacio.     |
| `in-progress`           | Lavado activo con recurso asignado.           |
| `exit-submitted`        | Salida enviada para revisión.                 |
| `completed`             | Atención finalizada.                          |
| `cancelled`             | Atención cancelada.                           |
| `missed`                | Inasistencia.                                 |
| `entry-rejected`        | Rechazo con motivo visible para el alumno.    |
| `temporary-unavailable` | Error temporal del servicio.                  |
| `forbidden`             | Usuario sin acceso al módulo.                 |
| `offline`               | Error de red.                                 |

## Supervisor

Home: /wash/supervision. Escáner inicialmente apagado: /wash/supervision/scan. Manual: /wash/supervision/manual?washFixture=supervisor-entry; seleccionar Ana para aprobar o rechazar en demos independientes. Reasignaciones: /wash/supervision/reassignments.

Salida: /wash/supervision/manual?washFixture=supervisor-exit. Ana tiene formulario; Carlos/María esperan envío según el contrato desplegado. El cierre directo aún no está implementado.

| Escenario                 | Resultado                                                                 |
| ------------------------- | ------------------------------------------------------------------------- |
| `supervisor-entry`        | Llegada y autorización con recursos; también permite rechazar             |
| `supervisor-no-resources` | Autorización confirmada, pendiente de asignación                          |
| `supervisor-offline`      | Respuesta perdida tras aceptar cada comando; consultar reutiliza la clave |
| `supervisor-lag`          | Operación terminada antes de que la consulta refleje el cambio            |
| `supervisor-too-early`    | Llegada rechazada por ventana de tiempo                                   |
| `supervisor-pending`      | Operación pendiente; espera acotada y consulta manual                     |
| `supervisor-failed`       | Resultado incierto; conserva referencia y bloquea otra intención          |

## Errores de reserva

Abrir /authentication/sign-in?washFixture=ESCENARIO; Lavado, 202257019 y contraseña sintética no vacía.

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

## Reinicio controlado

Sólo demos locales sin operaciones pendientes: eliminar sessionStorage estoma.entry.demo.v2, estoma.entry.receipts.v2, estoma.student-exit.demo.v1, estoma.student-exit.receipts.v1, estoma.supervisor-exit.demo.v1, estoma.supervisor-exit.receipts.v1 y borradores estoma.exit.draft._ / estoma.exit.review._. Preferir pestaña nueva. No borrar referencias de solicitudes reales. Reserva/cancelación en memoria se reinician al recargar.

[Autenticación](authentication.md) · [Validación](validation.md)
