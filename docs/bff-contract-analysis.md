# Contrato BFF y revisión de flujos

> Este análisis registra la revisión inicial. Para el estado implementado de AUTH-01 y su transición obligatoria a AUTH-02, consultar [autenticación con fixtures](auth-fixtures.md). Las aclaraciones posteriores del proveedor y ADR 0006 resuelven la clasificación de login, los estados y la política de sesión descritos aquí como pendientes.

## Fuente y alcance

Referencia canónica: documento **Estoma Platform BFF API v1**, OpenAPI **3.1.1**, entregado por el usuario en esta conversación el 5 de septiembre de 2026. Su contrato prevalece sobre los adaptadores provisionales, los modelos locales y los mocks. Este archivo es un análisis derivado; no es una copia íntegra del JSON ni un esquema para generación de código.

El documento publica `GET /api/v1/openapi`. Para automatizar generación y detectar cambios falta incorporar una exportación íntegra versionada con su revisión o checksum. `info.version: v1` por sí solo no identifica una revisión inmutable. No se consultó un backend desplegado ni se verificó su correspondencia con el documento.

Base revisada: `origin/diseno-login`, commit `a5121c3`, en `feature/login-integration`. Esta entrega retira el entorno de Nix y documenta la integración; los adaptadores todavía conservan su comportamiento anterior.

## Inventario actual: 6 flujos iniciados

Se cuenta un flujo por resultado funcional. Los pasos de un formulario, el modal QR, el polling y las rutas técnicas no se cuentan como flujos independientes. Existen cuatro áreas funcionales implementadas: autenticación, inicio del alumno, registro de citas y supervisión de ingreso. Ninguno se declara integrado de extremo a extremo con el BFF por esta revisión.

| ID   | Flujo actual                                                      | Contrato que debe gobernarlo                                                                                                 | Estado                                                                                    |
| ---- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| F-01 | Iniciar sesión                                                    | `POST /api/v1/auth/login`, `GET /api/v1/me`                                                                                  | Piloto; falta sesión, perfil y navegación autenticada.                                    |
| F-02 | Consultar cita y estado del lavado del alumno, incluido QR        | `GET /api/v1/wash/student/home`                                                                                              | Pantalla y adaptador; faltan campos y manejo de respuestas parciales.                     |
| F-03 | Aceptar reglamento, capturar datos, consultar horarios y reservar | `GET /api/v1/wash/appointments/form-context`, `GET /api/v1/wash/appointments/availability`, `POST /api/v1/wash/appointments` | Flujo multipaso con mocks y polling; falta ajustar contrato y refresco de disponibilidad. |
| F-04 | Buscar al alumno/cita para supervisión                            | `POST /api/v1/wash/supervision/lookup`                                                                                       | Ruta y DTO locales incompatibles; matrícula disponible, QR no disponible en proveedor.    |
| F-05 | Registrar llegada                                                 | `POST /api/v1/wash/executions/arrivals`                                                                                      | Acción en pantalla de supervisión; ruta local incompatible.                               |
| F-06 | Autorizar o rechazar ingreso                                      | `POST /api/v1/wash/executions/{washExecutionId}/entry-decision`                                                              | Acción en pantalla de supervisión; ruta, cuerpo y lectura de versión requieren ajuste.    |

El enlace «Salir» solo navega al login y no cuenta como cierre de sesión implementado. `/home` es una pantalla técnica de la base del proyecto.

## Diferencias demostradas frente al código

### F-01: autenticación

- `http-authentication.adapter.ts` usa `/api/v1/session/login`; el contrato exige `/api/v1/auth/login`.
- El comando local contiene `identifier` y `password`; el contrato exige `loginType`, `loginIdentifier` y `password`, con `deviceName` opcional y nullable. `additionalProperties: false` impide enviar `identifier` como propiedad adicional.
- `Session` exige `expiresAt`, que no existe en la respuesta de login. El contrato devuelve propiedades opcionales y nullable: `accessToken`, `refreshToken`, `sessionId`, `accountId` y `authState`. Un HTTP 200, por sí solo, no demuestra que haya una sesión utilizable.
- El formulario dice «Correo electrónico», pero el alta administrativa permite `MATRICULA` y `USERNAME`. Login solo especifica un string no vacío: no confirma un modo `EMAIL` ni enumera todos los modos aceptados. No imponer validación de correo ni inventar un valor de `loginType`.
- Faltan consumo de `/me`, renovación, logout, cambio de contraseña, recuperación, almacenamiento de sesión en memoria y envío de bearer a las rutas correspondientes. La política del repositorio prohíbe guardar tokens en almacenamiento del navegador.
- No se conocen los valores de `authState`, cuándo debe pedirse cambio obligatorio de contraseña ni si ese estado permite `/me`. Hay que cerrar esa semántica antes de decidir las redirecciones.

