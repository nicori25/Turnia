-- También actualiza una base creada con el esquema del prototipo.
create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;
create schema if not exists turnia_private;
revoke all on schema turnia_private from public;

create table if not exists public.barberos (
  id uuid primary key references auth.users(id) on delete cascade,
  business_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.servicios (
  id uuid primary key default gen_random_uuid(),
  barbero_id uuid not null references public.barberos(id) on delete cascade,
  nombre text not null,
  duracion_min integer not null,
  precio numeric(10, 2) not null
);

alter table public.servicios
  add column activo boolean not null default true,
  add constraint servicio_nombre_valido check (char_length(btrim(nombre)) between 2 and 80) not valid,
  add constraint servicio_duracion_valida check (duracion_min between 1 and 240) not valid,
  add constraint servicio_precio_valido check (precio between 0 and 99998499.99) not valid;
create index servicios_barbero_idx on public.servicios (barbero_id);

create table if not exists public.turnos (
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

alter table public.turnos
  add column duracion_min integer,
  add column servicio_nombre text,
  add column solicitud_id uuid unique;

-- Los turnos anteriores no guardaban duración. Se recupera del servicio
-- vinculado o se usan 30 minutos cuando falta una duración válida.
update public.turnos as t set
  duracion_min = coalesce(
    (select s.duracion_min from public.servicios as s where s.id = t.servicio_id and s.duracion_min between 1 and 240),
    30
  ),
  servicio_nombre = coalesce(
    (select s.nombre from public.servicios as s where s.id = t.servicio_id),
    'Servicio'
  );

alter table public.turnos
  alter column duracion_min set not null,
  alter column servicio_nombre set not null,
  add constraint turno_duracion_valida check (duracion_min between 1 and 240),
  add column periodo tsrange generated always as (
    tsrange(fecha + hora, fecha + hora + make_interval(mins => duracion_min), '[)')
  ) stored;

-- Deja intactos los datos históricos si contienen solapamientos: la
-- migración falla y requiere revisar esos turnos antes de reejecutarla.
alter table public.turnos add constraint turnos_sin_solapamiento
  exclude using gist (barbero_id with =, periodo with &&)
  where (estado in ('pendiente', 'confirmado'));

create index turnos_barbero_fecha_hora_idx on public.turnos (barbero_id, fecha, hora);

create table turnia_private.horarios (
  barbero_id uuid not null references public.barberos(id) on delete cascade,
  hora time not null,
  primary key (barbero_id, hora),
  check (hora < time '24:00' and extract(second from hora) = 0)
);

create function turnia_private.horarios_iniciales(p_barbero_id uuid)
returns void language sql set search_path = '' as $$
  insert into turnia_private.horarios (barbero_id, hora)
  select p_barbero_id, unnest(array['10:00', '11:00', '12:30', '16:00', '17:30', '18:30']::time[])
  on conflict do nothing;
$$;

-- Recupera perfiles cuando se registraron cuentas antes de instalar el esquema.
insert into public.barberos (id, business_name)
select id, left(btrim(raw_user_meta_data ->> 'business_name'), 100)
from auth.users
where char_length(btrim(raw_user_meta_data ->> 'business_name')) >= 2
on conflict (id) do nothing;

select turnia_private.horarios_iniciales(id) from public.barberos;

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_barbero();
create function turnia_private.handle_new_barbero()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  nombre text := left(btrim(new.raw_user_meta_data ->> 'business_name'), 100);
begin
  if char_length(nombre) >= 2 then
    insert into public.barberos (id, business_name) values (new.id, nombre);
    perform turnia_private.horarios_iniciales(new.id);
  end if;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function turnia_private.handle_new_barbero();

alter table public.barberos enable row level security;
alter table public.servicios enable row level security;
alter table public.turnos enable row level security;
alter table turnia_private.horarios enable row level security;

drop policy if exists "El barbero ve su propio perfil" on public.barberos;
drop policy if exists "El barbero administra sus servicios" on public.servicios;
drop policy if exists "Cualquiera puede ver los servicios para elegir" on public.servicios;
drop policy if exists "El barbero administra sus turnos" on public.turnos;
drop policy if exists "Cualquiera puede crear un turno" on public.turnos;

revoke all on public.barberos, public.servicios, public.turnos from public, anon, authenticated;
grant select on public.barberos, public.servicios, public.turnos to authenticated;
grant insert (barbero_id, nombre, duracion_min, precio, activo), update (nombre, duracion_min, precio, activo)
  on public.servicios to authenticated;
grant update (estado) on public.turnos to authenticated;

create policy barbero_perfil_propio on public.barberos for select to authenticated
  using ((select auth.uid()) = id);
create policy servicios_propios on public.servicios for all to authenticated
  using ((select auth.uid()) = barbero_id)
  with check ((select auth.uid()) = barbero_id);
create policy turnos_propios on public.turnos for select to authenticated
  using ((select auth.uid()) = barbero_id);
create policy cambiar_estado_turno_propio on public.turnos for update to authenticated
  using ((select auth.uid()) = barbero_id and estado in ('pendiente', 'confirmado'))
  with check ((select auth.uid()) = barbero_id and estado in ('confirmado', 'cancelado'));

create function turnia_private.recargo_vip()
returns numeric language sql immutable set search_path = '' as $$ select 1500::numeric $$;

create function turnia_private.catalogo_turnia()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'fecha_local', (statement_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date,
    'recargo_vip', turnia_private.recargo_vip(),
    'servicios', coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'barbero_id', b.id, 'barberia', b.business_name,
      'nombre', s.nombre, 'duracion_min', s.duracion_min, 'precio', s.precio
    ) order by b.business_name, s.nombre, s.id), '[]'::jsonb)
  )
  from public.servicios as s join public.barberos as b on b.id = s.barbero_id
  where s.activo and s.duracion_min between 1 and 240 and s.precio between 0 and 99998499.99
    and char_length(btrim(s.nombre)) between 2 and 80;
