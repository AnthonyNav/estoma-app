# Estado de integración

## Actualización de preparación del PR — 8 de septiembre de 2026

Backend reportó BFF `d05c0c6`, merges 156/166/167 y publicación privada de frontend `de47fda` por HTTPS. El snapshot [d05c0c6](../contracts/bff-d05c0c6.openapi.json) procede de la descarga aportada por backend; no se hizo otra consulta remota desde esta revisión. Sustituye a a44b8b5 como referencia wire. El runner terminal está integrado, pero esto no certifica una ejecución autenticada desde navegador.

Las correcciones del PR incorporan persistencia de reserva/cancelación, seguimiento de intentos ambiguos, reconciliación exacta y soporte de `canComplete`. La auditoría de backend se realizó sobre de47fda, que no incluía esas correcciones: requiere nueva imagen y comprobación de su versión antes de aceptación.

QR, candidatos, rechazo libre y cierre directo siguen requiriendo evidencia de activación. El rechazo libre continúa deshabilitado en la configuración HTTP del frontend; sus flags se compilan. El directorio por nombre/listado sigue sin contrato implementado; matrícula exacta permite probar el recorrido básico.

Preparar cuentas sintéticas, escenario vigente aislado, reserva del runner y auditoría/cleanup. Ante operaciones inciertas conservar referencias y solicitar reconciliación operativa. Recargar la misma pestaña se soporta; cerrar la pestaña o borrar almacenamiento no garantiza recuperación.

## Corte anterior (histórico)

Corte: 7 de septiembre de 2026 UTC. Fuente: [informe backend](../archive/backend/estado-integracion-backend.md). No se consultó el entorno remoto durante esta reorganización.

Backend verificó BFF a44b8b5 y Wash Execution e970420 con una réplica actualizada/disponible cada uno; OpenAPI descargado y comparado exactamente con PR164. Appointments efd426f es la última observación anterior, no revalidada en este corte. Réplicas disponibles y snapshot no certifican el recorrido distribuido.

| Capacidad                    | Contrato / despliegue reportado                      | Activación y evidencia pendiente                                        |
| ---------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------- |
| Autenticación y agendamiento | Endpoints disponibles                                | Cuentas/citas y prueba autenticada; tests/fixtures locales aprobados    |
| Llegada y aprobación         | Secuencia confirmada y disponible                    | Prueba real pendiente; claves distintas y recarga verificadas con mocks |
| Rechazo libre                | PR160 desplegado                                     | Activar owner y BFF; front HTTP permanece deshabilitado                 |
| QR                           | Implementado y desplegado                            | Activación y QR vigente certificado pendientes                          |
| Reasignación                 | Contrato y bridge desplegados                        | Activar candidatos; PR156 pendiente de integridad/despliegue y E2E      |
| Salida con envío previo      | /exit, /complete y lectura exacta disponibles        | Front habilita lectura exacta; runner/fixture conjunto pendiente        |
| Cancelación proyectada       | PR161 desplegado en 9c6f418                          | Nuevos eventos/redelivery original; no acredita reparación histórica    |
| Directorio                   | Propuesta, endpoint no disponible                    | Resolver visibilidad e implementar; nombre/listado sólo mock            |
| Cierre directo               | Código owner/BFF desplegado, canComplete en snapshot | Habilitación coordinada y smoke autenticado pendientes                  |

## Flags y orden

- Rechazo: primero ESTOMA_UNCLASSIFIED_ENTRY_REJECTION_ENABLED del owner, luego BFF_WASH_UNCLASSIFIED_ENTRY_REJECTION_ENABLED. Front enableUnclassifiedEntryRejection=false hasta confirmación.
- QR: BFF_WASH_QR_ENABLED pendiente de habilitar/certificar.
- Candidatos: BFF_WASH_REASSIGNMENT_CANDIDATES_ENABLED pendiente.
- Cierre directo: ESTOMA_DIRECT_SUPERVISOR_COMPLETION_ENABLED y BFF_WASH_DIRECT_SUPERVISOR_COMPLETION_ENABLED: código disponible, activación no certificada.
- enableSupervisorExecutionRead=true en front para lectura exacta desplegada.

Faltan cuentas sintéticas, citas vigentes reiniciables, acceso/flags y runner conjunto con conflictos, reintentos, recarga y cleanup. Ejemplos históricos no son datos provisionados.

Registrar evidencias con fecha, entorno, commits, flags, escenario, resultado y log sanitizado. Pruebas backend reportadas son distintas de las ejecutadas aquí. No usar porcentaje de avance como cobertura.
