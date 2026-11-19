# Fechas y disponibilidad

Esta rama incorpora la integración persistente descrita en [Activar Supabase](CONECTAR_SUPABASE.md).
La sección siguiente describe la implementación anterior en memoria, conservada como referencia.

- El cliente elige servicio, fecha y horario. El cambio de fecha limpia la hora.
- El reloj y el día de referencia usan `America/Argentina/Buenos_Aires`, sin
  depender de la zona horaria del dispositivo. No se permiten fechas pasadas ni
  horas que ya comenzaron hoy. La pantalla actualiza su reloj cada 15 segundos;
  el envío vuelve a comprobar la hora actual.
- Al solicitar un turno, se incorpora a la agenda compartida en estado
  `pendiente`. La pantalla final informa que falta aceptación del barbero.
- Un turno `confirmado` bloquea esa combinación de fecha y hora. Los pendientes
  pueden competir por el mismo horario, pero solo uno puede confirmarse. La
  segunda aceptación se rechaza. Un cancelado libera el horario si aún es futuro.
- El panel permite elegir fecha; el detalle muestra la fecha y rechaza aceptar
  un turno vencido o en conflicto. Los cancelados tienen su etiqueta propia.
- El total VIP no cambia. No se envían notificaciones.

## Alcance

La agenda sigue siendo una demo reactiva en memoria: comparte cambios entre
pantallas de la misma sesión, pero no entre dispositivos, pestañas o recargas.
No es una protección de concurrencia de producción ni valida permisos de base
de datos. Para operar con clientes reales se necesita persistencia, una consulta
de disponibilidad sin datos personales y confirmación atómica autorizada en el
servidor. No se migró el proyecto Supabase ni se cambiaron sus políticas.

Los datos iniciales son turnos de ejemplo fechados en el día de apertura. Los
horarios son los seis bloques existentes; no se agregaron calendario de feriados,
horarios de apertura configurables ni múltiples barberos.

## Verificación

```bash
node tests/availability.test.js
```

Nueve pruebas cubren zona horaria, fechas inválidas y pasadas, horas transcurridas,
confirmación y conflicto, cancelación, validación al enviar e idempotencia del
envío. El workflow de Pages las ejecuta antes de compilar.

También se verificó en Chromium móvil el recorrido de solicitud, aceptación y
cancelación, la independencia entre fechas, la limpieza del horario, la recarga
del reloj al pasar de día y el vencimiento de una hora con el formulario abierto.
La sesión administrativa se simuló solo en memoria para probar la interfaz;
no se usaron cuentas ni datos remotos.