$$;

create function turnia_private.horarios_disponibles(p_servicio_id uuid, p_fecha date)
returns setof time language sql stable security definer set search_path = '' as $$
  select h.hora
  from public.servicios as s
  join turnia_private.horarios as h on h.barbero_id = s.barbero_id
  cross join (select statement_timestamp() at time zone 'America/Argentina/Buenos_Aires' as ahora) as reloj
  where s.id = p_servicio_id and s.activo
    and s.duracion_min between 1 and 240 and s.precio between 0 and 99998499.99
    and char_length(btrim(s.nombre)) between 2 and 80
    and p_fecha between reloj.ahora::date and reloj.ahora::date + 6
    and p_fecha + h.hora > reloj.ahora
    and (p_fecha + h.hora + make_interval(mins => s.duracion_min))::date = p_fecha
    and not exists (
      select 1 from public.turnos as t
      where t.barbero_id = s.barbero_id and t.estado in ('pendiente', 'confirmado')
        and t.periodo && tsrange(p_fecha + h.hora, p_fecha + h.hora + make_interval(mins => s.duracion_min), '[)')
    )
  order by h.hora;
$$;

create function turnia_private.reservar_turno(
  p_solicitud_id uuid, p_servicio_id uuid, p_fecha date, p_hora time,
  p_vip boolean, p_cliente_nombre text, p_cliente_telefono text, p_precio_esperado numeric
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  servicio public.servicios%rowtype;
  turno public.turnos%rowtype;
  nombre text := btrim(p_cliente_nombre);
  telefono text := btrim(p_cliente_telefono);
  ahora timestamp := clock_timestamp() at time zone 'America/Argentina/Buenos_Aires';
  precio numeric;
begin
  if p_solicitud_id is null or p_servicio_id is null or p_fecha is null or p_hora is null or p_vip is null
    or nombre is null or char_length(nombre) not between 2 and 80
    or telefono is null or char_length(telefono) > 24 or telefono !~ '^[+0-9 ().-]+$'
    or char_length(regexp_replace(telefono, '[^0-9]', '', 'g')) not between 8 and 15 then
    raise exception 'DATOS_INVALIDOS' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_solicitud_id::text, 0));
  select * into turno from public.turnos where solicitud_id = p_solicitud_id;

  if found then
    if (turno.servicio_id, turno.fecha, turno.hora, turno.vip, turno.cliente_nombre, turno.cliente_telefono, turno.precio_total)
      is distinct from (p_servicio_id, p_fecha, p_hora, p_vip, nombre, telefono, p_precio_esperado) then
      raise exception 'SOLICITUD_INVALIDA' using errcode = '22023';
    end if;
  else
    select * into servicio from public.servicios where id = p_servicio_id and activo for share;
    if not found or servicio.duracion_min not between 1 and 240 or servicio.precio not between 0 and 99998499.99
      or char_length(btrim(servicio.nombre)) not between 2 and 80 then
      raise exception 'SERVICIO_NO_DISPONIBLE';
    end if;

    precio := servicio.precio + case when p_vip then turnia_private.recargo_vip() else 0 end;
    if p_precio_esperado is distinct from precio then
      raise exception 'PRECIO_CAMBIO';
    end if;

    if p_fecha not between ahora::date and ahora::date + 6 or p_fecha + p_hora <= ahora
      or (p_fecha + p_hora + make_interval(mins => servicio.duracion_min))::date <> p_fecha then
      raise exception 'HORARIO_NO_DISPONIBLE';
    end if;
    perform 1 from turnia_private.horarios where barbero_id = servicio.barbero_id and hora = p_hora for share;
    if not found then
      raise exception 'HORARIO_NO_DISPONIBLE';
    end if;

    -- Serializa las reservas del mismo barbero y día. La restricción
    -- de exclusión también protege contra escrituras fuera de esta RPC.
    perform pg_advisory_xact_lock(hashtext(servicio.barbero_id::text), p_fecha - date '2000-01-01');
    if p_fecha + p_hora <= (clock_timestamp() at time zone 'America/Argentina/Buenos_Aires') then
      raise exception 'HORARIO_NO_DISPONIBLE';
    end if;

    begin
      insert into public.turnos (
        barbero_id, servicio_id, cliente_nombre, cliente_telefono, fecha, hora, vip, precio_total,
        duracion_min, servicio_nombre, solicitud_id
      ) values (
        servicio.barbero_id, servicio.id, nombre, telefono, p_fecha, p_hora, p_vip, precio,
        servicio.duracion_min, servicio.nombre, p_solicitud_id
      ) returning * into turno;
    exception when exclusion_violation then
      raise exception 'HORARIO_NO_DISPONIBLE';
    end;
  end if;

  return jsonb_build_object(
    'id', turno.id, 'servicio', turno.servicio_nombre, 'fecha', turno.fecha, 'hora', turno.hora,
    'vip', turno.vip, 'precio_total', turno.precio_total, 'estado', turno.estado
  );
