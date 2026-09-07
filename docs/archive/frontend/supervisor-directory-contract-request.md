> Archivo de trazabilidad: refleja el estado de su fecha original, no el estado vigente. Consultar el [índice actual](../../README.md).

# Solicitud a backend: búsqueda manual de citas del supervisor

## Alcance

El supervisor necesita listar las citas de hoy con estado `SCHEDULED` o `IN_PROGRESS`, buscar por nombre o matrícula y seleccionar una para continuar la misma atención que inicia con QR. No basta el lookup por matrícula exacta ni los contadores de Home.

En el OpenAPI local `bff-c7b84fd.openapi.json` no hay una consulta pública que cubra ese listado. Lo siguiente es una **propuesta para acordar**, no un endpoint existente o certificado en runtime.

## Contrato solicitado

1. Una consulta autenticada del BFF para listar citas del supervisor, por ejemplo `GET /api/v1/wash/supervision/appointments`. Confirmar ruta definitiva y permisos `SUPERVISOR_LAVADO`, alcance por clínica/sede y restricciones de acceso.
2. Filtros: `serviceDate` (por defecto hoy según zona del servicio), estados `SCHEDULED` y `IN_PROGRESS`, búsqueda `query` por nombre/apellidos o matrícula. Definir coincidencia parcial, búsqueda sin distinción de mayúsculas/acentos, longitud mínima/máxima y tratamiento de espacios. La búsqueda debe cubrir todo el conjunto en backend, no solo la página cargada.
3. Paginación: tamaño máximo, cursor o número de página, indicador de siguiente página y total si puede garantizarse. Definir orden estable, por ejemplo inicio del horario + nombre + identificador, y comportamiento cuando cambia el estado entre páginas.
4. Por fila: `appointmentId`, `appointmentStatus`, `appointmentType`, alumno con `studentAccountId`, `displayName`, `studentEnrollment`, `currentSemester`; horario con identificador, `startsAt`, `endsAt`, `timezone`. Reutilizar nombres y enums del lookup existente. Si entrega `nextAction`, indicar que es orientativo y debe refrescarse al seleccionar.
5. Contexto de respuesta: `serviceDate`, `timezone` y fecha de actualización de la proyección. Para “Turno actual”, proporcionar su intervalo/identificador o una regla inequívoca: qué ocurre entre turnos, con turnos solapados y fuera de servicio. Aclarar si la lista incluye todo el día o únicamente el turno. La UI actual muestra fecha y horario por tarjeta, sin inventar un turno global.
6. Selección de fila: confirmar si basta el lookup existente por matrícula para recuperar exactamente esa cita. Si puede haber más de una cita del alumno el mismo día, necesitamos lookup por `appointmentId` o una regla explícita para resolverlo. Las versiones y acciones de llegada/decisión salen de esta lectura actualizada, nunca de la tarjeta.
7. Definir inclusión de ejecuciones `PENDING_ENTRY`, `PENDING_REASSIGNMENT` y `EXIT_SUBMITTED` bajo los dos estados de cita. Aclarar el significado de “Registradas” en Home frente al filtro del listado; no inferirlo como total histórico.
8. Respuestas de lista vacía, fecha inválida, búsqueda inválida, sesión expirada, acceso denegado, proyección no disponible y límite de peticiones. Confirmar `Retry-After`, frescura/eventual consistencia y frecuencia aconsejada de actualización.
9. Entregar OpenAPI actualizado, ejemplos sintéticos y datos provisionados para probar: ambos estados, nombres con acentos, varias páginas, matrícula parcial, cero coincidencias, cambio de estado durante selección y error temporal.

## Implementación disponible en front

Ruta `/wash/supervision/manual`, accesible desde Escanear QR y Home. Lista y filtros locales de demostración; al seleccionar se ejecuta el lookup ya contratado, sin enviar comandos de llegada o autorización.

El puerto `getDirectory()` devuelve por ahora filas internas basadas en `SupervisorEntryLookup`; esto permite reutilizar datos sintéticos y **no define el DTO público que backend debe implementar**. En HTTP no se llama a una ruta inventada: se informa que el listado no está disponible y se ofrece consulta por matrícula exacta.

Tres alumnos sintéticos: Ana (`201945678`, registrada e interactiva con el flujo de ingreso), Carlos (`201945679`, en proceso) y María (`201945680`, en proceso). Las dos últimas filas permiten revisar la atención en curso; la revisión de salida sigue siendo otro flujo. No se muestra una cabina inventada cuando la asignación es null. El resumen de Home contiene actividad sintética adicional y no debe usarse para certificar los totales de este listado de demostración.
