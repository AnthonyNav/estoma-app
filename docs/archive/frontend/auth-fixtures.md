> Archivo de trazabilidad: refleja el estado de su fecha original, no el estado vigente. Consultar el [índice actual](../../README.md).

# Autenticación V1 con fixtures

## Alcance

AUTH-01: selección de sistema, login, sesión en memoria, bootstrap `/me`, acceso permitido/denegado, renovación y logout. Incluye la transición requerida a AUTH-02 para completar un login con contraseña temporal. Recuperación AUTH-03, cambio voluntario AUTH-04 y funcionalidades de Lavado/Prácticas quedan fuera de esta entrega.

El diseño del login conserva un identificador único. El adaptador recorta espacios exteriores, clasifica dígitos ASCII como `MATRICULA` y otros valores como `USERNAME`. No cambia la contraseña, no agrega el sistema al request y no hace fallback entre tipos.

Fuentes: OpenAPI compartido por el usuario y aclaraciones verificadas del proveedor; `frontend-v1-contract-freeze.md`, ADR 0006, AUTH-01, AUTH-02 y `me-client-contract.md` del repositorio `estomatologia-platform-docs`. Esas aclaraciones resuelven las preguntas iniciales del análisis histórico de contratos.

## Cómo funciona la simulación

`pnpm start` usa el adaptador HTTP de autenticación real. Un interceptor exclusivo de desarrollo responde a login, `/me`, cambio obligatorio, refresh y logout utilizando `src/app/features/authentication/infrastructure/fixtures/auth-responses.json`.

No se hacen solicitudes al BFF para esas cinco operaciones. Los demás adaptadores mock del proyecto continúan igual. No se implementan owners ni se recalcula elegibilidad académica.

El JSON contiene respuestas públicas y escenarios que seleccionan una secuencia de respuestas por operación. Cada llamada tarda aproximadamente 450 ms. Cuando se agota una secuencia se repite su último elemento. Los tokens sintéticos y las fechas se materializan en memoria a partir de placeholders; no son credenciales válidas para el backend.

Las comprobaciones del interceptor detectan errores de método/body/bearer. No sustituyen un validador completo de OpenAPI ni reproducen políticas de contraseña del owner: aceptación o rechazo se eligen mediante el escenario.

## Probar manualmente

1. Abrir una URL de la tabla mediante navegación completa o recarga. El escenario se selecciona al crear el transporte y se conserva durante las transiciones internas.
2. Escribir `202257019` para alumno o `supervisor` para username y cualquier contraseña sintética no vacía. No introducir credenciales reales.
3. Para cambio obligatorio, usar por ejemplo `mi frase de prueba local`, con confirmación idéntica. El fixture de rechazo permite verificar validaciones del servidor simuladas.
4. Cambiar Lavado/Prácticas antes de enviar no borra campos. Tras autenticar, la contraseña se elimina y solo se conserva la intención de sistema.

Base: `http://localhost:4200/authentication/sign-in?authFixture=`.

