# Activar la integración de Supabase

La rama `supabase-integration` reemplaza el catálogo y los turnos en memoria por
consultas y operaciones reales en Supabase. La aplicación de `main` se mantiene
como está hasta completar la actualización de la base y la comprobación remota.

## 1. Aplicar la migración

En el proyecto correcto de Supabase:

1. Revisar un respaldo del proyecto antes de modificar el esquema o los permisos.
2. Abrir **SQL Editor → New query**.
3. Copiar el contenido completo de
   `supabase/migrations/20261119_reservas_persistentes.sql` y pulsar **Run**.
4. Comprobar que la transacción finalice sin errores.

No hace falta ejecutar `supabase/schema.sql` primero. La migración admite una
instalación vacía y el esquema anterior. No borra registros; si encuentra dos
turnos ya confirmados en el mismo horario o políticas personalizadas, aborta y
requiere revisar el conflicto. No eliminar reservas o políticas para forzarla.

Crea perfiles para las cuentas existentes y un catálogo inicial de Corte,
Barba y Corte + barba cuando el barbero no tiene servicios. No reemplaza sus
precios ni agrega clientes o turnos ficticios. Los registros nuevos reciben
perfil y catálogo mediante el trigger de registro.

## 2. Configuración

Mantener las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` del mismo
proyecto en Actions. Usar la clave pública anon; nunca service_role. Revisar en
Supabase Auth la URL del sitio y los retornos autorizados para GitHub Pages.

Para que el agente pueda verificar la conexión desde este chat, permitir el
dominio del proyecto Supabase en la red del entorno y guardar el cambio. En la
última comprobación el proxy seguía devolviendo 403. Eso es distinto de un fallo
de credenciales. No enviar contraseñas ni claves privadas por el chat.

## 3. Verificación remota y activación

Con una cuenta de pruebas autorizada:

1. Abrir la reserva y comprobar que aparecen la barbería y sus servicios reales.
2. En otro navegador o celular, enviar una solicitud para una fecha futura.
3. Iniciar sesión como propietario, abrir esa fecha y confirmar la solicitud.
4. Actualizar la disponibilidad del cliente: el horario debe aparecer ocupado.
5. Recargar la agenda: el turno debe conservarse. Cancelarlo debe liberar la hora.
6. Probar que otra cuenta no pueda leer ni modificar los turnos de ese propietario.
7. Cuando estas comprobaciones pasen, integrar esta rama en `main` y verificar
   el despliegue de Pages. La subida de la rama no publica la nueva versión.

La disponibilidad y la agenda se consultan cada 15 segundos mientras su pantalla
está abierta; también se verifican al enviar. La base impide dos confirmaciones
para un mismo barbero, fecha y hora aun cuando los clientes tengan datos antiguos.

## Seguridad y alcance

- La consulta pública solo devuelve locales, servicios y horas confirmadas.
  No revela nombres ni teléfonos de clientes.
- Los turnos se leen con la sesión del propietario y RLS. No hay claves de
  administrador en el frontend ni acceso directo de escritura a las tablas.
- Las solicitudes se crean mediante RPC con validación de fecha, hora, nombre,
  teléfono y precio calculado en el servidor. El recargo VIP permanece en $1.500.
- Una clave aleatoria por solicitud permite reintentar sin duplicar el mismo envío.
- Las confirmaciones usan un bloqueo transaccional por barbero y un índice único;
  los cancelados liberan el horario y los pendientes requieren aceptación.
- Se conservan los seis horarios actuales y servicios de hasta 60 minutos.
  No se implementan calendarios distintos por barbero, pagos o notificaciones.
- No hay respaldo silencioso con datos ficticios cuando falla Supabase: se muestra
  un mensaje y se impide enviar una reserva con disponibilidad desconocida.

## Pruebas realizadas

`npm test` ejecuta 5 pruebas de fechas, disponibilidad y normalización, y 9 pruebas
con PostgreSQL embebido PGlite: instalación y actualización repetibles, persistencia,
permisos, aislamiento, validación, idempotencia, aceptación/cancelación y unicidad.
También pasó la compilación de Pages.

En Chromium se verificaron dos contextos de navegador con respuestas de API
simuladas: catálogo, solicitud, login, agenda después de recargar, confirmación,
bloqueo en el otro navegador, cancelación y error de base sin disponibilidad falsa.
Estas pruebas no sustituyen la validación contra el proyecto Supabase real;
la migración remota y dicha validación siguen pendientes.
