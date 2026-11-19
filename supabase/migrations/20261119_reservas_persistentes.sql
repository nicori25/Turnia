-- Aplicar en el SQL Editor del proyecto Supabase. Transacción completa y repetible.
-- No borra datos. Los conflictos existentes de turnos confirmados abortan la migración.
begin;
-- Una política personalizada permisiva podría anular el aislamiento. Requiere revisión manual.
do $$ begin
 if exists(select 1 from pg_policies where schemaname='public'
 and tablename in ('barberos','servicios','turnos') and policyname not in (
 'Cualquiera puede crear un turno','Cualquiera puede ver los servicios para elegir',
 'El barbero administra sus turnos','El barbero administra sus servicios','El barbero ve su propio perfil',
 'turnia_own_profile','turnia_own_services','turnia_own_turnos'))
 then raise exception 'Hay políticas personalizadas: revisar antes de aplicar esta migración'; end if;
end $$;
create table if not exists public.barberos (
 id uuid primary key references auth.users(id) on delete cascade,
 business_name text not null, created_at timestamptz not null default now()
);
create table if not exists public.servicios (
 id uuid primary key default gen_random_uuid(), barbero_id uuid not null references public.barberos(id) on delete cascade,
 nombre text not null, duracion_min integer not null, precio numeric(10,2) not null
);
create table if not exists public.turnos (
 id uuid primary key default gen_random_uuid(), barbero_id uuid not null references public.barberos(id) on delete cascade,
 servicio_id uuid references public.servicios(id), cliente_nombre text not null, cliente_telefono text not null,
 fecha date not null, hora time not null, vip boolean not null default false, precio_total numeric(10,2) not null,
 estado text not null default 'pendiente' check (estado in ('pendiente','confirmado','cancelado')),
 created_at timestamptz not null default now()
);
alter table public.turnos add column if not exists solicitud_id uuid;
create unique index if not exists turnos_solicitud_unique on public.turnos(solicitud_id);
create unique index if not exists turnos_confirmado_slot_unique
 on public.turnos(barbero_id,fecha,hora) where estado='confirmado';
create index if not exists turnos_agenda_date on public.turnos(barbero_id,fecha);

create or replace function public.handle_new_barbero() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.barberos(id,business_name)
 values(new.id,coalesce(nullif(trim(new.raw_user_meta_data->>'business_name'),''),'Mi barbería'))
 on conflict(id) do nothing;
 insert into public.servicios(barbero_id,nombre,duracion_min,precio)
 select new.id,s.nombre,s.duracion,s.precio from (values
 ('Corte',30,4500),('Barba',20,3000),('Corte + barba',45,7000)) s(nombre,duracion,precio)
 where not exists(select 1 from public.servicios where barbero_id=new.id);
 return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_barbero();
-- Perfiles y catálogo inicial para cuentas existentes, sin reemplazar sus datos.
insert into public.barberos(id,business_name)
 select id,coalesce(nullif(trim(raw_user_meta_data->>'business_name'),''),'Mi barbería') from auth.users
 on conflict(id) do nothing;
insert into public.servicios(barbero_id,nombre,duracion_min,precio)
 select b.id,s.nombre,s.duracion,s.precio from public.barberos b cross join
 (values ('Corte',30,4500),('Barba',20,3000),('Corte + barba',45,7000)) s(nombre,duracion,precio)
 where not exists(select 1 from public.servicios where barbero_id=b.id);

alter table public.barberos enable row level security;
alter table public.servicios enable row level security;
alter table public.turnos enable row level security;
-- Elimina las políticas abiertas del esquema anterior; las escrituras pasan por RPC.
drop policy if exists "Cualquiera puede crear un turno" on public.turnos;
drop policy if exists "Cualquiera puede ver los servicios para elegir" on public.servicios;
drop policy if exists "El barbero administra sus turnos" on public.turnos;
drop policy if exists "El barbero administra sus servicios" on public.servicios;
drop policy if exists "El barbero ve su propio perfil" on public.barberos;
drop policy if exists turnia_own_profile on public.barberos;
drop policy if exists turnia_own_services on public.servicios;
drop policy if exists turnia_own_turnos on public.turnos;
create policy turnia_own_profile on public.barberos for select to authenticated using(id=auth.uid());
create policy turnia_own_services on public.servicios for select to authenticated using(barbero_id=auth.uid());
create policy turnia_own_turnos on public.turnos for select to authenticated using(barbero_id=auth.uid());
revoke all on public.barberos,public.servicios,public.turnos from anon,authenticated;
grant select on public.barberos,public.servicios,public.turnos to authenticated;

-- Los endpoints públicos solo revelan locales, catálogo y horas ocupadas; nunca clientes.
create or replace function public.turnia_locales() returns table(id uuid,business_name text)
language sql stable security definer set search_path='' as $$
 select b.id,b.business_name from public.barberos b order by b.business_name,b.id
$$;
create or replace function public.turnia_servicios(p_barbero_id uuid)
returns table(id uuid,nombre text,duracion_min integer,precio numeric)
language sql stable security definer set search_path='' as $$
 select s.id,s.nombre,s.duracion_min,s.precio from public.servicios s
 where s.barbero_id=p_barbero_id order by s.precio,s.id
