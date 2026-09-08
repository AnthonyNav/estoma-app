# Autenticación y contexto

Fuentes: OpenAPI vigente y aclaraciones AUTH-01/AUTH-02, ADR 0006 y me-client-contract citadas en la [fuente original](../archive/frontend/auth-fixtures.md). Evidencia local en [validación](../testing/validation.md); integración conjunta pendiente.

- Recortar extremos del identificador: dígitos ASCII son MATRICULA; el resto USERNAME. No transformar contraseña ni intentar ambos tipos.
- Elegir sistema en login, sin agregarlo al request de autenticación. No ofrecer cambio de sistema desde Home.
- Leer /me tras autenticar; comprobar sesión, rol y acceso al sistema seleccionado. Sistemas vacíos no permiten entrar.
- Contraseña temporal exige cambio antes de acceso normal; no renovar sesión restringida.
- Tokens/perfil en memoria; recargar no restaura sesión real automáticamente. Preview automático sólo con mocks y configuración local.
- Renovación compartida; respuestas tardías no restauran sesiones cerradas/reemplazadas. No reenviar comandos automáticamente tras 401.
- Logout elimina estado local aun si falla la revocación. 403 no inicia otro login.
- Mensajes públicos: «Acceso denegado» para acceso rechazado; «No fue posible acceder en este momento. Intenta nuevamente.» para indisponibilidad.

Alumno entra a /wash/student; supervisor a /wash/supervision. Prácticas y administración sólo tienen confirmación de contexto.

Pruebas: auth-session.service.spec.ts y [fixtures](../testing/authentication.md).
