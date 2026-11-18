-- Instala Turnia desde cero o amplía el esquema multi-organización existente.
create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;
create schema if not exists turnia_private;
revoke all on schema turnia_private from public;

create table if not exists public.organizaciones (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  slug text not null unique,
  telefono text,
  email text,
  created_at timestamptz not null default now()
);
create table if not exists public.perfiles (
  id uuid primary key references auth.users(id),
  organizacion_id uuid not null references public.organizaciones(id),
  nombre text not null,
  telefono text,
  rol text not null default 'admin' check (rol in ('admin', 'profesional')),
  created_at timestamptz not null default now()
);
create table if not exists public.profesionales (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references public.organizaciones(id),
  perfil_id uuid unique references public.perfiles(id),
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.servicios (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references public.organizaciones(id),
  profesional_id uuid references public.profesionales(id),
  nombre text not null,
  descripcion text,
  duracion_min integer not null check (duracion_min > 0),
  precio numeric not null check (precio >= 0),
  imagen_url text,
  imagen_ruta text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references public.organizaciones(id),
  nombre text not null,
  telefono text not null,
  email text,
  created_at timestamptz not null default now()
);
create table if not exists public.turnos (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references public.organizaciones(id),
  profesional_id uuid not null references public.profesionales(id),
  servicio_id uuid references public.servicios(id),
  servicio_nombre text not null,
  cliente_id uuid references public.clientes(id),
  cliente_nombre text not null,
  cliente_telefono text not null,
  fecha date not null,
  hora time not null,
  vip boolean not null default false,
  precio_total numeric not null check (precio_total >= 0),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'confirmado', 'cancelado')),
  created_at timestamptz not null default now()
);

-- La aplicación utiliza RPC específicas y no requiere grants directos sobre las tablas.
-- Se conservan las políticas existentes para otros consumidores.
alter table public.organizaciones enable row level security;
alter table public.perfiles enable row level security;
alter table public.profesionales enable row level security;
alter table public.servicios enable row level security;
alter table public.clientes enable row level security;
alter table public.turnos enable row level security;

-- La política de edición del propio perfil conserva los campos de
-- contacto. La identidad y el rol los administra el servidor.
revoke update on public.perfiles from public, anon, authenticated;
revoke update (id, organizacion_id, rol, created_at, nombre, telefono)
  on public.perfiles from public, anon, authenticated;
grant update (nombre, telefono) on public.perfiles to authenticated;

alter table public.turnos add column duracion_min integer,
  add column solicitud_id uuid unique;

update public.turnos as t set duracion_min = coalesce((
  select s.duracion_min from public.servicios as s
  where s.id = t.servicio_id and s.organizacion_id = t.organizacion_id
), 30);

-- Mantiene las inserciones de clientes anteriores que no envíen una duración.
create function turnia_private.completar_duracion()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.duracion_min is null then
    new.duracion_min := coalesce((
      select s.duracion_min from public.servicios as s
      where s.id = new.servicio_id and s.organizacion_id = new.organizacion_id
    ), 30);
  end if;
  return new;
end;
$$;
create trigger turnia_completar_duracion before insert on public.turnos
  for each row execute function turnia_private.completar_duracion();

alter table public.turnos
  alter column duracion_min set not null,
  add constraint turnia_duracion_positiva check (duracion_min > 0),
  add column periodo tsrange generated always as (
    tsrange(fecha + hora, fecha + hora + make_interval(mins => duracion_min), '[)')
  ) stored;

-- Si hay horarios activos superpuestos, la migración se revierte.
alter table public.turnos add constraint turnia_sin_solapamiento
  exclude using gist (profesional_id with =, periodo with &&)
  where (estado in ('pendiente', 'confirmado'));
create index turnia_agenda_idx on public.turnos (organizacion_id, fecha, hora);
create index turnia_servicios_organizacion_idx on public.servicios (organizacion_id, profesional_id);

