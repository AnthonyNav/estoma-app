# Estado de integración

Corte: 7 de septiembre de 2026 UTC. Fuente: [informe backend](../archive/backend/estado-integracion-backend.md). No se consultó el entorno remoto durante esta reorganización.

Backend reporta BFF 9c6f418, Wash Execution 7c837a6 y Appointments efd426f desplegados y OpenAPI comparado. Réplicas disponibles y snapshot no certifican el recorrido distribuido.

| Capacidad                    | Contrato / despliegue reportado               | Activación y evidencia pendiente                                        |
| ---------------------------- | --------------------------------------------- | ----------------------------------------------------------------------- |
| Autenticación y agendamiento | Endpoints disponibles                         | Cuentas/citas y prueba autenticada; tests/fixtures locales aprobados    |
| Llegada y aprobación         | Secuencia confirmada y disponible             | Prueba real pendiente; claves distintas y recarga verificadas con mocks |
| Rechazo libre                | PR160 desplegado                              | Activar owner y BFF; front HTTP permanece deshabilitado                 |
| QR                           | Implementado y desplegado                     | Activación y QR vigente certificado pendientes                          |
| Reasignación                 | Contrato y bridge desplegados                 | Activar candidatos; PR156 pendiente de integridad/despliegue y E2E      |
| Salida con envío previo      | /exit, /complete y lectura exacta disponibles | Front habilita lectura exacta; runner/fixture conjunto pendiente        |
| Cancelación proyectada       | PR161 desplegado en 9c6f418                   | Nuevos eventos/redelivery original; no acredita reparación histórica    |
| Directorio                   | Propuesta, endpoint no disponible             | Resolver visibilidad e implementar; nombre/listado sólo mock            |
| Cierre directo               | Definición acordada, en implementación        | Futuro canComplete no está en snapshot; no desplegado                   |

## Flags y orden

- Rechazo: primero ESTOMA_UNCLASSIFIED_ENTRY_REJECTION_ENABLED del owner, luego BFF_WASH_UNCLASSIFIED_ENTRY_REJECTION_ENABLED. Front enableUnclassifiedEntryRejection=false hasta confirmación.
- QR: BFF_WASH_QR_ENABLED pendiente de habilitar/certificar.
- Candidatos: BFF_WASH_REASSIGNMENT_CANDIDATES_ENABLED pendiente.
- Cierre directo: ESTOMA_DIRECT_SUPERVISOR_COMPLETION_ENABLED y capacidad BFF futura; no disponibles.
- enableSupervisorExecutionRead=true en front para lectura exacta desplegada.

Faltan cuentas sintéticas, citas vigentes reiniciables, acceso/flags y runner conjunto con conflictos, reintentos, recarga y cleanup. Ejemplos históricos no son datos provisionados.

Registrar evidencias con fecha, entorno, commits, flags, escenario, resultado y log sanitizado. Pruebas backend reportadas son distintas de las ejecutadas aquí. No usar porcentaje de avance como cobertura.
