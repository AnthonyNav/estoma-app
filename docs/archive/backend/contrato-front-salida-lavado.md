> Archivo de trazabilidad: refleja el estado de su fecha original, no el estado vigente. Consultar el [índice actual](../../README.md).

# Contrato de frontend: registro, revisión y autorización de salida de Lavado

Nueva decisión de producto: el cierre directo desde `IN_PROGRESS` está autorizado y en implementación. Véase [cierre directo por supervisor](contrato-front-cierre-directo-supervisor.md). La exigencia `EXIT_SUBMITTED` descrita aquí sigue siendo el contrato desplegado hasta habilitar la ampliación; no basta retirar el guard del frontend.

Referencia de integración actualizada: BFF `9c6f418`, OpenAPI `bff-9c6f418.openapi.json` descargado y verificado contra el commit; Wash Execution `7c837a6`, Appointments `efd426f`. Las referencias `237f5c0` de este documento describen la incorporación original compatible de la lectura exacta. La habilitación de QR/rechazo libre y la prueba conjunta siguen pendientes.

Verificado contra BFF `237f5c07c1d23056d4529e7dcdf28ab841e39767` y Wash Execution desplegado `develop-7c837a6`, el 6 de septiembre de 2026. Estos endpoints están implementados; el recorrido completo todavía necesita una fixture vigente y certificación E2E. El QR público continúa como dependencia separada, integrado y desplegado mediante PR154, con activación apagada por defecto.

## Matriz de cierre de los seis puntos

| Punto                               | Respuesta verificable                                                                                                                                                                                                                                                                                                                                                                                                    | Pendiente o límite                                                                                                                                                                                                                                                                                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Fixtures, entrega segura y reset | Los ejemplos de este documento son sintéticos. Los runners existentes de ingreso y candidatos de reasignación tienen sus propios manifiestos privados y cleanup, pero no constituyen una fixture vigente del recorrido de salida.                                                                                                                                                                                        | Falta provisionar la fixture conjunta de salida, entregar sus referencias al consumidor por un canal seguro por confirmar y definir/verificar su reset. Este contrato no publica cuentas, tokens, IDs ni datos vigentes.                                                                                                                                   |
| 2. Entorno de integración           | BFF `76b44bdcdbade67202082795bf0c45535487a3bb` y Wash Execution `develop-c6eb2c2` estaban desplegados con una réplica lista cada uno (`1/1`) al verificarse este contrato. URL del BFF con el túnel autorizado abierto: `http://127.0.0.1:18080`; OpenAPI: `http://127.0.0.1:18080/api/v1/openapi`. Desde Angular usar `/api/v1` mediante su proxy. El túnel y acceso SSH/Tailscale se describen en el contrato general. | El acceso de red del equipo frontend debe estar provisionado. La disponibilidad de esos dos workloads no certifica el recorrido E2E ni el estado de todos los servicios dependientes.                                                                                                                                                                      |
| 3. Envío y cierre                   | `POST /api/v1/wash/executions/{washExecutionId}/exit` y `POST /api/v1/wash/executions/{washExecutionId}/complete` están implementados y no dependen de un feature flag.                                                                                                                                                                                                                                                  | Deben seguir tratándose como operaciones asíncronas: `202` no equivale a efecto aplicado y el consumidor espera `SUCCEEDED` más convergencia de lectura.                                                                                                                                                                                                   |
| 4. QR durante y después de salida   | El reader QR público está desplegado, pero `BFF_WASH_QR_ENABLED` no está definido y su valor predeterminado es `false`; por tanto permanece apagado. Cuando se active con sus prerrequisitos, una misma representación opaca identifica la cita mientras la ejecución pasa de `IN_PROGRESS` a `EXIT_SUBMITTED`; el frontend no la interpreta ni la reemplaza.                                                            | Al llegar la cita/ejecución a estado terminal, la proyección QR se invalida y se oculta. Según el orden de convergencia, un lookup posterior puede resultar `404` por mapping ya tombstoneado/ausente o `503` por contexto todavía contradictorio o no listo. No usar QR para confirmar históricamente el cierre.                                          |
| 5. Relectura exacta y directorio    | `GET /api/v1/wash/supervision/executions/{washExecutionId}` está desplegado en BFF `237f5c0`. Selecciona exactamente esa ejecución incluso de días anteriores y devuelve versiones, materiales originales/finales y asignaciones; no usa matrícula ni fallback. [Contrato completo](contrato-front-lectura-exacta-supervisor.md).                                                                                        | Falta la prueba conjunta autenticada con datos vigentes. El directorio manual y selección por `appointmentId` siguen pendientes de implementación y decisión de visibilidad global o por clínica/sede.                                                                                                                                                     |
| 6. Certificación conjunta           | Las suites de cada backend prueban sus invariantes, pero no existe evidencia conjunta del workflow completo de salida en el entorno compartido.                                                                                                                                                                                                                                                                          | Falta un runner/fixture aislado que cubra ingreso hasta `IN_PROGRESS`, envío, revisión, cierre, polling, convergencia de Home/cita, liberación y limpieza; su cleanup debe reconocer y retirar de forma segura estados `EXIT_SUBMITTED` y `COMPLETED`. También debe cubrir reintento idempotente, versión obsoleta, propiedad ajena y formulario inválido. |

