# Turnia

Turnia es un prototipo de reservas de barbería, desarrollado con React Native y Expo SDK 58. La versión web y Expo Go usan las mismas pantallas.

## Probar la aplicación

Usá Node.js LTS compatible con Expo SDK 58 e instalá las dependencias.

```sh
npm ci
npm run web
```

Para abrir la app en un celular con Expo Go compatible con SDK 58, conectá ambos equipos a la misma red, ejecutá `npm start` y escaneá el QR de Expo. Si la red impide la conexión directa, podés probar `npm start -- --tunnel`.

```sh
npm run build:web
```

La compilación web se exporta a `dist/`. Para publicarla, el alojamiento debe servir los archivos HTML de cada ruta, incluidas `/admin/login` y `/admin/turno`.

## Recorrido de demostración sin Supabase

1. Elegí un servicio, una fecha y un horario. La opción VIP agrega un recargo al precio de ejemplo.
2. Ingresá un nombre y un teléfono ficticios y confirmá la solicitud.
3. Entrá por **Soy el barbero → Entrar a la demo**. Si elegiste un día posterior, avanzá al día correspondiente en la agenda.
4. Abrí el turno para confirmarlo o cancelarlo.

Las reservas y los cambios de la demo viven en memoria. La agenda de prueba y el flujo del cliente se comparten en una misma sesión de la app. Al recargar, se restablecen los datos de ejemplo.

## Reservas con Supabase

1. Prepará una instancia local con `supabase start` o vinculá la CLI al proyecto de Turnia y aplicá la migración de `supabase/migrations/` con `supabase db push`.
2. La rama `App` ya incluye la URL y la clave pública de Turnia en `.env`. Para usar otra instancia, copiá `.env.example` a `.env.local` y completá sus valores. En Expo Go, usá una URL que el teléfono pueda abrir.
3. Registrá una cuenta de barbero. Si está habilitada la confirmación por correo, configurá las URL de redirección en Supabase y validá la cuenta antes del primer ingreso.
4. Desde **Agenda de turnos → Administrar servicios**, cargá los servicios, sus duraciones y precios. Los servicios activos aparecen en el catálogo. Una vez hecha una reserva, abrí la fecha correspondiente en la agenda o usá **Actualizar agenda** si ya la tenías abierta.

Sin las variables de Supabase, la app abre la demostración local. Con las variables definidas, muestra el catálogo y la disponibilidad de la base configurada. Los turnos se ofrecen durante siete días en la zona horaria de Buenos Aires. Cada profesional tiene seis horarios diarios iniciales, configurables mediante `turnia_private.horarios`.

El cálculo del total, el recargo VIP y la detección de superposiciones se ejecutan en PostgreSQL. Una confirmación de cliente crea una solicitud pendiente con su código. El barbero puede confirmarla o cancelarla. La cancelación libera el horario.

La migración admite una base nueva y el esquema existente de organizaciones, perfiles, profesionales, servicios, clientes y turnos. Los servicios con profesional asignado se ofrecen con esa persona. Los servicios compartidos quedan disponibles para los profesionales activos de su organización. El administrador gestiona la agenda de su organización y un profesional gestiona su propia agenda. La edición del propio perfil queda limitada al nombre y teléfono. La versión Expo reserva mediante `reservar_turno_app`. La función anterior `reservar_turno` conserva su firma y permisos.

En un proyecto con datos, hacé un respaldo y ejecutá [la consulta de diagnóstico](supabase/preflight.sql) en el SQL Editor. Devuelve las políticas, los permisos y el conteo de turnos activos superpuestos, sin mostrar datos de clientes. Revisá ese resultado antes de aplicar la migración. Si usás el SQL Editor, ejecutá el archivo de migración completo en una transacción (`begin;` al principio y `commit;` al final). Verificá que el catálogo responda antes de compilar y publicar la web con las variables del proyecto. La migración conserva los registros y agrega la duración histórica a partir del servicio asociado, con 30 minutos cuando falta ese dato. La versión anterior de esta migración era un prototipo de una sola barbería. Si la instalaste en una instancia local descartable, reiniciá esa instancia antes de probar esta versión.

### Prueba de integración de reservas

Con una instancia local descartable iniciada, usá su clave pública. La prueba crea dos cuentas ficticias y sus servicios, prueba solicitudes simultáneas y verifica los permisos y la cancelación.

```sh
TURNIA_TEST_KEY=<clave-publica-local> node supabase/tests/reservas.mjs
```

La documentación de la versión anterior está en [12-11](12-11/LEEME.md). Fotografía de referencia de [Halem Mumtaz Mahal en Pexels](https://www.pexels.com/photo/vintage-barbershop-interior-with-empty-chairs-34865582/).
