# Funciones de main adaptadas a App

La rama `App` usa Expo Router / React Native; se conserva su arquitectura y diseño.
No se copiaron componentes Vue ni se sustituyeron las funciones privadas del backend.

| Función de main | Implementación en App |
| --- | --- |
| Volver desde reserva | `app/reservar.jsx`, enlace Inicio existente. |
| Fecha y horario sin pasado | `src/domain/booking.js`, `app/reservar.jsx`; días rápidos y campo para otra fecha. |
| Bloqueo por profesional y duración | RPC de disponibilidad y reserva existentes; compatibilidad con RPC `turnia_v2_*` de main. |
| Persistencia y reintentos | `src/domain/reservations.js` y `src/domain/turnia.jsx`; se conserva el identificador de solicitud. |
| Alta y recuperación de cuenta | `src/domain/auth.jsx`, `src/components/auth-form.jsx`; prepara el perfil autenticado y muestra errores. |
| Agenda por fecha y permisos | `src/domain/agenda.jsx`; usa `turnia_v2_agenda` y conserva compatibilidad con `mi_agenda_turnia`. |
| Crear, leer, modificar, eliminar | `app/admin/panel.jsx`, `editar-turno.jsx`, `turno.jsx`; acciones visibles por registro y confirmación de eliminación. |
| Guardar sin bloqueo silencioso | `src/domain/appointment-validation.js`; valida al pulsar Guardar y explica qué corregir. |
| Reloj y disponibilidad actualizados | `src/domain/use-business-clock.js`; actualización cada 15 segundos solo con la pantalla enfocada. |
| Configuración pública | Se mantienen `.env` y variables `EXPO_PUBLIC_*` existentes de App; no se incorporan claves administrativas. |
| Despliegue | Se conserva `.github/workflows/deploy-pages.yml` para Expo y la rama App; se agregan tests previos. |

La gestión de servicios, la demo, las entregas y los recursos gráficos propios de
App se conservan. La demo sigue siendo una simulación identificada, distinta de
las operaciones de Supabase con cuenta real.

## Compatibilidad de Supabase

Se mantienen `catalogo_turnia`, `horarios_disponibles` y `reservar_turno_app` cuando
están disponibles. Solo ante una función inexistente se usan las RPC instaladas
para main (`turnia_v2_locales`, `turnia_v2_servicios`, `turnia_v2_ocupados`,
`turnia_v2_solicitar`). Un error de red o permiso no activa datos ficticios.
Las RPC autenticadas de alta y CRUD ya estaban incluidas en la migración de App.
No se agrega una migración ni se requiere repetir SQL por estos cambios.

## Verificación

- `npm test`: cinco casos locales de edición, mensajes, fechas y disponibilidad.
- `npx expo export --platform all`: generación de bundles web, Android e iOS.
- Recorrido en Chromium de la exportación web con API simulada: reserva con RPC
  de main, login, agenda por fecha, modificar con feedback y eliminar confirmando.
- No se ejecutaron pruebas en emuladores nativos ni se modificaron datos del
  proyecto Supabase real. La publicación del código no acredita por sí sola el
  resultado del despliegue de Pages.

## Botones y enlaces

El componente compartido de botones utiliza estilos planos para los enlaces
`Link asChild` de Expo. Así conserva fondo, borde, espaciado y tamaño táctil en
web. Incluye estados de foco, hover, pulsación y deshabilitado; los enlaces Volver
y las acciones secundarias también tienen una superficie visible. El panel usa
iconos para Nuevo, Ver, Modificar y Eliminar, con un estilo de peligro separado
para el borrado. No cambia las operaciones ni los permisos de la base.
