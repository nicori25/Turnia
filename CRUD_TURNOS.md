# CRUD de turnos en el panel

Cambio preparado en `crud-turnos`. Activar después de ejecutar en Supabase el
archivo completo `supabase/migrations/20261125_crud_turnos.sql` y comprobar que
termine correctamente. Agrega tres funciones y sus permisos de ejecución; no
modifica tablas, políticas ni los registros existentes al instalarse.

## Acciones

- **Crear:** `+ Nuevo turno` desde la agenda. Elegir profesional, servicio, fecha,
  hora, cliente, teléfono, estado y VIP; pulsar `Crear turno`.
- **Consultar:** la agenda muestra una fecha y permite abrir el detalle del turno.
- **Modificar:** abrir el detalle y pulsar `Modificar turno`. El formulario carga
  los datos y permite `Guardar cambios`. La agenda vuelve a la fecha resultante.
- **Eliminar:** abrir el detalle y pulsar `Eliminar turno`. Requiere confirmación
  explícita. Borra el turno de la base y libera su horario, sin borrar al cliente.
- **Cancelar:** sigue siendo una operación distinta: conserva el turno con estado
  cancelado. Puede utilizarse si interesa mantener el registro.

Las opciones del formulario vienen del servidor y se limitan al acceso de la
cuenta. El administrador opera sobre su organización; el profesional sobre los
turnos propios. Un profesional no puede reasignar un turno a otro trabajador.
El servidor comprueba estado, entradas, fechas, precios y duración; la exclusión
existente sigue evitando solapamientos pendientes o confirmados.

El precio se calcula según el catálogo y el recargo VIP de $1.500. La edición
recalcula el importe desde el catálogo: no incluye edición de precios manuales.
No se permite crear o reprogramar al pasado. En turnos históricos se admite
editar los datos del cliente conservando fecha, hora, profesional, servicio y
estado; un profesional o servicio inactivo debe revisarse con el administrador.

## Verificación

`npm test`: 23 comprobaciones locales (5 de frontend lógico y 18 con PostgreSQL
embebido), incluidas seis del CRUD: opciones autorizadas, creación idempotente,
edición, aislamiento, conflictos, eliminación y validaciones.

La compilación de Pages pasó. En Chromium móvil se recorrió crear, consultar,
modificar, recargar y eliminar con API simulada, incluyendo error de horario
ocupado y rechazo del diálogo de borrado. No se creó, modificó ni eliminó ningún
turno real durante estas pruebas. La migración y la validación remota quedan a
cargo del siguiente paso de activación.
