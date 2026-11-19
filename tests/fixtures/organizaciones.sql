-- Solo base local de pruebas. Estructura reconstruida de los metadatos compartidos.
create extension if not exists btree_gist;
create table organizaciones(id uuid primary key default gen_random_uuid(),nombre text not null,slug text not null unique,telefono text,email text,created_at timestamptz not null default now());
create table perfiles(id uuid primary key references auth.users(id) on delete cascade,organizacion_id uuid not null references organizaciones(id),nombre text not null,telefono text,rol text not null check(rol in ('admin','profesional')),created_at timestamptz not null default now());
create table profesionales(id uuid primary key default gen_random_uuid(),organizacion_id uuid not null references organizaciones(id),perfil_id uuid unique references perfiles(id),nombre text not null,activo boolean not null default true,created_at timestamptz not null default now());
create table servicios(id uuid primary key default gen_random_uuid(),organizacion_id uuid not null references organizaciones(id),profesional_id uuid references profesionales(id),nombre text not null,descripcion text,duracion_min integer not null check(duracion_min>0),precio numeric not null check(precio>=0),imagen_url text,imagen_ruta text,activo boolean not null default true,created_at timestamptz not null default now());
create table clientes(id uuid primary key default gen_random_uuid(),organizacion_id uuid not null references organizaciones(id),nombre text not null,telefono text not null,email text,created_at timestamptz not null default now());
create table turnos(id uuid primary key default gen_random_uuid(),organizacion_id uuid not null references organizaciones(id),profesional_id uuid not null references profesionales(id),servicio_id uuid references servicios(id),servicio_nombre text not null,cliente_id uuid references clientes(id),cliente_nombre text not null,cliente_telefono text not null,fecha date not null,hora time not null,vip boolean not null default false,precio_total numeric not null check(precio_total>=0),estado text not null default 'pendiente' check(estado in ('pendiente','confirmado','cancelado')),created_at timestamptz not null default now(),duracion_min integer not null constraint turnia_duracion_positiva check(duracion_min>0),solicitud_id uuid unique,periodo tsrange generated always as(tsrange(fecha+hora,fecha+hora+make_interval(mins=>duracion_min),'[)')) stored,
 constraint turnia_sin_solapamiento exclude using gist(profesional_id with =,periodo with &&) where (estado in ('pendiente','confirmado')));
create function public.mi_organizacion() returns uuid language sql stable security definer set search_path=public as $$ select organizacion_id from perfiles where id=auth.uid() $$;
create function public.es_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from perfiles where id=auth.uid() and rol='admin') $$;
create function public.en_mi_org(p_org uuid) returns boolean language sql stable security definer set search_path=public as $$ select coalesce(mi_organizacion()=p_org,false) $$;
create function public.mi_profesional_id() returns uuid language sql stable security definer set search_path=public as $$ select id from profesionales where perfil_id=auth.uid() $$;
alter table servicios enable row level security;
alter table turnos enable row level security;
create policy "Cualquiera ve los servicios activos" on servicios for select using(activo);
create policy "El admin gestiona los servicios de su organización" on servicios for all using(es_admin() and en_mi_org(organizacion_id)) with check(es_admin() and en_mi_org(organizacion_id));
create policy "El admin gestiona los turnos de su organización" on turnos for all using(es_admin() and en_mi_org(organizacion_id)) with check(es_admin() and en_mi_org(organizacion_id));
create policy "El profesional actualiza sus turnos" on turnos for update using(profesional_id=mi_profesional_id()) with check(profesional_id=mi_profesional_id());
create policy "El profesional ve sus turnos" on turnos for select using(profesional_id=mi_profesional_id());
grant select on servicios,turnos to anon,authenticated;
