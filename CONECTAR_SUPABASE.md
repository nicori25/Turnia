# Activar Supabase con el esquema real

Rama: `supabase-integration`. Pendiente de aplicar la migración en el proyecto
remoto y validar el recorrido real antes de activar el código en `main`.

## Aplicar la actualización

1. Abrir **SQL Editor → New query** en el proyecto Supabase correcto.
2. Revisar el respaldo del proyecto y copiar el archivo completo
   `supabase/migrations/20261119_organizaciones_profesionales.sql`.
3. Pulsar **Run** y comprobar que la transacción termine sin errores.

La migración anterior `20261119_reservas_persistentes.sql` fue reemplazada.
No ejecutarla, no borrar políticas y no ejecutar el esquema antiguo que crea
`barberos`. La actualización nueva solo agrega funciones RPC `turnia_v2_*` y
sus permisos de ejecución. No cambia tablas, registros, políticas existentes,
funciones de permisos, triggers de registro ni el bloqueo `turnia_sin_solapamiento`.

## Modelo utilizado

- La lista pública muestra organización y profesional activo. Los servicios
  pueden pertenecer a un profesional o ser compartidos por su organización.
- La solicitud comprueba que servicio y profesional pertenezcan a la misma
  organización. Guarda nombre del servicio, duración, precio del servidor y
  recargo VIP de $1.500. Vincula un cliente por organización y teléfono exacto;
  no modifica datos de un cliente existente desde el formulario público.
- El registro de cuentas y la asignación de perfiles/organizaciones continúan
  usando el mecanismo existente del proyecto. No se crean organizaciones ni
  se conceden roles automáticamente desde el frontend. Una cuenta sin perfil
  necesita que el responsable del proyecto la configure.
- La agenda RPC autentica mediante `auth.uid()`: `admin` accede a los turnos de
  su organización y `profesional` solo a los propios. El rol se lee de `perfiles`,
  nunca de datos elegidos por el usuario en el navegador.
- La consulta pública de disponibilidad devuelve solo horas bloqueadas. No
  devuelve nombres, teléfonos ni datos de reservas.

## Regla de ocupación existente

`turnia_sin_solapamiento` es una exclusión por `profesional_id` y el intervalo
`periodo`. Bloquea **pendientes y confirmados**. La app conserva esa regla:
una solicitud pendiente ya retiene la capacidad; cancelar la libera.

El intervalo se calcula con la fecha, hora y duración real del servicio. Un turno
largo puede bloquear también la siguiente hora de inicio. La restricción evita
solapamientos incluso ante operaciones concurrentes o escrituras fuera de la RPC.
Los otros profesionales y organizaciones conservan su disponibilidad independiente.

## Configuración y prueba remota

Mantener las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` del proyecto
correcto en Actions; nunca usar service_role. Configurar los retornos de Auth para
el sitio de GitHub Pages. Para verificar desde el chat, permitir el dominio del
proyecto en la red del entorno; la última consulta seguía bloqueada por el proxy.

Después del SQL, con cuentas de pruebas existentes:

1. Abrir la rama en un entorno de pruebas y elegir organización/profesional.
2. Solicitar un servicio para una fecha futura desde otro navegador o celular.
3. Comprobar que el horario pendiente ya está retenido y no se puede duplicar.
4. Iniciar sesión como profesional, abrir la fecha y confirmar o cancelar.
5. Recargar la agenda y comprobar persistencia. Cancelar libera el horario.
6. Comprobar que el administrador ve su organización y otro profesional no puede
   leer ni cambiar los turnos ajenos.
7. Tras validar, integrar en `main` y comprobar el despliegue.

No se incluyen pagos ni envío de notificaciones. Las consultas se actualizan cada
15 segundos y las operaciones siempre se validan en el servidor.

## Evidencia local

`npm test`: 5 pruebas de fechas/disponibilidad/normalización y 8 de PostgreSQL
embebido PGlite con `btree_gist`. La base de prueba reconstruye las tablas,
políticas y restricciones compartidas por el usuario. Se verifican permisos,
persistencia, clientes, idempotencia, exclusión por duración y preservación de
las políticas. No es una copia del proyecto remoto ni acredita sus triggers.

También pasó la compilación de Pages. El recorrido de interfaz se prueba con
respuestas simuladas en dos navegadores; la validación contra Supabase real
sigue pendiente. No se afirma que la conexión productiva ya esté activa.
