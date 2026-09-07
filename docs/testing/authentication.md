# Fixtures de autenticación

Sólo desarrollo, sin credenciales reales. Reglas en [autenticación](../contracts/authentication.md).

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