QR de prueba: pendiente de generar con una fixture vigente; no se entrega un token ficticio como QR real. La búsqueda exige bearer de supervisor. Con capacidad habilitada y proyección lista, una representación desconocida o revocada devuelve `404 BFF.WASH_ENTRY_NOT_FOUND`; request con forma inválida devuelve `400 BFF.INVALID_REQUEST`. Con el gate apagado o contexto no disponible devuelve `503 BFF.PROJECTION_UNAVAILABLE`. No existe en este DTO un `expiresAt` del QR que frontend pueda calcular; usar el estado/acción actuales y la invalidación por backend.

La lectura histórica desplegada del punto 5 es la pieza backend disponible para que el supervisor pueda reconciliar el cierre sin depender de una selección activa que desaparece. No concede acceso histórico global: su autorización debe conservar el mismo rol y acceso activo a Lavado del supervisor, y la consulta exacta sólo puede devolver el agregado solicitado con su contexto proyectado. Implementar el directorio no sustituye esta garantía si el directorio excluye terminales.

## Flujo y permisos

1. El alumno consulta `GET /api/v1/wash/student/home`. Sólo una ejecución propia en `IN_PROGRESS` puede enviar su formulario de salida.
2. El alumno envía materiales y la versión de Wash Execution mediante `POST /api/v1/wash/executions/{washExecutionId}/exit`.
3. Espera la operación y vuelve a consultar Home. `EXIT_SUBMITTED` significa “formulario enviado, pendiente de revisión”; todavía no es salida autorizada y mantiene la asignación activa.
4. El supervisor autenticado con `SUPERVISOR_LAVADO` y acceso activo a Lavado realiza `POST /api/v1/wash/supervision/lookup`. La lectura recupera materiales enviados, ejecución y versión actual. No registrar nuevamente llegada.
5. Con ejecución `EXIT_SUBMITTED`, el supervisor revisa los valores, puede modificarlos y envía todos los materiales finales mediante `POST /api/v1/wash/executions/{washExecutionId}/complete`.
6. Espera `SUCCEEDED` y la convergencia de lecturas antes de mostrar la salida finalizada. Backend lleva la ejecución a `COMPLETED`, libera recursos e inicia limpieza cuando corresponde; la cita converge a `COMPLETED` mediante su propio evento.

El BFF y el owner comprueban que quien envía el formulario es el alumno dueño de esa ejecución. Para completar, backend exige supervisor autorizado. Identidades y horas se derivan del servidor, no se reciben del formulario.

## Formulario del alumno

Se envían cuatro cantidades enteras:

| Campo                       | Significado                      |
| --------------------------- | -------------------------------- |
| `packageCount`              | Paquetes.                        |
| `greenPaperCassette8Count`  | Papel verde para cassette de 8.  |
| `greenPaperCassette10Count` | Papel verde para cassette de 10. |
| `witnessTapePortionCount`   | Porciones de cinta testigo.      |

Cada valor debe ser mayor o igual a cero y al menos uno debe ser positivo. Enviar las cuatro claves explícitamente, incluyendo ceros; no enviar decimales, negativos ni cadenas. El contrato usa enteros de 32 bits; no hay un máximo de negocio menor definido. No aplicar reglas de materiales según tipo de cita que backend no haya establecido.

Bearer e `Idempotency-Key` son necesarios. `expectedVersion` es `appointment.washExecution.executionVersion` de Home (equivale al campo `version` de esa misma ejecución), nunca `appointmentVersion`.

```json
{
  "materials": {
    "packageCount": 2,
    "greenPaperCassette8Count": 1,
    "greenPaperCassette10Count": 0,
    "witnessTapePortionCount": 2
  },
  "expectedVersion": 2
}
```

El formulario completo en cero produce `400 BFF.INVALID_REQUEST` antes de aceptar el comando. El owner vuelve a validar cantidades, propiedad, versión, estado y consistencia de fechas. La hora de envío no puede ser anterior al inicio del lavado. No existe un mínimo de minutos de lavado ni una ventana de salida adicional implementada en este comando.