| Valor                                                           | Resultado                                                                                     |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `normal`                                                        | Alumno con ambos sistemas. Es el escenario predeterminado.                                    |
| `wash-only`                                                     | Alumno con Lavado; seleccionar Prácticas devuelve «Acceso denegado» en login.                 |
| `practices-only`                                                | Alumno con Prácticas.                                                                         |
| `no-systems`                                                    | Vuelve al login con «Acceso denegado», elimina sesión local e intenta revocarla en el BFF.    |
| `supervisor`                                                    | Perfil de supervisor; entrada a la pantalla de supervisión existente.                         |
| `admin`                                                         | Perfil de administrador; confirmación de acceso sin desarrollar administración.               |
| `required-password`                                             | Contraseña temporal; cambio obligatorio antes de `/me`.                                       |
| `invalid-unknown`, `invalid-password`, `invalid-locked`         | El mismo error público de credenciales en los tres casos.                                     |
| `login-unavailable`, `login-offline`                            | Primer login falla; siguiente intento explícito funciona.                                     |
| `incomplete`                                                    | Respuesta 200 incompleta; no se crea sesión.                                                  |
| `profile-unavailable`, `profile-offline`                        | Primer `/me` falla; vuelve al login con el mensaje temporal. Permite iniciar sesión de nuevo. |
| `profile-forbidden`                                             | `/me` devuelve 403; elimina la sesión y muestra «Acceso denegado» en login.                   |
| `profile-expired`                                               | `/me` devuelve 401 y se limpia la sesión.                                                     |
| `password-rejected`, `password-offline`, `password-unavailable` | Primer cambio falla; segundo intento explícito funciona.                                      |
| `password-expired`                                              | Cambio devuelve 401 y regresa a login.                                                        |
| `refresh-soon`                                                  | Access inicial de 35 segundos; renovación automática unos 5 segundos después del login.       |
| `refresh-rejected`                                              | Access inicial de 35 segundos; renovación rechazada, sesión eliminada.                        |
| `refresh-unavailable`                                           | Access inicial de 35 segundos; primer refresh falla y se reintenta a los 15 segundos.         |
| `restricted-expiry`                                             | Sesión restringida de 12 segundos para comprobar expiración sin refresh.                      |
| `logout-unavailable`                                            | Logout falla; estado local eliminado y mensaje de fallo temporal.                             |
| `logout-expired`                                                | Logout devuelve 401; se considera que no hay sesión utilizable.                               |

Los tiempos acortados son exclusivos de los escenarios de prueba. El proveedor documenta access y sesión restringida de 15 minutos.

## Comportamiento de sesión

- Tokens y perfil viven solo en memoria; no se guardan en localStorage, sessionStorage, IndexedDB, cookies ni cache del service worker.
- Recargar o abrir otra pestaña empieza sin sesión. No hay restauración automática. Esta es la opción compatible con las reglas actuales del repositorio; una sesión durable requiere otra decisión de arquitectura.
- La sesión restringida no se renueva. Si se pierde, no se reconstruye; una contraseña temporal ya consumida requiere el procedimiento administrativo correspondiente. El fixture conserva el consumo durante su instancia, pero recargar reinicia los datos simulados.
- La renovación comienza 30 segundos antes de `exp`, comparte una única petición en curso y reemplaza ambos tokens conjuntamente. `expiresAt` de refresh se valida como vencimiento de sesión y no reemplaza `exp`.
- Un refresh rechazado elimina la sesión; uno temporalmente indisponible mantiene el estado y reintenta con espera. Las solicitudes protegidas con access expirado esperan una renovación válida antes de enviarse.
- Logout elimina inmediatamente el estado local. Las respuestas tardías de renovación/cambio no pueden restaurarlo. Un error de cierre remoto se informa sin afirmar revocación confirmada.
- Un 403 no dispara otro login ni refresh. Un 401 de una operación protegida termina la sesión; no se repite automáticamente la operación de negocio.
- El código de error y `traceId` se conservan; los mensajes públicos no revelan causas internas de bloqueo/inactividad.

## Navegación sin implementar otros flujos

Alumno con Lavado entra a `/wash/student`; supervisor con Lavado a `/wash/supervision`. Ambas rutas tienen guards de sesión y perfil. La integración posterior de sus DTO y recorridos se documenta en [booking-integration.md](booking-integration.md) y [supervision-integration.md](supervision-integration.md).

Prácticas y administración muestran una confirmación de contexto autenticado en `/authentication/context`. Esta pantalla no es un dashboard de negocio. El sistema se elige únicamente en el login. Para cambiarlo se debe cerrar sesión e iniciar de nuevo; `roleCode` no sustituye `availableSystemCodes`.

## Conectar solo autenticación al BFF

Preparación incluida:

```bash
pnpm start:auth
```

Este modo selecciona el mismo entorno de desarrollo pero omite el interceptor de fixtures de autenticación. `proxy.auth.json` envía `/api/v1` a `http://127.0.0.1:18084`. Los demás módulos conservan sus mocks; no quedan conectados por activar esta opción.

