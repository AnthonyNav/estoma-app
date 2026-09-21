# Actualizaciones seguras del frontend

El contenedor estampa el commit en el bundle y en `ngsw.json`; el pie de página muestra la versión que está ejecutando la pestaña, no la del servidor.

- Se comprueba al estabilizar la aplicación, cada cinco minutos y al recuperar foco/conexión.
- Una actualización descargada muestra un aviso. También se reconoce si otra pestaña ya la descargó.
- Solo se recarga automáticamente en el acceso sin datos capturados ni trabajo pendiente, una vez por versión y pestaña.
- La actualización manual requiere estar en el acceso o en el inicio de alumno/supervisor, sin solicitudes HTTP, formularios modificados, confirmaciones abiertas, borrador de cita ni recibos durables pendientes.
- Se revalida la seguridad inmediatamente antes de recargar. No se borra almacenamiento ni se activa una versión parcialmente sobre una pantalla en curso.
- Si falla la descarga, no se presenta como una comprobación exitosa.

## Primera instalación

Una pestaña que todavía ejecuta una versión anterior a este mecanismo no puede recibir retroactivamente su código. Debe cargar esta versión una primera vez, cerrando y abriendo la aplicación después de terminar su trabajo. No se requiere borrar datos ni usar incógnito. Las siguientes publicaciones tendrán aviso y actualización controlada.

## Verificación

Las pruebas cubren versiones ya descargadas por otra pestaña, fallos de instalación, sesión irrecuperable, formularios, solicitudes en curso, borradores y los ocho almacenes de recibos. La compilación del contenedor exige un SHA completo en `VCS_REF`.

Las pantallas de cabinas/tinas y autorizaciones excepcionales comparten estilos operativos: paleta de supervisión, tipografía, tarjetas, botones, campos, estados y adaptación móvil. No cambia la autorización de acciones ni los contratos del backend.
