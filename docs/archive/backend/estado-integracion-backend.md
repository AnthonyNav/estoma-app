> Archivo de trazabilidad: refleja el estado de su fecha original, no el estado vigente. Consultar el [índice actual](../../README.md).

# Preparación backend para integrar Lavado

Actualización: 7 de septiembre de 2026 UTC. Avance global estimado: **75%**, 25% pendiente. Estimación por entregables de servicios compartidos y Lavado, no cobertura ni certificación E2E. Jornadas/Prácticas como sistemas quedan fuera del alcance.

## 1. Contratos

| Entrega                  | Qué puede usar front                                                                                                                                           | Qué falta                                                                                                                                    |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Directorio manual        | Propuesta `/api/v1/wash/supervision/manual-appointments`; no es API disponible.                                                                                | Resolver visibilidad global o por clínica/sede, implementar filtros/paginación y selección exacta por cita; entregar contrato final y datos. |
| Rechazo con motivo libre | [Contrato](contrato-front-rechazo-ingreso.md), omisión/null de ambos checks equivale a verificaciones no evaluadas; false/false conserva significado negativo. | PR160 integrado y desplegado en BFF `dff3ea2`; pendiente habilitar después de owner/readers compatibles y certificar.                        |
| Consulta exacta          | [Contrato definitivo desplegado](contrato-front-lectura-exacta-supervisor.md), `GET /api/v1/wash/supervision/executions/{washExecutionId}`.                    | Certificar recorrido completo de salida/cierre con datos vigentes.                                                                           |

Los contratos identifican por separado estado de código, despliegue y activación. El OpenAPI vigente `bff-9c6f418.openapi.json` fue descargado del endpoint y comparado como JSON con el commit desplegado; el candidato PR160 queda histórico.

## 2. Llegada sin otra pantalla

[Aprobar/Rechazar con llegada explícita](contrato-front-llegada-explicita.md) documenta la secuencia soportada: si no existe ejecución, confirmar presencia mediante la acción del supervisor, registrar llegada, esperar operación y contexto actualizado, y después decidir con la versión leída. Son dos operaciones independientes con recibos y claves distintos. Consultar/seleccionar no registra presencia.

El rechazo también exige ejecución `PENDING_ENTRY`. Si el alumno está presente, puede encadenarse llegada → rechazo desde una sola acción explícita. Si está ausente, no registrar una llegada ficticia: no hay rechazo de ingreso previo a llegada implementado.

## 3. Revisión frontend

La revisión/corrección de solicitudes, respuestas, mocks, permisos, recuperación y pruebas corresponde al equipo frontend, conforme al acuerdo. No se preparan cambios de implementación ni propuestas de diseño visual desde backend.

## 4. Datos y acceso para validar

- **Entorno conocido:** BFF `http://127.0.0.1:18080` mediante túnel autorizado. OpenAPI en `/api/v1/openapi`. Angular4200 puede consumir `/api/v1` con proxy al túnel; el acceso desde la máquina de cada integrante todavía debe verificarse.
- **Últimas versiones observadas con réplicas disponibles:** BFF `9c6f418`, Wash Execution `7c837a6`, Appointments `efd426f`. PR160 integrado `dff3ea23`, rollout completo y OpenAPI coincidente verificados; capacidad nueva aún pendiente de habilitar.
- **Alumno/supervisor y citas reiniciables:** pendientes de preparar/entregar como escenario vigente; compartir credenciales sólo por el canal seguro acordado. Los ejemplos de contratos no acreditan datos provisionados.
- **QR vigente:** emisión/lectura implementadas, activación y prueba pendientes; no hay QR de prueba vigente certificado para entregar.
- **Prueba conjunta:** pendiente alumno → envío de salida → corrección supervisor → cierre → lectura exacta/Home → recursos liberados; debe incluir conflicto de versión, reintento y recuperación. El plan del runner, conflictos y cleanup ya está preparado; PR1 colección y assertions en implementación; PR2 fixture terminal/cleanup y runner pendientes, ejecución viva pendiente.

La existencia de endpoints y pruebas unitarias/integración locales no acredita el recorrido distribuido en el entorno de front. Todavía no puede marcarse la integración completa.

## Seguimiento backend

PR156 tiene revisión favorable condicionada a verificar integridad de proyecciones pendientes antes del despliegue automático. La consulta agregada está preparada y su autorización específica sigue pendiente. La corrección de liberación proyectada de recursos por cancelación está en [PR161](https://github.com/AnthonyNav/estoma-services/pull/161), ya integrado en `9c6f4189`, con 283 pruebas locales correctas y review favorable; ya desplegado con réplica disponible y OpenAPI comprobado; recuperación histórica separada; no altera las reglas de `PENDING_REASSIGNMENT`.
