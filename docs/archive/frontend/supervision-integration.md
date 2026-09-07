> Archivo de trazabilidad: refleja el estado de su fecha original, no el estado vigente. Consultar el [índice actual](../../README.md).

# Ingreso de alumnos · Supervisión

## Acceso temporal sin formulario de login

Con `pnpm start --host 127.0.0.1`, abrir directamente <http://127.0.0.1:4200/wash/supervision>. En desarrollo, `enableSupervisorPreview` crea una sesión simulada de supervisor y prepara la cita `201945678`; también funciona al recargar las rutas de supervisión. Los guards siguen validando el perfil. El login manual permanece disponible y los parámetros de fixtures explícitos tienen prioridad.

Para quitar el acceso directo, poner `enableSupervisorPreview: false` en `environment.development.ts`. Está desactivado en producción, staging y las configuraciones de integración HTTP.

## Revisar en local

Ejecutar `pnpm start --host 127.0.0.1` y abrir:

<http://127.0.0.1:4200/authentication/sign-in?authFixture=supervisor&washFixture=supervisor-entry>

Seleccionar Lavado ultrasónico, usuario `supervisor`, contraseña `demo-local`. El login abre `/wash/supervision`, con el resumen de hoy. Elegir **Buscar por matrícula** y consultar `201945678`. El parámetro `authFixture=supervisor` es necesario: el nombre de usuario por sí solo no cambia el perfil del mock.

Home de supervisión → QR o matrícula → consulta de cita → registrar llegada → seguimiento de operación → verificar identidad y EPP → confirmar autorización o rechazo → consultar resultado.

- Autorización: pulsar Aprobar ingreso confirma identidad y requisitos sin casillas; el resultado muestra la cabina y tina recibidas.
- Rechazo: escribir únicamente el motivo en el diálogo.
- El home abre `/wash/supervision/scan`, con cámara y búsqueda manual. La consulta alternativa de ingreso usa únicamente matrícula exacta; los QR se atienden desde el escáner. En demo puede usarse `ESTOMA-DEMO:NO-VALIDO-PARA-INGRESO`, sin validez real.

Cambiar `washFixture` en la URL y hacer una carga completa para reiniciar cada escenario:

| Escenario                 | Resultado                                                                 |
| ------------------------- | ------------------------------------------------------------------------- |
| `supervisor-entry`        | Llegada y autorización con recursos; también permite rechazar             |
| `supervisor-no-resources` | Autorización confirmada, pendiente de asignación                          |
| `supervisor-offline`      | Respuesta perdida tras aceptar cada comando; consultar reutiliza la clave |
| `supervisor-lag`          | Operación terminada antes de que la consulta refleje el cambio            |
| `supervisor-too-early`    | Llegada rechazada por ventana de tiempo                                   |
| `supervisor-pending`      | Operación pendiente; espera acotada y consulta manual                     |
| `supervisor-failed`       | Resultado incierto; conserva referencia y bloquea otra intención          |

La cita de demostración se genera para hoy y dentro de la ventana de llegada. La vista se adapta a móvil, tablet y escritorio; usa la paleta compartida, controles accesibles y movimiento reducido según la preferencia del dispositivo.

## Home del supervisor

`GET /api/v1/wash/supervision/home` alimenta los cinco contadores, `serviceDate` y el aviso de asignaciones pendientes. Los indicadores muestran un guion mientras no hay datos; un fallo conserva la última lectura y se reintenta automáticamente cada tres minutos, sin sustituirla por ceros. Los contadores no son enlaces a listados que aún no están contratados.

El botón QR abre el escáner con cámara tras permiso explícito, lectura local mediante jsQR y alternativa por matrícula. La búsqueda por matrícula es independiente. La atención conserva un enlace de regreso al home; las solicitudes pendientes se pueden retomar desde allí.

Gestión operativa contiene únicamente la tarjeta informativa de cabinas, marcada como “Próximamente”. Reasignaciones pendientes tiene una sección propia con contador, estado vacío y consulta por matrícula cuando hay alumnos esperando; la reasignación manual sigue pendiente. El home consulta al entrar y cada tres minutos, sin botón de actualización; el temporizador se cancela al salir de la pantalla o cerrar sesión. Los contadores de demo incluyen actividad sintética y reflejan los cambios de la cita de prueba.