### F-02: inicio del alumno

La ruta coincide. El modelo local omite `appointmentVersion`, `usesExceptionalAuthorization`, `studentCancellationAction` y `timeSlot.cancellationDeadlineAt`. Además, supone que `courseSection`, `timeSlot`, `instrumentCount`, `currentSemester` y otros campos siempre están disponibles, aunque el contrato permite ausencia o null en varios de ellos. `formatTimeSlot` accede directamente a `appointment.timeSlot.startsAt`.

Separar DTO de transporte y modelo de presentación, con comprobaciones explícitas. Respetar `qrUsageContext`; no deducir que cualquier representación QR sirve para cualquier etapa. El contrato de inicio y el de supervisión tienen estructuras distintas y no deben compartir directamente el mismo DTO.

### F-03: reserva

Las rutas, parámetros principales y envío de `Idempotency-Key` ya coinciden. El formulario debe tolerar contexto parcial: `student` y `availableCourseSections` son opcionales y nullable; las secciones también tienen propiedades opcionales y nullable.

Disponibilidad limita `instrumentCount` a 1–80; reserva declara solamente un entero positivo. Mantener el rango del flujo de disponibilidad y señalar esta asimetría para el proveedor, sin atribuir al POST una restricción que no declara.

Un `503` de disponibilidad significa que el snapshot se está refrescando y exige `Retry-After`. El interceptor actual pierde ese header. Conservarlo para reconsultar con espera, límite y cancelación; no presentar un error definitivo ni afirmar que no existen horarios.

`regulationAccepted` es obligatorio pero el esquema permite tanto true como false. La UI ya exige aceptación; la regla del servidor y cualquier versión del reglamento no están descritas en este documento.

### F-04 a F-06: supervisión

| Código actual                       | Contrato canónico                                   |
| ----------------------------------- | --------------------------------------------------- |
| `/wash/supervision/entry-lookup`    | `/wash/supervision/lookup`                          |
| `/wash/supervision/arrivals`        | `/wash/executions/arrivals`                         |
| `/wash/supervision/entry-decisions` | `/wash/executions/{washExecutionId}/entry-decision` |
| `student.fullName`                  | `student.displayName`                               |
| `appointment.timeSlot`              | `appointment.appointmentTimeSlot`                   |
| `appointment.courseSection`         | `appointment.courseSectionReference`                |
| `washExecution.version`             | `washExecution.executionVersion`                    |

El lookup incorpora `nextAction`, que debe gobernar las acciones disponibles junto con los datos requeridos. La página actual deduce acciones principalmente del estado de ejecución. Eliminar el fallback `execution.version ?? 1`: no inventar versiones para comandos concurrentes.

En la decisión, `washExecutionId` va en la ruta y debe retirarse del body, junto con la clave de idempotencia que va en el header. El cuerpo canónico no admite propiedades adicionales.

`x-provider-ready` declara `STUDENT_ENROLLMENT: true` y `QR: false`; la búsqueda QR devuelve 503. Los mocks actuales no deben hacer pasar esa funcionalidad por disponible en la integración real.

## Reglas transversales de integración

- Usar bearer JWT en las operaciones que lo declaran; no derivar permisos de los nombres de pantalla. `/me` entrega `roleCode` y `availableSystemCodes`, pero el contrato no enumera sus valores ni la matriz de permisos por endpoint.
- Enviar `Idempotency-Key` donde se exige. Conservar clave y payload para reintentar la misma intención; una intención modificada requiere otra clave. El contrato no documenta la retención ni las respuestas a colisiones de claves.
- Un `202` confirma recepción, no éxito del negocio. `AcceptedOperation` exige `operationId`, `status`, `pollPath` y `submittedAt`. El cliente debe conservar la operación para consultar su resultado, evitando repetir comandos tras una respuesta ambigua.
- El modelo local fija estados `PENDING | SUCCEEDED | REJECTED | FAILED | EXPIRED`, pero el contrato solo especifica strings para `status`; no confirma ese catálogo. El tracker actual termina ante cualquier estado distinto de `PENDING`. Hace falta documentar estados iniciales, transitorios y terminales antes de considerarlo compatible.
- El resultado canónico de operación usa `errorCode`, no `rejectionCode`, e incluye `data` sin forma definida. No tipar resultados de negocio inventados. El esquema permite omitir incluso `operationId` y `status` en la consulta, por lo que se necesita validación de respuesta.
- `/operations/{operationId}` no declara bearer en el documento. Confirmar su política de acceso, especialmente para recuperación pública de contraseña; no inferir de ello cómo autoriza el despliegue real.
- Conservar `Problem.code` y `Problem.traceId`, además de título, detalle y status. `ApplicationError` actualmente descarta ambos. Son necesarios para decisiones de UI por código y soporte técnico sin exponer secretos.
- Respetar ausencia frente a null y los cuerpos requeridos, incluidos los cuerpos vacíos `{}` de ciertas acciones administrativas. No tratar todos los POST como 202: autenticación y contraseñas temporales tienen respuestas 200.
- `expectedVersion` debe proceder del recurso consultado. Ante conflicto, refrescar y reevaluar la acción; no reintentar ciegamente con una versión nueva.
- Los campos enumerados en `x-server-derived-actor-fields` los aporta el servidor. No confundir al actor con los IDs de las personas/cuentas objetivo que sí exige el body.
- Mantener fechas civiles (`date`) separadas de instantes (`date-time`) y usar la zona horaria del servicio donde se proporciona. Las páginas actuales fijan `America/Mexico_City`.

