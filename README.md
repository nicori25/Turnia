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

## Recorrido de demostración

1. Elegí un servicio, una fecha y un horario. La opción VIP agrega un recargo al precio de ejemplo.
2. Ingresá un nombre y un teléfono ficticios y confirmá la solicitud.
3. Entrá por **Soy el barbero → Entrar a la demo**. Si elegiste un día posterior, avanzá al día correspondiente en la agenda.
4. Abrí el turno para confirmarlo o cancelarlo.

Las reservas y los cambios de la demo viven en memoria. La agenda de prueba y el flujo del cliente se comparten en una misma sesión de la app. Al recargar, se restablecen los datos de ejemplo.

## Supabase

Para probar el registro, el inicio de sesión y la agenda real, copiá `.env.example` a `.env` y completá la URL del proyecto y la clave pública. La agenda usa el esquema existente de `supabase/schema.sql`. Registrá las URL de confirmación y redirección del entorno en Supabase si la confirmación por correo está habilitada. Todas las variables `EXPO_PUBLIC_*` se incluyen en el cliente. Usá únicamente la clave pública.

El flujo público de reservas sigue siendo de demostración aunque se configure el acceso real del barbero. La persistencia de nuevas reservas, el catálogo configurable y las reglas de disponibilidad del servidor se incorporarán al integrar ese módulo.

La documentación de la versión anterior está en [12-11](12-11/LEEME.md). Fotografía de referencia de [Halem Mumtaz Mahal en Pexels](https://www.pexels.com/photo/vintage-barbershop-interior-with-empty-chairs-34865582/).