end;
$$;

-- La API expone funciones invoker. Las funciones con privilegios y la
-- tabla de horarios permanecen en un esquema que PostgREST no expone.
create function public.catalogo_turnia()
returns jsonb language sql stable set search_path = ''
return turnia_private.catalogo_turnia();

create function public.horarios_disponibles(p_servicio_id uuid, p_fecha date)
returns setof time language sql stable set search_path = ''
as $$ select * from turnia_private.horarios_disponibles(p_servicio_id, p_fecha) $$;

create function public.reservar_turno(
  p_solicitud_id uuid, p_servicio_id uuid, p_fecha date, p_hora time,
  p_vip boolean, p_cliente_nombre text, p_cliente_telefono text, p_precio_esperado numeric
)
returns jsonb language sql set search_path = ''
return turnia_private.reservar_turno(
  p_solicitud_id, p_servicio_id, p_fecha, p_hora, p_vip, p_cliente_nombre, p_cliente_telefono, p_precio_esperado
);

revoke execute on all functions in schema turnia_private from public, anon, authenticated;
revoke execute on function public.catalogo_turnia(), public.horarios_disponibles(uuid, date),
  public.reservar_turno(uuid, uuid, date, time, boolean, text, text, numeric) from public, anon, authenticated;
grant usage on schema turnia_private to anon, authenticated;
grant execute on function turnia_private.catalogo_turnia(), turnia_private.horarios_disponibles(uuid, date),
  turnia_private.reservar_turno(uuid, uuid, date, time, boolean, text, text, numeric),
  public.catalogo_turnia(), public.horarios_disponibles(uuid, date),
  public.reservar_turno(uuid, uuid, date, time, boolean, text, text, numeric) to anon, authenticated;

notify pgrst, 'reload schema';
