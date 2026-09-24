# Turnia — pantallas del sistema

Prototipo de las pantallas de Turnia hecho con **Vue 3 + Vue Router + Vite**, usando Sass para los estilos.

## Cómo correrlo

```bash
npm install
cp .env.example .env   # completá con la URL y anon key de tu proyecto de Supabase
npm run dev
```

## Registro y login (Supabase Auth)

El barbero se registra y loguea con email y contraseña usando Supabase Auth (`src/store/auth.js`). El cliente **no** se registra — sigue reservando directo, sin cuenta.

- `/admin/registro` — alta de cuenta (`supabase.auth.signUp`)
- `/admin/login` — inicio de sesión (`supabase.auth.signInWithPassword`)
- `/admin/panel` y `/admin/turno/:id` están protegidas: si no hay sesión activa, el router redirige a `/admin/login`

Si en tu proyecto de Supabase está activada la confirmación por email (viene así por defecto), después de registrarse el usuario tiene que confirmar el mail antes de poder loguearse — la pantalla de registro ya avisa eso.

## Pantallas incluidas

**Vista cliente** (color teal)
- `/` — Inicio
- `/reservar` — Elegir servicio y horario (incluye la opción de turno VIP/prioritario)
- `/confirmar` — Confirmar datos
- `/confirmacion` — Confirmación

**Vista barbero** (color coral)
- `/admin/login` — Login
- `/admin/panel` — Panel de turnos del día
- `/admin/turno/:id` — Detalle de turno (confirmar o cancelar)

Los datos de turnos y de la reserva en curso viven en `src/store/` como estado reactivo en memoria (mock), listos para reemplazarse por las consultas a Supabase más adelante.
