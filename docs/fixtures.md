# Guía de fixtures de frontend

Los fixtures permiten construir y revisar el flujo de Lavado Ultrasónico sin esperar a que el BFF
esté disponible. Simulan las mismas entradas, salidas y transiciones que consumen las páginas, por
lo que la interfaz no necesita ramas condicionales especiales para modo demo.

## Activarlos

El build de desarrollo ya usa los adapters mock mediante `environment.useMockApi`. Inicia la
aplicación con:

```bash
pnpm start
```

Abre `http://localhost:4200/wash/student`. No se requiere un servicio backend local.

Para ejecutar los 15 casos de uso cerrados desde una sola pantalla, abre
`http://localhost:4200/wash/fixtures`. Cada tarjeta reinicia el estado mock aplicable y lleva a
la pantalla inicial del recorrido. Los recorridos compartidos de Alumno/Supervisor conservan las
transiciones durante la navegación de la misma pestaña.

## Probar estados del alumno

El adapter de inicio acepta el parámetro de consulta `fixture` en la ruta del alumno. Por ejemplo:

```text
http://localhost:4200/wash/student?fixture=no-appointment
http://localhost:4200/wash/student?fixture=pending-entry
http://localhost:4200/wash/student?fixture=entry-rejected
```

Estados disponibles:

| Fixture                 | Escenario                                     |
| ----------------------- | --------------------------------------------- |
| `loading`               | Carga prolongada.                             |
| `no-appointment`        | Alumno sin cita; permite iniciar el registro. |
| `scheduled-no-qr`       | Cita programada sin código disponible.        |
| `scheduled-entry-qr`    | Cita programada con código de ingreso.        |
| `pending-entry`         | Llegada registrada, pendiente de validación.  |
| `pending-reassignment`  | Ingreso autorizado, pendiente de espacio.     |
| `in-progress`           | Lavado activo con recurso asignado.           |
| `exit-submitted`        | Salida enviada para revisión.                 |
| `completed`             | Atención finalizada.                          |
| `cancelled`             | Atención cancelada.                           |
| `missed`                | Inasistencia.                                 |
| `entry-rejected`        | Rechazo con motivo visible para el alumno.    |
| `temporary-unavailable` | Error temporal del servicio.                  |
| `forbidden`             | Usuario sin acceso al módulo.                 |
| `offline`               | Error de red.                                 |

El fixture sólo se aplica en la primera carga del `MockWashJourneyStore`. Para cambiar de escenario,
recarga la página con la nueva URL; una recarga completa reinicia el estado en memoria.

## Recorrer el flujo completo

El store mock se comparte entre alumno, registro y supervisión durante la sesión actual del
navegador. Esto permite validar la propagación de estados sin preparar datos manualmente:

1. Abre `http://localhost:4200/wash/student?fixture=no-appointment`.
2. Registra una cita desde Reglamento, Datos y Horario. La operación se resuelve después de dos
   consultas simuladas y el alumno vuelve a ver su cita con QR.
3. Abre `http://localhost:4200/wash/supervision/entry`, escanea el QR o abre
   `http://localhost:4200/wash/supervision/manual-search`. Selecciona una cita `Registrada` y
   registra la llegada.
4. Vuelve a buscar, confirma identidad y requisitos, y autoriza o rechaza el ingreso.
5. Regresa a la vista del alumno para comprobar que el estado, el recurso o el motivo de rechazo se
   actualizaron.

El escáner abre la cámara del dispositivo y entrega la representación QR como un valor opaco;
la pantalla de supervisión no inspecciona su contenido y la envía al adapter para validación.

La búsqueda manual muestra las citas accionables de la jornada con persona, datos de cita y badge
`Registrada` o `En proceso`. La selección entrega el contexto al flujo correspondiente.

## Recorrer las demás experiencias de Lavado

Las rutas siguientes también usan fixtures contract-faithful en desarrollo:

| Experiencia                | Ruta                                           |
| -------------------------- | ---------------------------------------------- |
| Home del Supervisor        | `/wash/supervision`                            |
| Búsqueda manual Supervisor | `/wash/supervision/manual-search`              |
| Reasignaciones pendientes  | `/wash/supervision/reassignments`              |
| Revisión de salida         | `/wash/supervision/exit`                       |
| Recursos operativos        | `/wash/supervision/resources`                  |
| Autorización excepcional   | `/wash/supervision/exceptional-authorizations` |
| Dashboard administrativo   | `/wash/admin`                                  |
| Operación semanal          | `/wash/admin/operation`                        |
| Recursos administrativos   | `/wash/admin/resources`                        |
| Supervisores               | `/wash/admin/supervisors`                      |

Los mocks preservan las distinciones del contrato: candidatos no reservan capacidad, una lista vacía
de candidatos es la única que habilita cancelación clínica por capacidad, la salida del alumno se
declara antes de su revisión, y recursos administrativos no son recursos operativos.

## Agregar o modificar un fixture

Los datos y transiciones viven en
`src/app/features/wash-student-home/infrastructure/mock/mock-wash-journey.store.ts`. Para añadir
un escenario:

1. Agrega el nombre al tipo `StudentHomeFixture`.
2. Construye el estado en `fixtureResult`, reutilizando `appointmentWith` y `execution` cuando
   corresponda.
3. Registra el nombre en `MockStudentWashHomeAdapter` para aceptarlo desde `?fixture=`.
4. Añade o actualiza una prueba en `mock-wash-journey.store.spec.ts` o en la página afectada.

No agregues datos mock directamente en componentes ni cambies sus contratos para un caso visual.
Los adapters mock implementan los mismos puertos que los adapters HTTP; así el cambio a backend no
requiere reescribir presentación ni casos de uso.

## Cuando el BFF esté listo

Conserva los modelos de dominio, puertos y casos de uso. Implementa o ajusta el adapter HTTP de la
feature y cambia `useMockApi` en la configuración de entorno correspondiente. Verifica después el
mismo flujo con:

```bash
pnpm lint
pnpm test:ci
pnpm build
```

Los mocks siguen siendo útiles para desarrollo local, pruebas de UI y reproducción rápida de estados
de error.
