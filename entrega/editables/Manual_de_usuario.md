---
title: "Turnia"
subtitle: "Manual de usuario · Cliente y personal"
lang: es-AR
date: "20 de noviembre de 2026"
---

# Abrir Turnia

En la web, abrí el sitio privado y completá el acceso al sitio si se solicita. Para Expo Go, descargá la rama `App`, abrí la carpeta que contiene `package.json` y ejecutá `npm ci` y luego `npm start`. Escaneá el QR con Expo Go compatible con SDK 58. La rama incluye el archivo `.env` con la configuración pública. [Web de Turnia](https://turnia-expo.independentbench4.chatgpt.site) · [Rama App](https://github.com/nicori25/Turnia/tree/App)

Si la conexión local al servidor Expo no funciona, usá `npm start -- --tunnel`. Dejá abierta la terminal mientras se usa Expo Go.

# Cliente

1. En el inicio, tocá **Reservar turno**. También podés empezar desde un servicio del catálogo.
2. En **Elegí tu turno**, seleccioná profesional, servicio, fecha y horario. El precio se muestra antes de continuar. **Prioridad VIP** es opcional y suma el recargo indicado.
3. Tocá **Continuar**. Revisá el resumen y completá tu nombre y teléfono.
4. Tocá **Confirmar turno**. Al aparecer **¡Solicitud guardada!**, guardá el código. El estado inicial es **Pendiente**, hasta que el personal confirme.
5. Para consultar una solicitud, indicá ese código al personal de la organización.

# Profesional o administrador

1. Abrí **Soy el barbero** e iniciá sesión con el correo y la contraseña de Turnia. Si se solicita validación de correo en un registro, seguí el mensaje de Supabase Auth.
2. En **Agenda de turnos**, navegá a la fecha buscada. Si la pantalla ya estaba abierta, tocá **Actualizar agenda**.
3. Abrí el turno para ver el código, el horario, el servicio, el profesional y el estado.
4. Tocá **Confirmar turno** para aceptar una solicitud pendiente.
5. Para cancelar un turno pendiente o confirmado, tocá **Cancelar turno** y después **Sí, cancelar turno**. La agenda registra el estado **Cancelado** y el horario vuelve a ofrecerse si sigue vigente y libre.
6. Tocá **Salir** al terminar en un dispositivo compartido.

En **Administrar servicios**, podés registrar nombre, duración y precio. También podés editar, pausar o reactivar servicios que tu rol permite gestionar. El administrador ve los turnos de su organización y el profesional los turnos asignados a él.

# Mensajes y acciones

| Qué aparece | Qué hacer |
|:--|:--|
| El horario ya no está disponible | Volvé a la selección y elegí un horario disponible. |
| Cambió el precio o el servicio | Volvé a los servicios y revisá el nuevo resumen. |
| Error de conexión al confirmar | Si estás en el mismo formulario, reintentá con los mismos datos antes de iniciar otra reserva. |
| El turno no aparece en agenda | Revisá fecha, rol y profesional, y usá **Actualizar agenda**. |
| Ingreso a la demo | Ese recorrido usa datos de ejemplo de la sesión. Para la prueba conectada, ingresá a la agenda con tu cuenta. |

# Prueba de la entrega en dos dispositivos

En el celular, usá Expo Go y reservá con un nombre de prueba. En el otro dispositivo, abrí la agenda de esa organización o profesional y verificá el código. Confirmá y luego cancelá el turno de prueba. Volvé al celular y consultá el horario. La prueba pasa si el código coincide, la agenda refleja los estados y el horario se libera. Si guardás evidencia, evitá incluir datos de clientes reales.