-- Horarios iniciales de Turnia. Se usan si el profesional no tiene una
-- configuración propia en esta tabla. Un arreglo vacío cierra su agenda.
create table turnia_private.horarios (
  profesional_id uuid primary key references public.profesionales(id) on delete cascade,
  horas time[] not null
);
alter table turnia_private.horarios enable row level security;

create function turnia_private.recargo_vip()
returns numeric language sql immutable set search_path = '' as $$ select 1500::numeric $$;

create function turnia_private.horas_turnia(p_profesional_id uuid)
returns setof time language sql stable set search_path = '' as $$
  select distinct hora from unnest(coalesce(
    (select h.horas from turnia_private.horarios as h where h.profesional_id = p_profesional_id),
    array['10:00', '11:00', '12:30', '16:00', '17:30', '18:30']::time[]
  )) as hora where hora < time '24:00' and extract(second from hora) = 0;
$$;

create function turnia_private.catalogo_turnia()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'fecha_local', (statement_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date,
    'recargo_vip', turnia_private.recargo_vip(),
    'servicios', coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'profesional_id', p.id, 'profesional', p.nombre,
      'organizacion_id', o.id, 'organizacion', o.nombre,
      'nombre', s.nombre, 'descripcion', s.descripcion,
      'duracion_min', s.duracion_min, 'precio', round(s.precio, 2)
    ) order by o.nombre, p.nombre, s.nombre, s.id), '[]'::jsonb)
  )
  from public.servicios s
  join public.organizaciones o on o.id = s.organizacion_id
  join public.profesionales p on p.organizacion_id = s.organizacion_id and p.activo
    and (s.profesional_id is null or s.profesional_id = p.id)
  where s.activo and s.duracion_min between 1 and 240 and s.precio between 0 and 99998499.99
    and char_length(btrim(s.nombre)) between 2 and 80;
$$;

create function turnia_private.horarios_disponibles(p_servicio_id uuid, p_profesional_id uuid, p_fecha date)
returns setof time language sql stable security definer set search_path = '' as $$
  select h.hora
  from public.servicios s
  join public.profesionales p on p.id = p_profesional_id and p.organizacion_id = s.organizacion_id
  cross join turnia_private.horas_turnia(p.id) as h(hora)
  cross join (select statement_timestamp() at time zone 'America/Argentina/Buenos_Aires' as ahora) r
  where s.id = p_servicio_id and s.activo and p.activo
    and (s.profesional_id is null or s.profesional_id = p.id)
    and s.duracion_min between 1 and 240 and s.precio between 0 and 99998499.99
    and char_length(btrim(s.nombre)) between 2 and 80
    and p_fecha between r.ahora::date and r.ahora::date + 6
    and p_fecha + h.hora > r.ahora
    and (p_fecha + h.hora + make_interval(mins => s.duracion_min))::date = p_fecha
    and not exists (
      select 1 from public.turnos t where t.profesional_id = p.id
        and t.estado in ('pendiente', 'confirmado')
        and t.periodo && tsrange(p_fecha + h.hora, p_fecha + h.hora + make_interval(mins => s.duracion_min), '[)')
    )
  order by h.hora;
$$;

