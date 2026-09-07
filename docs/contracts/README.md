# Contratos vigentes

Referencia wire: [OpenAPI BFF 9c6f418](bff-9c6f418.openapi.json). Backend reporta su descarga y comparación con el despliegue; esta reorganización no consultó el servicio remoto. Ver [estado de integración](../integration/status.md).

| Contrato                            | Alcance                                                  |
| ----------------------------------- | -------------------------------------------------------- |
| [Común](common.md)                  | BFF, versiones, idempotencia, operaciones y recuperación |
| [Autenticación](authentication.md)  | Sesión, permisos y sistema                               |
| [Agendamiento](booking.md)          | Disponibilidad, registro, Home, QR y cancelación         |
| [Ingreso](supervision-entry.md)     | Consulta, llegada explícita, aprobación y rechazo        |
| [Reasignaciones](reassignments.md)  | Candidatos, asignación y cancelación clínica             |
| [Salida](exit.md)                   | Materiales, revisión y cierre                            |
| [Lectura exacta](execution-read.md) | Identidad y comprobación histórica                       |

Los [ejemplos de ingreso](examples/supervisor-entry.examples.json) y [reasignación](examples/ejemplos-reasignaciones.json) son sintéticos. Las pruebas ejecutables usan fixtures propios en src, sin importar documentos.

El [cierre directo](../pending/direct-supervisor-exit.md) y el [directorio](../pending/supervisor-directory.md) todavía no son capacidades desplegadas. Snapshots anteriores en archivo no son referencias alternativas.