## Capacidades del contrato todavía sin flujo completo en el front

Esta lista agrupa familias para planificar; no es un conteo de endpoints ni se suma al inventario de seis flujos implementados.

| Familia                            | Trabajo pendiente                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------- |
| Ciclo de sesión                    | Perfil `/me`, refresh, logout y acceso por sistema/rol.                                     |
| Contraseñas                        | Cambio personal, solicitud/validación/reset de recuperación.                                |
| Cancelación por alumno             | Acción según `studentCancellationAction`, versión y plazo.                                  |
| Autorizaciones excepcionales       | Otorgar y cancelar autorizaciones.                                                          |
| Salida de lavado                   | Capturar materiales del alumno, revisar y completar como supervisor.                        |
| Cancelación clínica                | Cancelar ejecución con submotivo y versión.                                                 |
| Reasignaciones                     | Listar pendientes y asignar cabina/tina.                                                    |
| Recursos operativos                | Inhabilitar y restaurar recursos.                                                           |
| Inicio de supervisor               | Resumen diario y pendientes.                                                                |
| Buzón                              | Resumen, mensajes paginados por cursor y registro de visita.                                |
| Jornadas                           | Consulta del listado público.                                                               |
| Administración de personas/cuentas | Altas, cambios, activación, desactivación, contraseñas temporales y revocación de sesiones. |
| Administración de permisos         | Rol y concesión, suspensión, revocación y restauración de accesos.                          |
| Administración académica           | Períodos, secciones, estudiantes, inscripciones e importaciones.                            |
| Administración de lavado           | Cabinas, tinas, calendarios, horarios y cierres administrativos.                            |
| Administración de comunicaciones   | Reintentos y resolución de entregas indeterminadas.                                         |

`/health`, `/version`, `/openapi` y polling son soporte técnico, no pantallas de negocio.

## Vacíos del contrato que no deben rellenarse con suposiciones

1. Catálogos y semántica de `loginType`, `authState`, estados de operaciones, roles, sistemas y códigos de error; rotación/reutilización de refresh tokens y comportamiento ante renovación concurrente.
2. No aparecen consultas administrativas para obtener listas, detalles y versiones, ni catálogos de recursos disponibles para reasignación. Tampoco aparece carga del archivo que produce `fileReference` para importaciones. Los comandos solos no resuelven estos formularios.
3. Jornadas representa `horaInicio` y `horaFin` como objetos sin propiedades, por lo que no define un formato utilizable para mostrar horas.
4. `student/home.appointment.pieceType` incluye null en `type`, pero lo excluye del `enum`. No asumir que nullable y enum se combinan como una unión: hay que corregir o aclarar esa contradicción con el proveedor.
5. Las restricciones condicionales no están formalizadas: por ejemplo, recurso requerido según `scope` en cierres, cabina/tina para inhabilitación, datos según tipo de lookup y contraseña actual según contexto del cambio.
6. La política de sesión tras recarga necesita definición compatible con la prohibición de browser storage. Este contrato entrega refresh token en JSON y no describe una sesión por cookie HttpOnly.

## Orden de revisión

Revisar F-01 primero, incluyendo el ciclo de sesión que necesitan los demás flujos; después F-02, F-03, F-04, F-05 y F-06. En cada revisión cerrar payload/DTO, estados y errores, permisos, experiencia de usuario y pruebas de contrato antes de avanzar. Incorporar nuevas familias en tareas separadas.

Esta revisión es estática sobre el contrato proporcionado y el código. Las pruebas previas de la rama validan comportamiento local; no prueban compatibilidad con estos DTO ni disponibilidad del BFF.
