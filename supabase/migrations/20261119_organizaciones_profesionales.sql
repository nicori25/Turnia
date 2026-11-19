-- Para la estructura real de Turnia: organizaciones, perfiles y profesionales.
-- No modifica tablas, políticas, triggers de registro ni la restricción de solapamiento.
begin;
do $$ begin
 if to_regclass('public.organizaciones') is null or to_regclass('public.profesionales') is null
 or to_regclass('public.perfiles') is null or to_regclass('public.clientes') is null
 then raise exception 'Falta el esquema de organizaciones y profesionales'; end if;
 if not exists(select 1 from pg_constraint where conrelid='public.turnos'::regclass
 and conname='turnia_sin_solapamiento' and contype='x')
 then raise exception 'Falta la restricción turnia_sin_solapamiento; revisar antes de activar'; end if;
end $$;

create or replace function public.turnia_v2_locales() returns table(id uuid,business_name text)
language sql stable security definer set search_path='' as $$
 select p.id,o.nombre || ' · ' || p.nombre from public.profesionales p
 join public.organizaciones o on o.id=p.organizacion_id
 where p.activo order by o.nombre,p.nombre,p.id
$$;
create or replace function public.turnia_v2_servicios(p_profesional_id uuid)
returns table(id uuid,nombre text,duracion_min integer,precio numeric)
language sql stable security definer set search_path='' as $$
 select s.id,s.nombre,s.duracion_min,s.precio from public.servicios s
 join public.profesionales p on p.id=p_profesional_id and p.organizacion_id=s.organizacion_id
 where p.activo and s.activo and (s.profesional_id is null or s.profesional_id=p.id)
 order by s.precio,s.nombre,s.id
$$;

-- Devuelve SOLO horarios bloqueados; no expone clientes ni registros de turnos.
-- Incluye pendientes y confirmados y compara intervalos de duración real.
create or replace function public.turnia_v2_ocupados(p_profesional_id uuid,p_fecha date,p_servicio_id uuid default null)
returns table(hora time) language plpgsql stable security definer set search_path='' as $$
declare v_org uuid; v_duracion integer := 1;
begin
 select organizacion_id into v_org from public.profesionales where id=p_profesional_id and activo;
 if not found then raise exception 'Profesional no disponible'; end if;
 if p_servicio_id is not null then
  select s.duracion_min into v_duracion from public.servicios s where s.id=p_servicio_id and s.activo
  and s.organizacion_id=v_org and (s.profesional_id is null or s.profesional_id=p_profesional_id);
  if not found then raise exception 'Servicio no disponible para este profesional'; end if;
 end if;
 return query select slot from unnest(array['10:00'::time,'11:00'::time,'12:30'::time,'16:00'::time,'17:30'::time,'18:30'::time]) slot
 where exists(select 1 from public.turnos t where t.organizacion_id=v_org and t.profesional_id=p_profesional_id
 and t.estado in ('pendiente','confirmado')
 and t.periodo && tsrange(p_fecha+slot,p_fecha+slot+make_interval(mins=>v_duracion),'[)'));
end $$;