## Integración con backend

`pnpm start:wash --host 127.0.0.1` activa los adaptadores HTTP, incluida supervisión, mediante `proxy.wash.json`. Requiere túnel al BFF y cuentas/datos aprovisionados. La revisión local no acredita una prueba contra backend remoto.

Referencias: sección 9 de `development/frontend-agendamiento-integracion.md`, OpenAPI `docs/contracts/bff-c7b84fd.openapi.json` y ejemplos sintéticos copiados en `docs/contracts/supervisor-entry.examples.json` desde `development/coordination/ejemplos-ingreso-lavado.json`. Los identificadores de estos ejemplos no son cuentas o citas provisionadas.

- Consulta: `POST /api/v1/wash/supervision/lookup`, por matrícula o QR; sin clave de idempotencia.
- Llegada: `POST /api/v1/wash/executions/arrivals`, con `appointmentId`.
- Decisión: `POST /api/v1/wash/executions/{id}/entry-decision`, usando `executionVersion` leído como `expectedVersion`.
- Los comandos incluyen `Idempotency-Key`. Un 202 inicia seguimiento; no confirma el resultado funcional.
- `SUCCEEDED` exige reconciliar la consulta antes de habilitar otra acción. El rechazo de ingreso es un resultado funcional exitoso, distinto de una operación `REJECTED`.
- `FAILED`, `EXPIRED`, desconexión y espera agotada conservan la referencia. Los reintentos reutilizan la misma intención, clave y operación.
- Los recibos se aíslan por cuenta y sobreviven a navegación y nueva sesión en la misma página. Son datos en memoria: una recarga completa los elimina. Recuperar operaciones pendientes después de recargar requiere persistencia adicional o soporte de recuperación del backend.

`PENDING_REASSIGNMENT` muestra espera y actualización del estado. La reasignación manual y la revisión de salida son recorridos posteriores. No se asignan recursos ficticios en modo HTTP. La consulta por QR real sigue dependiendo del proveedor pendiente indicado por backend; matrícula permite integrar este recorrido.

## Prueba de cámara por Wi-Fi

Servidor de prueba: `https://192.168.1.72:4443/wash/supervision/scan`. Preparación y QR sintético: `http://192.168.1.72:4301/`. Ambos deben abrirse desde la misma red local; no se creó un túnel público.

HTTPS con certificado confiable es necesario para `getUserMedia`. Se generó una CA temporal de siete días para este ensayo. Descargar `estoma-local.cer` desde el sitio de preparación e instalarla como CA en los ajustes de credenciales de Android. En iPhone, instalar el perfil y habilitar confianza SSL en Ajustes → General → Información → Ajustes de confianza de certificados. Eliminar “Estoma local camera testing” después de probar. No basta con usar HTTP en la IP de la computadora.

