# Entornos

| Comando         | Autenticación                  | Lavado    | Proxy                             |
| --------------- | ------------------------------ | --------- | --------------------------------- |
| pnpm start      | HTTP interceptado con fixtures | Mocks     | Sin backend                       |
| pnpm start:auth | HTTP real                      | Mocks     | proxy.auth.json → 127.0.0.1:18084 |
| pnpm start:wash | HTTP real                      | HTTP real | proxy.wash.json → 127.0.0.1:18080 |

Staging/producción no habilitan previews; parámetros de fixtures no cambian esos builds. No incluir secretos en configuración.

Para integrar, disponer de túnel autorizado, cuentas y datos vigentes; verificar versiones/flags en [estado](status.md). Credenciales sólo por canal seguro.

La sesión real no se restaura al recargar; los recibos se retoman al autenticar la misma cuenta.

## Cámara

La cámara exige contexto seguro del navegador, independientemente de PWA. En el equipo usar localhost/127.0.0.1; teléfono requiere HTTPS confiable y conectividad. Certificados/puertos temporales de pruebas anteriores no son entorno estable.

El escáner solicita activación explícita y detiene pistas al salir/ocultarse. Front no puede conceder permisos mediante almacenamiento local.
