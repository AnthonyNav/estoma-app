> Archivo de trazabilidad: refleja el estado de su fecha original, no el estado vigente. Consultar el [índice actual](../../README.md).

# Rechazo de ingreso con motivo libre

Estado: integrada mediante [PR160](https://github.com/AnthonyNav/estoma-services/pull/160) y desplegada en BFF `dff3ea235372ec91c200ec00f4d118282d566e2a`. Réplica disponible y OpenAPI vivo idéntico al commit verificados. La capacidad nueva permanece deshabilitada por defecto y su activación no está certificada; un despliegue compatible no basta para usarla. La versión actual compatible es BFF `9c6f418` y su OpenAPI vigente de front es `bff-9c6f418.openapi.json`; conserva el mismo contrato HTTP.

## Solicitud nueva

Ruta existente: `POST /api/v1/wash/executions/{washExecutionId}/entry-decision`, con sesión de supervisor de Lavado y cabecera `Idempotency-Key`.

```json
{
  "decision": "REJECTED",
  "rejectionReason": "Motivo operativo indicado por el supervisor",
  "expectedVersion": 1
}
```

El motivo debe contener texto no blanco y tener máximo 500 caracteres. Ambos campos `identityConfirmed` y `requirementsSatisfied` pueden omitirse o enviarse como null; ambas formas representan la misma intención. No se envían al Command del owner. No sustituirlos por `false/false`: esa pareja declara dos resultados negativos y sigue siendo una intención distinta.

Para aprobar, enviar `decision=AUTHORIZED`, ambos booleanos exactamente true y motivo ausente/null. El backend deriva identidad del supervisor y hora de decisión; front no los suministra.

## Respuestas y recuperación

| Resultado                                               | Comportamiento de front                                                                                                                    |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `202`                                                   | Conservar `operationId`, `pollPath`, clave, cuerpo y versión; consultar la operación. Aún no confirmar el rechazo de ingreso.              |
| `400 BFF.INVALID_REQUEST`                               | Corregir combinación, tipos o motivo. La solicitud inválida no crea operación.                                                             |
| `401` / `403`                                           | Recuperar sesión o informar falta de acceso; no volver a enviar automáticamente.                                                           |
| `503 BFF.WASH_UNCLASSIFIED_ENTRY_REJECTION_UNAVAILABLE` | Capacidad nueva deshabilitada; no se creó operación. No convertir el motivo a `false/false` ni hacer polling de una operación inexistente. |
| `409 BFF.IDEMPOTENCY_CONFLICT`                          | La clave corresponde a otra intención; reconciliar la solicitud previa antes de crear otra.                                                |

Después de `202`, consultar `OperationResponse.status`. `SUCCEEDED` significa que el owner aceptó el comando de rechazo: refrescar la lectura exacta de esa ejecución y comprobar `ENTRY_REJECTED` con versión posterior. Un `REJECTED` de operación significa que el owner rechazó **el comando**, no que se haya registrado el rechazo de ingreso; consultar `errorCode` en raíz. `FAILED`, `EXPIRED` o un timeout no prueban ausencia de efectos: conservar la referencia y reconciliar operación y ejecución antes de otro intento.

Tras recargar, recuperar la referencia guardada para la misma cuenta. Reintentar la misma intención conserva la misma clave y cuerpo; omisión y null son equivalentes, pero cambiar a booleanos clasificados no lo es. No hay recuperación garantizada de una operación si se perdió su identificador y la clave.

## Activación

Los lectores V2 y owner nullable ya están desplegados. La capacidad HTTP nueva usa `BFF_WASH_UNCLASSIFIED_ENTRY_REJECTION_ENABLED=false` por defecto. Activar primero `ESTOMA_UNCLASSIFIED_ENTRY_REJECTION_ENABLED` del owner y después el gate BFF; front cambia su envío después de confirmar ambos. Una operación rechazada cuando el owner estaba apagado conserva ese resultado al reutilizar su clave, incluso tras habilitarlo.

No se ha certificado todavía este recorrido contra el entorno con ambos gates habilitados. Las pruebas locales cubren validación HTTP, autorización, normalización y reintento PostgreSQL sin duplicar operación/outbox.