Referencias: [requisito de contexto seguro](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia), [certificados en Android](https://support.google.com/pixelphone/answer/2844832?hl=es), [confianza SSL en iOS](https://support.apple.com/en-us/102390).

Los certificados y sus claves están fuera del repositorio en `/tmp/estoma-camera-tls`; el servidor de archivos sirve únicamente `/tmp/estoma-camera-public`, que contiene el certificado público, instrucciones y QR sintético. Los procesos de prueba no sobreviven a un reinicio. Mientras los certificados sigan vigentes:

```sh
pnpm start --host 192.168.1.72 --port 4443 --ssl --ssl-key /tmp/estoma-camera-tls/server.key --ssl-cert /tmp/estoma-camera-tls/server.pem
python3 -m http.server 4301 --bind 192.168.1.72 --directory /tmp/estoma-camera-public
```

El escáner solicita cámara tras pulsar Activar cámara, prefiere la cámara trasera y utiliza `playsinline` para móvil. Lee fotogramas localmente, sin enviar ni guardar imágenes. El QR se trata como dato opaco para lookup; nunca se abre como URL. La cámara y el temporizador se detienen al leer un código, salir, cerrar sesión u ocultar la pestaña. Volver a la app requiere reactivarla. Se explican permisos denegados, cámara ausente/ocupada y contexto inseguro.

Se verificó lectura completa con una cámara simulada de Chromium y un QR sintético, validación TLS con la CA y tamaños de 320, 390, 768 y 1440 px. Esto no certifica el permiso, enfoque o rendimiento de cámaras físicas Android/iOS. El proveedor QR del backend sigue siendo una dependencia separada; este ensayo utiliza mocks.

### Continuar diseño en el equipo

La revisión de interfaz vuelve a `pnpm start --host 127.0.0.1 --port 4200`. Abrir `http://127.0.0.1:4200/wash/supervision/entry?method=qr`: esta ruta redirige al escáner `/wash/supervision/scan`. La lectura exitosa abre `/wash/supervision/entry` sin el criterio QR en la URL para mostrar el resultado sin volver al escáner. La búsqueda manual conserva esa misma ruta de atención. La cámara permanece apagada hasta pulsar Activar cámara.

Se retiró el padding del contenedor general únicamente para el escáner y se compactaron encabezado e instrucciones. El recuadro ajusta su tamaño a la altura disponible para dejar visible la alternativa manual en pantallas pequeñas.

## Directorio para búsqueda manual

`/wash/supervision/manual` lista citas registradas y en proceso, con filtros y búsqueda por nombre/matrícula sin acentos. Escáner y Home conducen a esta lista. La selección ejecuta el lookup de la matrícula y abre la atención actualizada; no registra llegada. La consulta exacta anterior permanece disponible como alternativa de integración HTTP mientras backend entrega el listado.

La lista usa fixtures locales; en integración HTTP informa indisponibilidad. La fecha y los horarios se muestran sin inventar “turno actual”. Ver [solicitud del contrato del directorio](supervisor-directory-contract-request.md).

## Verificar ingreso

La selección manual y el escáner abren un resumen con iniciales, nombre, matrícula, semestre, horario, tipo y cantidad de instrumentos. Materia y tipo de pieza quedan en detalles desplegables. El recordatorio visual usa el reglamento acordado: guantes de nitrilo industrial, calzado limpio y bata de bioseguridad, entre otros requisitos.

La llegada se registra automáticamente al abrir una cita elegible, una vez por cita durante la visita a la pantalla. El supervisor ve directamente Aprobar y Rechazar, deshabilitados hasta confirmar la llegada. Ante fallo conserva referencia o permite reintentar sin un bucle de comandos. El botón Aprobar ingreso envía `identityConfirmed=true` y `requirementsSatisfied=true`; no hay casillas ni un segundo diálogo de aprobación. El rechazo abre un panel inferior en móvil y un diálogo centrado en escritorio, con fondo oscurecido, Confirmar rechazo y Cancelar. Requiere únicamente motivo en texto libre (1–500 caracteres, sin aceptar solo espacios). El frontend envía `false/false` en las confirmaciones del rechazo, sin afirmar verificaciones positivas ni clasificar el motivo automáticamente. Esta convención mantiene el contrato actual; si backend usa estos booleanos como categorías estadísticas de incumplimiento, deberá distinguir verificación no confirmada de causa explícita. No se habilitan decisiones hasta reconciliar la llegada ni después de una atención terminal o en proceso. El seguimiento y la idempotencia anteriores se conservan.

Volver regresa al escáner si esa fue la entrada de navegación; en los demás casos, a búsqueda manual. La barra inferior permanece accesible al desplazarse; forma parte del documento para permitir leer el final del recordatorio.

## Limpieza de pantallas anteriores

Se conserva un único recorrido de supervisión: Home → escáner/directorio → atención. `entry?method=qr` solo redirige al escáner. El antiguo selector matrícula/QR se retiró; el formulario por matrícula exacta sigue siendo utilizado por el fallback HTTP del directorio, por consultas de reasignación y para recuperar una atención tras recargar. La página técnica inicial se eliminó; `/home` redirige al login. No se retiraron estados de error, seguimiento, sesiones restringidas ni adaptadores de integración: tienen usos activos aunque no aparezcan en el recorrido normal.

### Retiro definitivo de la búsqueda intermedia

La pantalla de atención ya no contiene formulario de matrícula ni “Localiza la cita de hoy”. Durante lookup muestra un estado de carga; ante error ofrece reconsultar o volver al origen. Abrir `/wash/supervision/entry` sin datos, consulta o solicitud pendiente redirige al directorio manual. La búsqueda manual es exclusivamente el directorio; hasta que backend provea su listado, el modo HTTP informa indisponibilidad y ofrece ir al escáner. Esta decisión reemplaza el fallback de matrícula exacta descrito en las notas anteriores.

## Ingreso aprobado y siguiente alumno

Tras reconciliar la operación y obtener `IN_PROGRESS`, la atención muestra una tarjeta única con alumno, matrícula, semestre, tipo, instrumentos y cabina/tina recibidas. No se muestra esta confirmación durante una operación pendiente. Si la asignación es null, se informa y se ofrece consultarla; no se inventa ubicación. `PENDING_REASSIGNMENT` mantiene su estado de espera separado.

Escanear siguiente alumno limpia el contexto anterior y navega al escáner sin activar automáticamente la cámara. Volver al inicio también limpia la selección. Ambas acciones se bloquean mientras haya una consulta o comando pendiente. La nueva tarjeta también representa correctamente las citas que ya estaban en proceso cuando se seleccionaron en el directorio.

## Reasignaciones: interfaz y contrato (6 de septiembre de 2026)

Ruta `/wash/supervision/reassignments`, enlazada desde el inicio del supervisor y desde ingreso pendiente de asignación. Conserva el orden del listado del BFF y muestra alumnos con proyecciones incompletas sin permitir seleccionarlos. Selección explícita de la pareja cabina/tina; recomendación del servidor sin preselección. Consulta cada 5 segundos mientras la pestaña está visible, con espera creciente y respeto de Retry-After ante fallos.

Se distingue `200` con candidatos vacíos de consulta no disponible (`503`): solo el primero permite abrir la cancelación por `CAPACITY_LOSS`, con motivo y confirmación. El backend vuelve a validar capacidad y versión al ejecutar. Las operaciones se siguen hasta un resultado terminal y se cotejan con lookup de la misma cita y ejecución, versión mayor y recursos seleccionados antes de mostrar éxito. Las referencias se conservan por cuenta en sessionStorage (sin tokens ni QR), incluyendo la intención exacta para repetir la misma clave si se pierde el 202. FAILED/EXPIRED conservan la referencia y bloquean nuevas solicitudes; no se inventa un resultado.

Fuentes: `development/coordination/contrato-front-reasignaciones.md` y `ejemplos-reasignaciones.json`. Adaptador HTTP separado mediante `REASSIGNMENT_GATEWAY`. El despliegue, flag de candidatos y prueba completa contra backend continúan pendientes de validación; la demostración local no certifica esas condiciones.

Demo local: Ana tiene dos alternativas; Carlos no tiene espacios. Su estado y las operaciones simuladas se conservan durante la pestaña. `?reassignmentDemo=unavailable` permite revisar el fallo de consulta; `?reassignmentDemo=empty` permite revisar ausencia de candidatos. Solo el adaptador mock consulta estos parámetros. Son ejemplos propios de reasignaciones; no modifican el recorrido simulado anterior de ingreso/agenda. Para reiniciar estos ejemplos se pueden eliminar `estoma.reassignment.demo.v1` y `estoma.reassignment.receipts.v1` del almacenamiento de sesión, únicamente cuando no haya una operación en seguimiento.

## Ajuste vigente: llegada explícita y rechazo libre

Consultar matrícula o QR no registra llegada. Aprobar ingreso o confirmar rechazo declara presencia física; el front encadena llegada confirmada, lectura de la misma cita en PENDING_ENTRY y decisión con la versión leída. Cada comando conserva una clave y recibo independientes en sessionStorage por cuenta; una recarga recupera el seguimiento. La confirmación de decisión usa lectura exacta por ejecución.

La aprobación envía ambas verificaciones en true. El rechazo libre omite ambas verificaciones y requiere motivo de 1 a 500 caracteres. Sigue deshabilitado para HTTP mediante enableUnclassifiedEntryRejection=false hasta confirmar despliegue y activación de ambos flags backend. El 503 BFF.WASH_UNCLASSIFIED_ENTRY_REJECTION_UNAVAILABLE no inicia polling ni se convierte en false/false. La demo permite explorar esta capacidad.

Estas reglas sustituyen cualquier descripción histórica de llegada automática al consultar. El contador registeredAppointments se muestra como «Citas del día» según su semántica contractual.
