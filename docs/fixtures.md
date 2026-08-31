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
3. Abre `http://localhost:4200/wash/supervision/entry`, busca la matrícula de prueba `201945678` y
   registra la llegada.
4. Vuelve a buscar, confirma identidad y requisitos, y autoriza o rechaza el ingreso.
5. Regresa a la vista del alumno para comprobar que el estado, el recurso o el motivo de rechazo se
   actualizaron.

También se puede buscar usando el QR que muestra la vista del alumno. La representación es opaca;
la pantalla de supervisión la envía al adapter y no intenta decodificarla en el navegador.

## Recorrer las demás experiencias de Lavado

Las rutas siguientes también usan fixtures contract-faithful en desarrollo:

| Experiencia               | Ruta                                           |
| ------------------------- | ---------------------------------------------- |
| Home del Supervisor       | `/wash/supervision`                            |
| Reasignaciones pendientes | `/wash/supervision/reassignments`              |
| Revisión de salida        | `/wash/supervision/exit`                       |
| Recursos operativos       | `/wash/supervision/resources`                  |
| Autorización excepcional  | `/wash/supervision/exceptional-authorizations` |
| Dashboard administrativo  | `/wash/admin`                                  |
| Operación semanal         | `/wash/admin/operation`                        |
| Recursos administrativos  | `/wash/admin/resources`                        |
| Supervisores              | `/wash/admin/supervisors`                      |

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