$$;
create or replace function public.turnia_ocupados(p_barbero_id uuid,p_fecha date) returns table(hora time)
language sql stable security definer set search_path='' as $$
 select t.hora from public.turnos t where t.barbero_id=p_barbero_id and t.fecha=p_fecha and t.estado='confirmado'
$$;

create or replace function public.turnia_solicitar(
 p_servicio_id uuid,p_fecha date,p_hora time,p_nombre text,p_telefono text,p_vip boolean,p_solicitud_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.servicios; t public.turnos; v_now timestamp := clock_timestamp() at time zone 'America/Argentina/Buenos_Aires';
begin
 if p_solicitud_id is null then raise exception 'Falta el identificador de solicitud'; end if;
 if p_nombre is null or length(trim(p_nombre)) not between 2 and 100 then raise exception 'Nombre inválido'; end if;
 if p_telefono is null or length(trim(p_telefono))>30 or p_telefono !~ '^[+()0-9 .-]+$'
 or length(regexp_replace(p_telefono,'[^0-9]','','g')) not between 6 and 20 then raise exception 'Teléfono inválido'; end if;
 select * into s from public.servicios where id=p_servicio_id;
 if not found then raise exception 'Servicio no encontrado'; end if;
 -- Todos los escritores de reservas usan el mismo bloqueo por barbero.
 perform 1 from public.barberos where id=s.barbero_id for update;
 select * into t from public.turnos where solicitud_id=p_solicitud_id;
 if found then
  if t.servicio_id is distinct from p_servicio_id or t.fecha is distinct from p_fecha or t.hora is distinct from p_hora
  or t.cliente_nombre is distinct from trim(p_nombre) or t.cliente_telefono is distinct from trim(p_telefono)
  or t.vip is distinct from coalesce(p_vip,false) then raise exception 'Identificador de solicitud ya utilizado'; end if;
  return jsonb_build_object('id',t.id,'estado',t.estado,'fecha',t.fecha,'hora',t.hora,'precio_total',t.precio_total);
 end if;
 v_now := clock_timestamp() at time zone 'America/Argentina/Buenos_Aires';
 if p_fecha is null or p_hora is null or p_fecha+p_hora<=v_now then raise exception 'Fecha u horario pasado'; end if;
 if not(p_hora=any(array['10:00'::time,'11:00'::time,'12:30'::time,'16:00'::time,'17:30'::time,'18:30'::time])) then raise exception 'Horario inválido'; end if;
 if exists(select 1 from public.turnos where barbero_id=s.barbero_id and fecha=p_fecha and hora=p_hora and estado='confirmado') then raise exception 'Horario ocupado'; end if;
 if s.precio<0 or s.duracion_min not between 1 and 60 then raise exception 'El servicio requiere revisar precio o duración'; end if;
 insert into public.turnos(barbero_id,servicio_id,cliente_nombre,cliente_telefono,fecha,hora,vip,precio_total,estado,solicitud_id)
 values(s.barbero_id,s.id,trim(p_nombre),trim(p_telefono),p_fecha,p_hora,coalesce(p_vip,false),s.precio+case when coalesce(p_vip,false) then 1500 else 0 end,'pendiente',p_solicitud_id)
 returning * into t;
 return jsonb_build_object('id',t.id,'estado',t.estado,'fecha',t.fecha,'hora',t.hora,'precio_total',t.precio_total);
end $$;

create or replace function public.turnia_estado(p_id uuid,p_estado text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t public.turnos; v_uid uuid := auth.uid();
begin
 if v_uid is null then raise exception 'Sesión requerida' using errcode='42501'; end if;
 if p_estado is null or p_estado not in ('confirmado','cancelado') then raise exception 'Estado inválido'; end if;
 perform 1 from public.barberos where id=v_uid for update;
 select * into t from public.turnos where id=p_id and barbero_id=v_uid for update;
 if not found then raise exception 'Turno no encontrado o sin permiso' using errcode='42501'; end if;
 if p_estado='confirmado' then
  if t.estado='cancelado' then raise exception 'El turno está cancelado'; end if;
  if t.fecha+t.hora <= (clock_timestamp() at time zone 'America/Argentina/Buenos_Aires') then raise exception 'Fecha u horario pasado'; end if;
  if exists(select 1 from public.turnos where barbero_id=t.barbero_id and fecha=t.fecha and hora=t.hora and estado='confirmado' and id<>t.id) then raise exception 'Horario ocupado'; end if;
 end if;
 update public.turnos set estado=p_estado where id=t.id;
 return jsonb_build_object('id',t.id,'estado',p_estado);
end $$;

revoke all on function public.handle_new_barbero() from public,anon,authenticated;
revoke all on function public.turnia_locales(), public.turnia_servicios(uuid),public.turnia_ocupados(uuid,date),public.turnia_solicitar(uuid,date,time,text,text,boolean,uuid),public.turnia_estado(uuid,text) from public,anon,authenticated;
grant execute on function public.turnia_locales(), public.turnia_servicios(uuid),public.turnia_ocupados(uuid,date),public.turnia_solicitar(uuid,date,time,text,text,boolean,uuid) to anon,authenticated;
grant execute on function public.turnia_estado(uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