create function turnia_private.reservar_turno(
  p_solicitud_id uuid, p_servicio_id uuid, p_profesional_id uuid, p_fecha date, p_hora time,
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
  if p_solicitud_id is null or p_servicio_id is null or p_profesional_id is null or p_fecha is null or p_hora is null
    or p_vip is null or nombre is null or char_length(nombre) not between 2 and 80
    or telefono is null or char_length(telefono) > 24 or telefono !~ '^[+0-9 ().-]+$'
    or char_length(regexp_replace(telefono, '[^0-9]', '', 'g')) not between 8 and 15 then
    raise exception 'DATOS_INVALIDOS' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_solicitud_id::text, 0));
  select * into turno from public.turnos where solicitud_id = p_solicitud_id;
  if found then
    if (turno.servicio_id, turno.profesional_id, turno.fecha, turno.hora, turno.vip,
        turno.cliente_nombre, turno.cliente_telefono, turno.precio_total)
      is distinct from (p_servicio_id, p_profesional_id, p_fecha, p_hora, p_vip, nombre, telefono, p_precio_esperado) then
      raise exception 'SOLICITUD_INVALIDA' using errcode = '22023';
    end if;
  else
    select s.* into servicio from public.servicios s
    join public.profesionales p on p.id = p_profesional_id and p.organizacion_id = s.organizacion_id
    where s.id = p_servicio_id and s.activo and p.activo
      and (s.profesional_id is null or s.profesional_id = p.id)
      and s.duracion_min between 1 and 240 and s.precio between 0 and 99998499.99
      and char_length(btrim(s.nombre)) between 2 and 80
    for share of s, p;
    if not found then raise exception 'SERVICIO_NO_DISPONIBLE'; end if;

    precio := round(servicio.precio, 2) + case when p_vip then turnia_private.recargo_vip() else 0 end;
    if p_precio_esperado is distinct from precio then raise exception 'PRECIO_CAMBIO'; end if;
    if p_fecha not between ahora::date and ahora::date + 6
      or (p_fecha + p_hora + make_interval(mins => servicio.duracion_min))::date <> p_fecha then
      raise exception 'HORARIO_NO_DISPONIBLE';
    end if;
    perform pg_advisory_xact_lock(hashtext(p_profesional_id::text), p_fecha - date '2000-01-01');
    if p_fecha + p_hora <= (clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')
      or not exists (select 1 from turnia_private.horas_turnia(p_profesional_id) as h(hora) where h.hora = p_hora) then
      raise exception 'HORARIO_NO_DISPONIBLE';
    end if;

    begin
      insert into public.turnos (
        organizacion_id, profesional_id, servicio_id, cliente_nombre, cliente_telefono, fecha, hora,
        vip, precio_total, duracion_min, servicio_nombre, solicitud_id
      ) values (
        servicio.organizacion_id, p_profesional_id, servicio.id, nombre, telefono, p_fecha, p_hora,
        p_vip, precio, servicio.duracion_min, servicio.nombre, p_solicitud_id
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

create function turnia_private.puede_gestionar(p_organizacion uuid, p_profesional uuid)
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1 from public.perfiles f
    where f.id = (select auth.uid()) and f.organizacion_id = p_organizacion
      and (
        f.rol = 'admin' or exists (
          select 1 from public.profesionales p where p.id = p_profesional
            and p.perfil_id = f.id and p.organizacion_id = f.organizacion_id and p.activo
        )
      )
  )
  and (p_profesional is null or exists (
    select 1 from public.profesionales p where p.id = p_profesional and p.organizacion_id = p_organizacion
  ));
$$;

create function turnia_private.mi_agenda_turnia(p_fecha date, p_turno_id uuid)
returns table (
  id uuid, hora time, fecha date, cliente_nombre text, cliente_telefono text,
  vip boolean, precio_total numeric, estado text, servicio_nombre text,
  duracion_min integer, profesional text
)
language sql stable security definer set search_path = '' as $$
  select t.id, t.hora, t.fecha, t.cliente_nombre, t.cliente_telefono, t.vip, t.precio_total,
    t.estado, t.servicio_nombre, t.duracion_min, p.nombre
  from public.turnos t join public.profesionales p on p.id = t.profesional_id and p.organizacion_id = t.organizacion_id
  where (p_turno_id is not null or p_fecha is not null)
    and (p_turno_id is null or t.id = p_turno_id) and (p_fecha is null or t.fecha = p_fecha)
    and turnia_private.puede_gestionar(t.organizacion_id, t.profesional_id)
  order by t.hora, t.id;
$$;

create function turnia_private.cambiar_estado_turnia(p_turno_id uuid, p_estado text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.turnos t set estado = p_estado
  where t.id = p_turno_id and turnia_private.puede_gestionar(t.organizacion_id, t.profesional_id)
    and ((p_estado = 'confirmado' and t.estado = 'pendiente')
      or (p_estado = 'cancelado' and t.estado in ('pendiente', 'confirmado')));
  return found;
end;
$$;

create function turnia_private.mis_servicios_turnia()
returns table (id uuid, nombre text, duracion_min integer, precio numeric, activo boolean, profesional text)
language sql stable security definer set search_path = '' as $$
  select s.id, s.nombre, s.duracion_min, s.precio, s.activo, p.nombre
  from public.servicios s
  left join public.profesionales p on p.id = s.profesional_id and p.organizacion_id = s.organizacion_id
  where turnia_private.puede_gestionar(s.organizacion_id, s.profesional_id)
  order by s.nombre, s.id;
$$;

create function turnia_private.guardar_servicio_turnia(
  p_id uuid, p_nombre text, p_duracion_min integer, p_precio numeric, p_activo boolean
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  perfil public.perfiles%rowtype;
  profesional uuid;
  servicio uuid;
begin
  if p_activo is null and (p_nombre is null or char_length(btrim(p_nombre)) not between 2 and 80
    or p_duracion_min is null or p_duracion_min not between 1 and 240
    or p_precio is null or p_precio not between 0 and 99998499.99) then
    raise exception 'SERVICIO_INVALIDO' using errcode = '22023';
  end if;
  if p_id is null then
    if p_activo is not null then raise exception 'SERVICIO_INVALIDO' using errcode = '22023'; end if;
    select * into perfil from public.perfiles where id = auth.uid();
    if not found then raise exception 'SIN_PERFIL' using errcode = '42501'; end if;
    if perfil.rol = 'profesional' then
      select id into profesional from public.profesionales
      where perfil_id = perfil.id and organizacion_id = perfil.organizacion_id and activo;
      if not found then raise exception 'SIN_PERFIL' using errcode = '42501'; end if;
    end if;
    insert into public.servicios (organizacion_id, profesional_id, nombre, duracion_min, precio)
    values (perfil.organizacion_id, profesional, btrim(p_nombre), p_duracion_min, round(p_precio, 2))
    returning id into servicio;
  elsif p_activo is not null then
    update public.servicios s set activo = p_activo
    where s.id = p_id and turnia_private.puede_gestionar(s.organizacion_id, s.profesional_id)
    returning id into servicio;
  else
    update public.servicios s set nombre = btrim(p_nombre), duracion_min = p_duracion_min, precio = round(p_precio, 2)
    where s.id = p_id and turnia_private.puede_gestionar(s.organizacion_id, s.profesional_id)
    returning id into servicio;
  end if;
  return servicio;
end;
$$;

-- Solo crea una organización nueva para una cuenta sin perfil. El nombre
-- recibido es de presentación; la identidad viene del JWT de Supabase Auth.
create function turnia_private.preparar_cuenta_turnia(p_nombre text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  usuario uuid := auth.uid();
  nombre text := btrim(p_nombre);
  organizacion uuid;
begin
  if usuario is null then raise exception 'SIN_SESION' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext(usuario::text), 0);
  if exists (select 1 from public.perfiles where id = usuario) then return true; end if;
  if nombre is null or char_length(nombre) not between 2 and 100 then return false; end if;
  insert into public.organizaciones (nombre, slug) values (nombre, 'turnia-' || gen_random_uuid())
  returning id into organizacion;
  insert into public.perfiles (id, organizacion_id, nombre, rol) values (usuario, organizacion, nombre, 'admin');
  insert into public.profesionales (organizacion_id, perfil_id, nombre) values (organizacion, usuario, nombre);
  return true;
end;
$$;

-- PostgREST expone solo las funciones sin privilegios propios.
create function public.catalogo_turnia()
returns jsonb
language sql stable set search_path = ''
return turnia_private.catalogo_turnia();

create function public.horarios_disponibles(p_servicio_id uuid, p_profesional_id uuid, p_fecha date)
returns setof time
language sql stable set search_path = ''
as $$ select * from turnia_private.horarios_disponibles(p_servicio_id, p_profesional_id, p_fecha) $$;

create function public.reservar_turno_app(p_solicitud_id uuid, p_servicio_id uuid, p_profesional_id uuid, p_fecha date, p_hora time, p_vip boolean, p_cliente_nombre text, p_cliente_telefono text, p_precio_esperado numeric)
returns jsonb
language sql set search_path = ''
return turnia_private.reservar_turno(p_solicitud_id, p_servicio_id, p_profesional_id, p_fecha, p_hora, p_vip, p_cliente_nombre, p_cliente_telefono, p_precio_esperado);

create function public.mi_agenda_turnia(p_fecha date, p_turno_id uuid)
returns table (id uuid, hora time, fecha date, cliente_nombre text, cliente_telefono text, vip boolean, precio_total numeric, estado text, servicio_nombre text, duracion_min integer, profesional text)
language sql stable set search_path = ''
as $$ select * from turnia_private.mi_agenda_turnia(p_fecha, p_turno_id) $$;

create function public.cambiar_estado_turnia(p_turno_id uuid, p_estado text)
returns boolean
language sql set search_path = ''
return turnia_private.cambiar_estado_turnia(p_turno_id, p_estado);

create function public.mis_servicios_turnia()
returns table (id uuid, nombre text, duracion_min integer, precio numeric, activo boolean, profesional text)
language sql stable set search_path = ''
as $$ select * from turnia_private.mis_servicios_turnia() $$;

create function public.guardar_servicio_turnia(p_id uuid, p_nombre text, p_duracion_min integer, p_precio numeric, p_activo boolean)
returns uuid
language sql set search_path = ''
return turnia_private.guardar_servicio_turnia(p_id, p_nombre, p_duracion_min, p_precio, p_activo);

create function public.preparar_cuenta_turnia(p_nombre text)
returns boolean
language sql set search_path = ''
return turnia_private.preparar_cuenta_turnia(p_nombre);

revoke execute on all functions in schema turnia_private from public, anon, authenticated;
grant usage on schema turnia_private to anon, authenticated;
revoke execute on function public.catalogo_turnia() from public, anon, authenticated;
grant execute on function public.catalogo_turnia(), turnia_private.catalogo_turnia() to anon, authenticated;
revoke execute on function public.horarios_disponibles(uuid, uuid, date) from public, anon, authenticated;
grant execute on function public.horarios_disponibles(uuid, uuid, date), turnia_private.horarios_disponibles(uuid, uuid, date) to anon, authenticated;
revoke execute on function public.reservar_turno_app(uuid, uuid, uuid, date, time, boolean, text, text, numeric) from public, anon, authenticated;
grant execute on function public.reservar_turno_app(uuid, uuid, uuid, date, time, boolean, text, text, numeric), turnia_private.reservar_turno(uuid, uuid, uuid, date, time, boolean, text, text, numeric) to anon, authenticated;
revoke execute on function public.mi_agenda_turnia(date, uuid) from public, anon, authenticated;
grant execute on function public.mi_agenda_turnia(date, uuid), turnia_private.mi_agenda_turnia(date, uuid) to authenticated;
revoke execute on function public.cambiar_estado_turnia(uuid, text) from public, anon, authenticated;
grant execute on function public.cambiar_estado_turnia(uuid, text), turnia_private.cambiar_estado_turnia(uuid, text) to authenticated;
revoke execute on function public.mis_servicios_turnia() from public, anon, authenticated;
grant execute on function public.mis_servicios_turnia(), turnia_private.mis_servicios_turnia() to authenticated;
revoke execute on function public.guardar_servicio_turnia(uuid, text, integer, numeric, boolean) from public, anon, authenticated;
grant execute on function public.guardar_servicio_turnia(uuid, text, integer, numeric, boolean), turnia_private.guardar_servicio_turnia(uuid, text, integer, numeric, boolean) to authenticated;
revoke execute on function public.preparar_cuenta_turnia(text) from public, anon, authenticated;
grant execute on function public.preparar_cuenta_turnia(text), turnia_private.preparar_cuenta_turnia(text) to authenticated;

notify pgrst, 'reload schema';
