# Agendamiento, Home y cancelación

Fuentes: OpenAPI vigente y [aclaraciones recibidas](../archive/frontend/booking-integration.md). Aplican las [reglas comunes](common.md). Recorrido local probado; integración compartida pendiente.

## Registro

Sin cita → reglamento → datos → horarios → confirmación → operación → Home. Datos y horarios son pantallas separadas.

- GET /wash/appointments/form-context entrega identidad y materias; no inventar elegibilidad.
- GET /wash/appointments/availability recibe appointmentType, instrumentCount, pieceType y courseSectionId. Backend determina bloqueos, cupos, fechas y autorización excepcional.
- POST /wash/appointments incluye formulario, regulationAccepted, appointmentTimeSlotId, exceptionalAuthorizationId cuando corresponda e Idempotency-Key.
- No enviar slots vencidos o incompatibles con disponibilidad. Rechazo por cupo exige actualizar y elegir de nuevo.
- No calcular penalizaciones ni conceder autorizaciones excepcionales en front.
- La pantalla de reglamento conserva los lineamientos aprobados por producto.

## Home y QR

Respetar QR null sin inventar un código. QR real es opaco; backend lo valida.

Decisión de interfaz: IN_PROGRESS presenta primero el espacio y oculta QR; EXIT_SUBMITTED permite mostrar el QR recibido para revisión. Ocultarlo no revoca una copia anterior.

No confundir cita registrada, llegada, autorización, envío de salida y cierre. PENDING_REASSIGNMENT informa autorización pendiente de espacio.

## Cancelación

POST /wash/appointments/{appointmentId}/cancel con expectedVersion de cita e Idempotency-Key.

Ofrecer sólo con SCHEDULED, versión válida y studentCancellationAction=AVAILABLE. Confirmar en diálogo, esperar operación y reconciliar Home. DEADLINE_PASSED y NOT_APPLICABLE no habilitan solicitud.

Reserva y cancelación recuperan sus referencias tras recargar en la misma pestaña, conforme al contrato común. El despliegue de una corrección de cancelación no acredita reparación de históricos.

Pruebas: adapters HTTP, draft, disponibilidad y appointment-cancellation.service.spec.ts.
