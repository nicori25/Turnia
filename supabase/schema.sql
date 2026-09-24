-- ============================================================
-- Turnia — esquema de base de datos (Supabase / PostgreSQL)
-- Pegar y correr en el SQL Editor del proyecto de Supabase.
-- ============================================================

-- 1. Perfil del barbero -----------------------------------------------
-- El id es el mismo que el de auth.users (1 a 1 con la cuenta logueada).
create table public.barberos (
  id uuid primary key references auth.users(id) on delete cascade,
  business_name text not null,
  created_at timestamptz not null default now()
);

-- Cuando alguien se registra con supabase.auth.signUp, este trigger
-- crea automáticamente su fila en "barberos", usando el business_name
-- que mandamos en options.data al hacer signUp desde Register.vue.
create function public.handle_new_barbero()
returns trigger as $$
begin
  insert into public.barberos (id, business_name)
  values (new.id, new.raw_user_meta_data->>'business_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_barbero();

-- 2. Servicios que ofrece cada barbero ---------------------------------
create table public.servicios (
  id uuid primary key default gen_random_uuid(),
  barbero_id uuid not null references public.barberos(id) on delete cascade,
  nombre text not null,
  duracion_min integer not null,
  precio numeric(10, 2) not null
);

-- 3. Turnos reservados ---------------------------------------------------
create table public.turnos (
  id uuid primary key default gen_random_uuid(),
  barbero_id uuid not null references public.barberos(id) on delete cascade,
  servicio_id uuid references public.servicios(id),
  cliente_nombre text not null,
  cliente_telefono text not null,
  fecha date not null,
  hora time not null,
  vip boolean not null default false,
  precio_total numeric(10, 2) not null,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'confirmado', 'cancelado')),
  created_at timestamptz not null default now()
);

-- 4. Seguridad (Row Level Security) --------------------------------------
alter table public.barberos enable row level security;
alter table public.servicios enable row level security;
alter table public.turnos enable row level security;

-- Cada barbero ve y administra solo lo suyo.
create policy "El barbero ve su propio perfil"
  on public.barberos for select
  using (auth.uid() = id);

create policy "El barbero administra sus servicios"
  on public.servicios for all
  using (auth.uid() = barbero_id);

create policy "El barbero administra sus turnos"
  on public.turnos for all
  using (auth.uid() = barbero_id);

-- El cliente reserva sin cuenta, así que necesita permiso explícito
-- para ver servicios y crear turnos (pero no para leer ni editar turnos).
create policy "Cualquiera puede ver los servicios para elegir"
  on public.servicios for select
  using (true);

create policy "Cualquiera puede crear un turno"
  on public.turnos for insert
  with check (true);