Tras enviar, conservar el borrador asociado a la intención y bloquear envíos nuevos mientras el resultado esté pendiente o ambiguo. Un `202` no permite mostrar autorización. Cuando converge `EXIT_SUBMITTED`, mostrar los valores enviados y espera de revisión. No hay un endpoint implementado para que el alumno sustituya el envío mientras permanece en `EXIT_SUBMITTED`.

## Revisión y corrección del supervisor

Lookup es lectura y no necesita `Idempotency-Key`. Por ahora puede usarse matrícula exacta; QR real depende de activar la emisión y lectura. La futura selección por `appointmentId` pertenece al directorio manual y no está disponible en el OpenAPI desplegado.

En lookup, los datos relevantes son:

- `washExecution.washExecutionId`, `washExecution.status`, `washExecution.executionVersion`;
- `washExecution.exitSubmittedAt` y `washExecution.submittedExitMaterials`;
- `activeResourceAssignment`, con cabina y tina actuales.

`nextAction=EXIT_REVIEW` también puede aparecer mientras la ejecución todavía está `IN_PROGRESS`. Por sí solo no habilita completar: exigir `washExecution.status=EXIT_SUBMITTED` y materiales enviados presentes. Si no se han enviado, indicar que falta el formulario del alumno. Si falta contexto obligatorio para un estado que debería tenerlo, backend devuelve `503 BFF.PROJECTION_UNAVAILABLE`; no precargar ceros para ocultarlo.

Precargar la edición desde `submittedExitMaterials`. El supervisor puede conservar, aumentar o disminuir cada cantidad, respetando las mismas validaciones. Enviar el objeto completo, no un PATCH ni diferencias:

```json
{
  "finalMaterials": {
    "packageCount": 2,
    "greenPaperCassette8Count": 1,
    "greenPaperCassette10Count": 1,
    "witnessTapePortionCount": 2
  },
  "expectedVersion": 3
}
```

Este POST **autoriza y completa** la salida al aplicarse. No existe otro booleano de aprobación ni un endpoint adicional para autorizar después. No envía las verificaciones de identidad/requisitos usadas en ingreso. La edición puede mantenerse como borrador local hasta confirmar; no hay guardado parcial de revisión en backend.

No hay endpoint de “rechazar salida”, devolver el formulario al alumno, reabrir un lavado completado o modificar materiales después de `COMPLETED`. Si se requiere ese flujo deberá acordarse aparte; no representarlo con el rechazo de ingreso ni con cancelación clínica.

## Operación, versiones y resultado final

Cada intención usa su propia `Idempotency-Key`. Reintentar la misma intención conserva clave, ruta y cuerpo, incluida la versión. El POST devuelve `operationId`, `status`, `pollPath` y `submittedAt`.

- Envío aplicado: operación `SUCCEEDED`, `data.status=EXIT_SUBMITTED`.
- Cierre aplicado: operación `SUCCEEDED`, `data.status=COMPLETED`.

No inferir la versión nueva a partir del Result: volver a leer. Aunque cada transición incrementa la versión de ejecución, puede haber otros cambios concurrentes. Las versiones de ejecución y cita son independientes.

Home del alumno expone al converger:

| Estado de ejecución | Datos esperados                                                                                                                                            |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `IN_PROGRESS`       | Asignación activa. Aún no hay envío de salida.                                                                                                             |
| `EXIT_SUBMITTED`    | `exitSubmittedAt`, `submittedExitMaterials`, asignación activa; pendiente supervisor.                                                                      |
| `COMPLETED`         | `completedAt`, `finalExitMaterials`, materiales enviados conservados, `activeResourceAssignment=null`, `lastResourceAssignment` con la última cabina/tina. |

Backend conserva los materiales originales en la proyección de lectura y los finales por separado; no usar el objeto final para reescribir lo enviado por el alumno en UI. La ejecución cerrada tiene `qrUsageContext=NONE`; no ofrecer otra revisión por el mismo QR.

El lookup de supervisor selecciona citas activas y tiene reglas de fallback por matrícula; no es un endpoint histórico exacto de ejecuciones completadas. Después del cierre puede dejar de devolver la cita o cambiar su acción. No exigir que devuelva siempre el DTO completo de `COMPLETED`, ni aceptar una cita diferente como confirmación del cierre. La operación confirma el comando; Home del alumno confirma su estado final. Para reconciliar esa misma ejecución, usar la lectura exacta por ID ya desplegada y documentada al final.

## Errores y recuperación

Separar rechazo HTTP del POST de rechazo del owner después de `202`:

| Situación                                                          | Respuesta / acción                                                                                                                                                                     |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cuerpo inválido, cantidades negativas/vacías o versión no positiva | `400 BFF.INVALID_REQUEST`; corregir antes de enviar.                                                                                                                                   |
| Sin sesión / sesión inválida                                       | `401 BFF.AUTHENTICATION_REQUIRED` o `BFF.AUTHENTICATION_INVALID`; recuperar sesión sin duplicar intención pendiente.                                                                   |
| Sin permisos o ejecución ajena                                     | `403 BFF.ACCESS_DENIED`; no reintentar automáticamente.                                                                                                                                |
| Misma clave con otra intención                                     | `409 BFF.IDEMPOTENCY_CONFLICT`; conservar la intención original y reconciliar.                                                                                                         |
| Proyección incompleta                                              | `503 BFF.PROJECTION_UNAVAILABLE`; esperar y refrescar. El handler genérico no garantiza `Retry-After`.                                                                                 |
| `VERSION_CONFLICT` en operación                                    | Refrescar ejecución y formulario; otra acción avanzó su estado. No sobrescribir la versión y reenviar sin confirmar una intención nueva.                                               |
| `INVALID_WASH_EXECUTION_STATUS` en operación                       | La ejecución ya no admite esa transición; reconsultar estado.                                                                                                                          |
| Materiales vacíos/negativos                                        | HTTP público: `400 BFF.INVALID_REQUEST`. `EMPTY_EXIT` / `INVALID_EXIT_VALUES` son validaciones internas durante el mapping; no prometerlas como `errorCode` de una operación aceptada. |
| `INVALID_EXIT` / `INVALID_COMPLETION`                              | Contexto o fechas incompatibles con la transición; no fabricar otra hora desde frontend.                                                                                               |
| `APPOINTMENT_CONTEXT_UNAVAILABLE`                                  | Falta contexto owner para validar el envío; esperar recuperación.                                                                                                                      |
| `ACTIVE_RESOURCE_ASSIGNMENT_NOT_FOUND`                             | El cierre no tiene asignación activa requerida; refrescar y reportar si persiste.                                                                                                      |

Los rechazos funcionales del owner están en `OperationResponse.errorCode` en raíz y la operación queda `REJECTED`; una entrada wire inválida anterior al caso de uso sigue otra ruta y no garantiza Result funcional. Una espera agotada, `FAILED` o `EXPIRED` no demuestra ausencia de efectos: conservar identificador y reconsultar operación/estado antes de permitir otro comando.

Para soportar recarga, persistir por cuenta el recibo mínimo y la intención exacta pendiente (operación, pollPath, clave, ejecución, cuerpo/versión). No guardar bearer ni QR con el recibo. No existe recuperación automática de todas las operaciones del usuario si se pierden las referencias. Recomendación de polling, no SLA: 1 segundo inicialmente, luego 2–5 segundos con backoff; respetar `Retry-After` cuando exista y suspender consultas de pantallas ocultas.

## OpenAPI, ejemplos y prueba de integración

El OpenAPI de BFF `76b44bdc` incluye `/exit`, `/complete`, DTO de materiales y Home actualizado con materiales finales. La copia antigua `bff-c7b84fd.openapi.json` de frontend está atrasada para Home; la copia nueva `bff-76b44bd.openapi.json` convive con las anteriores como referencia versionada. Su capacidad QR implementada (`x-provider-ready.QR=true`) no certifica activación: `x-provider-ready-by-default.QR=false` y los flags permanecen apagados por defecto.

Los cuerpos anteriores son ejemplos sintéticos, con versiones ilustrativas. Para certificar este recorrido falta preparar una cita vigente en `IN_PROGRESS`, alumno y supervisor sintéticos, asignación real y cleanup que admita `EXIT_SUBMITTED`/`COMPLETED`. La fixture histórica de ingreso no certifica este recorrido ni debe usarse sin extender sus verificaciones de limpieza.

Prueba requerida: enviar materiales del alumno → operación → Home/lookup `EXIT_SUBMITTED` → supervisor modifica una cantidad → completar → operación → Home con ambos objetos distintos, cierre de cita y liberación de asignación; incluir versión obsoleta, ejecución ajena, formulario vacío y reintento idempotente.

Fuentes de código: `WashHttpRequests`, `WashController`, `WashStudentQueryService`, `WashSupervisionQueryService`, `WashExecutionCommandService`, `WashExecution`, `ExitMaterials`, `ApiExceptionHandler` y `OperationResponse`.

## Lectura exacta desplegada

[PR159](https://github.com/AnthonyNav/estoma-services/pull/159) implementa `GET /api/v1/wash/supervision/executions/{washExecutionId}` para confirmar la misma atención tras el cierre, incluso de días anteriores. Consulte [su contrato](contrato-front-lectura-exacta-supervisor.md). Ya forma parte del OpenAPI desplegado `bff-237f5c0.openapi.json`; el snapshot candidato anterior se conserva para trazabilidad.