create or replace function public.turnia_v2_solicitar(
 p_profesional_id uuid,p_servicio_id uuid,p_fecha date,p_hora time,p_nombre text,p_telefono text,p_vip boolean,p_solicitud_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.profesionales; s public.servicios; t public.turnos; v_cliente uuid;
begin
 if p_solicitud_id is null then raise exception 'Falta el identificador de solicitud'; end if;
 if p_nombre is null or length(trim(p_nombre)) not between 2 and 100 then raise exception 'Nombre inválido'; end if;
 if p_telefono is null or length(trim(p_telefono))>30 or p_telefono !~ '^[+()0-9 .-]+$'
 or length(regexp_replace(p_telefono,'[^0-9]','','g')) not between 6 and 20 then raise exception 'Teléfono inválido'; end if;
 select * into p from public.profesionales where id=p_profesional_id and activo;
 if not found then raise exception 'Profesional no disponible'; end if;
 -- Serializa escrituras de la organización para resolver reintentos y clientes.
 perform 1 from public.organizaciones where id=p.organizacion_id for update;
 select * into t from public.turnos where solicitud_id=p_solicitud_id;
 if found then
  if t.profesional_id is distinct from p.id or t.servicio_id is distinct from p_servicio_id
  or t.fecha is distinct from p_fecha or t.hora is distinct from p_hora
  or t.cliente_nombre is distinct from trim(p_nombre) or t.cliente_telefono is distinct from trim(p_telefono)
  or t.vip is distinct from coalesce(p_vip,false) then raise exception 'Identificador de solicitud ya utilizado'; end if;
  return jsonb_build_object('id',t.id,'estado',t.estado,'fecha',t.fecha,'hora',t.hora,'precio_total',t.precio_total);
 end if;
 select * into s from public.servicios where id=p_servicio_id and activo and organizacion_id=p.organizacion_id
 and (profesional_id is null or profesional_id=p.id);
 if not found then raise exception 'Servicio no disponible para este profesional'; end if;
 if p_fecha is null or p_hora is null or p_fecha+p_hora <= (clock_timestamp() at time zone 'America/Argentina/Buenos_Aires') then raise exception 'Fecha u horario pasado'; end if;
 if not(p_hora=any(array['10:00'::time,'11:00'::time,'12:30'::time,'16:00'::time,'17:30'::time,'18:30'::time])) then raise exception 'Horario inválido'; end if;
 if exists(select 1 from public.turnos x where x.profesional_id=p.id and x.estado in ('pendiente','confirmado')
 and x.periodo && tsrange(p_fecha+p_hora,p_fecha+p_hora+make_interval(mins=>s.duracion_min),'[)')) then raise exception 'Horario ocupado'; end if;
 select id into v_cliente from public.clientes where organizacion_id=p.organizacion_id and telefono=trim(p_telefono) order by created_at,id limit 1;
 if v_cliente is null then
  insert into public.clientes(id,organizacion_id,nombre,telefono,created_at)
  values(gen_random_uuid(),p.organizacion_id,trim(p_nombre),trim(p_telefono),now()) returning id into v_cliente;
 end if;
 insert into public.turnos(id,organizacion_id,profesional_id,servicio_id,servicio_nombre,cliente_id,
 cliente_nombre,cliente_telefono,fecha,hora,vip,precio_total,estado,duracion_min,solicitud_id,created_at)
 values(gen_random_uuid(),p.organizacion_id,p.id,s.id,s.nombre,v_cliente,trim(p_nombre),trim(p_telefono),p_fecha,p_hora,
 coalesce(p_vip,false),s.precio+case when coalesce(p_vip,false) then 1500 else 0 end,'pendiente',s.duracion_min,p_solicitud_id,now()) returning * into t;
 return jsonb_build_object('id',t.id,'estado',t.estado,'fecha',t.fecha,'hora',t.hora,'precio_total',t.precio_total);
end $$;

create or replace function public.turnia_v2_agenda(p_fecha date default null,p_id uuid default null)
returns setof public.turnos language plpgsql stable security definer set search_path='' as $$
declare v_perfil public.perfiles;
begin
 select * into v_perfil from public.perfiles where id=auth.uid();
 if not found then raise exception 'Tu cuenta no tiene un perfil asignado a una organización' using errcode='42501'; end if;
 if p_fecha is null and p_id is null then raise exception 'Elegí una fecha o turno'; end if;
 return query select t.* from public.turnos t where t.organizacion_id=v_perfil.organizacion_id
 and (v_perfil.rol='admin' or (v_perfil.rol='profesional' and exists(select 1 from public.profesionales p
 where p.id=t.profesional_id and p.perfil_id=v_perfil.id and p.organizacion_id=v_perfil.organizacion_id)))
 and (p_fecha is null or t.fecha=p_fecha) and (p_id is null or t.id=p_id) order by t.hora,t.id;
end $$;

create or replace function public.turnia_v2_estado(p_id uuid,p_estado text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_perfil public.perfiles; t public.turnos;
begin
 select * into v_perfil from public.perfiles where id=auth.uid();
 if not found then raise exception 'Sesión o perfil requerido' using errcode='42501'; end if;
 if p_estado is null or p_estado not in ('confirmado','cancelado') then raise exception 'Estado inválido'; end if;
 perform 1 from public.organizaciones where id=v_perfil.organizacion_id for update;
 select x.* into t from public.turnos x where x.id=p_id and x.organizacion_id=v_perfil.organizacion_id
 and (v_perfil.rol='admin' or (v_perfil.rol='profesional' and exists(select 1 from public.profesionales p
 where p.id=x.profesional_id and p.perfil_id=v_perfil.id and p.organizacion_id=v_perfil.organizacion_id))) for update of x;
 if not found then raise exception 'Turno no encontrado o sin permiso' using errcode='42501'; end if;
 if p_estado='confirmado' then
  if t.estado='cancelado' then raise exception 'El turno está cancelado'; end if;
  if t.fecha+t.hora <= (clock_timestamp() at time zone 'America/Argentina/Buenos_Aires') then raise exception 'Fecha u horario pasado'; end if;
 end if;
 update public.turnos set estado=p_estado where id=t.id;
 return jsonb_build_object('id',t.id,'estado',p_estado);
end $$;

revoke all on function public.turnia_v2_locales(),public.turnia_v2_servicios(uuid),public.turnia_v2_ocupados(uuid,date,uuid),public.turnia_v2_solicitar(uuid,uuid,date,time,text,text,boolean,uuid),public.turnia_v2_agenda(date,uuid),public.turnia_v2_estado(uuid,text) from public,anon,authenticated;
grant execute on function public.turnia_v2_locales(),public.turnia_v2_servicios(uuid),public.turnia_v2_ocupados(uuid,date,uuid),public.turnia_v2_solicitar(uuid,uuid,date,time,text,text,boolean,uuid) to anon,authenticated;
grant execute on function public.turnia_v2_agenda(date,uuid),public.turnia_v2_estado(uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
