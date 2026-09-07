# Documentación del frontend

| Necesidad                          | Referencia                              |
| ---------------------------------- | --------------------------------------- |
| Instalación y comandos             | [README](../README.md)                  |
| Límites técnicos                   | [Arquitectura](../ARCHITECTURE.md)      |
| Reglas obligatorias                | [Contratos](contracts/README.md)        |
| Despliegue, activación y evidencia | [Estado](integration/status.md)         |
| Conectar al BFF                    | [Entornos](integration/environments.md) |
| Explorar sin backend               | [Fixtures](testing/fixtures.md)         |
| Validación                         | [Pruebas](testing/validation.md)        |
| Capacidades futuras                | [Pendientes](pending/README.md)         |
| Fuentes originales                 | [Archivo](archive/README.md)            |
| Recursos visuales                  | [Diseño](design-assets.md)              |

## Mantenimiento

Cada regla tiene un documento responsable. Sustituir instrucciones obsoletas en lugar de añadir correcciones cronológicas; conservar su fuente en archivo. Los demás documentos enlazan a la regla.

Para cambiar un contrato, identificar fuente backend, versión, compatibilidad, activación y pruebas. Un mock o una propuesta no autoriza nuevas transiciones. Si OpenAPI y aclaraciones discrepan, registrar el pendiente antes de modificar el cliente.

No guardar credenciales, tokens ni datos personales reales. Un contrato confirmado no implica capacidad activada ni integración certificada.