Antes de ejecutarlo debe estar disponible el túnel/endpoint acordado y deben provisionarse cuentas de prueba. No se abrió el túnel ni se contactó al backend en esta entrega.

Producción y staging tampoco incluyen el transporte de fixtures. No se modifica la selección de transporte mediante parámetros de URL en esos builds.

## Validación

Las pruebas unitarias cubren normalización/payload, campos incompletos, bearer limitado al BFF, errores públicos, preservación del sistema, cambio obligatorio, ausencia de sistemas, reintento de perfil, refresh compartido, expiración, respuestas tardías y logout.

La revisión en navegador usa los JSON reales de desarrollo. Los comandos estándar siguen siendo:

```bash
pnpm lint
pnpm test:ci
pnpm build
pnpm format:check
```

Resultado de esta entrega: 35 pruebas automatizadas aprobadas; compilaciones de producción y `auth-integration`, lint, formato y comprobación del diff aprobados. Se ejecutaron además recorridos en Chrome con los JSON de desarrollo para login, selección de sistema en login, cambio obligatorio, errores y reintentos, renovación automática, expiración y logout. Los bundles de producción e integración no contienen el transporte de fixtures.

Karma conserva avisos 404 de fuentes Manrope en el entorno de pruebas, ya presentes antes de estos cambios; no impidieron la suite. Estas verificaciones demuestran el funcionamiento con fixtures; la certificación contra el BFF y sus cuentas sigue pendiente de conexión.

Una respuesta `/me` válida con `availableSystemCodes: []` termina la sesión provisional y muestra únicamente «Acceso denegado» en el login. El BFF debe autenticar antes de entregar `/me`; el frontend no habilita un contexto para esa cuenta. Si la revocación remota falla, no restaura la sesión local ni cambia ese mensaje. Un 503 sigue siendo indisponibilidad temporal y permite reintentar.

## Mensajes de acceso acordados

El login muestra solo dos resultados de error: «Acceso denegado» para credenciales rechazadas, cuenta no habilitada, ausencia de sistemas o sistema elegido sin permiso; y «No fue posible acceder en este momento. Intenta nuevamente.» para fallos de red, servicio o respuestas inválidas. No se ofrece otro sistema cuando el elegido está denegado. Se descarta la sesión provisional y se intenta revocarla sin que un fallo de revocación cambie el rechazo mostrado. El fallo de `/me` durante login también descarta la sesión provisional; reintentar implica enviar de nuevo el formulario. Esta decisión de interfaz sustituye la alternativa de ofrecer otro sistema descrita en la aclaración inicial del contrato.

Las validaciones de campos obligatorios y de la nueva contraseña siguen perteneciendo a sus formularios.

## Correcciones posteriores a la revisión

El borrador de citas se limpia de forma síncrona al cerrar, expirar, denegar o sustituir una sesión: reglamento aceptado, campos, horario y operación pendiente. La renovación conserva el borrador de la misma sesión.

Las respuestas de `/me` de una sesión anterior se descartan sin modificar ni revocar la sesión nueva. La rotación de tokens no invalida una consulta de perfil pendiente de la misma sesión.

Se agregaron siete pruebas de regresión que fallaban antes de corregir estos casos. La suite actual tiene 42 pruebas aprobadas; lint, build de producción, formato y comprobación del diff aprobados. La conexión real al BFF sigue pendiente.

## Selección de sistema y encabezado

Por decisión posterior del usuario, las pantallas autenticadas no ofrecen cambio de sistema. `/authentication/access`, incluso con `?choose=1`, continúa al sistema elegido en el login. El contexto de Prácticas y administración tampoco muestra opciones para cambiar. Las rutas de Lavado comprueban, además del rol y acceso, que Lavado sea el sistema seleccionado. Esta restricción es de navegación del cliente; la autorización efectiva sigue perteneciendo al BFF.

Lavado utiliza un encabezado común con nombre, símbolo y cierre de sesión. El saludo y la identidad académica aparecen en el contenido del inicio del alumno. En el estado sin cita, la acción principal abre el reglamento para comenzar el registro.
