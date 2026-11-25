-- Funciones de alta y agenda del proyecto alojado. Las RPC de reserva pública de App siguen disponibles.
begin;
create or replace function turnia_private.turnia_v2_agenda(p_fecha date default null,p_id uuid default null)
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

create or replace function turnia_private.turnia_v2_estado(p_id uuid,p_estado text) returns jsonb
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

create or replace function turnia_private.turnia_v2_preparar_cuenta() returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 v_uid uuid := auth.uid(); v_nombre text; v_org uuid; v_perfil public.perfiles; v_pro public.profesionales;
begin
 if v_uid is null then raise exception 'Sesión requerida' using errcode='42501'; end if;
 -- Serializa el alta por cuenta para que pestañas o reintentos no dupliquen locales.
 perform 1 from auth.users where id=v_uid for update;
 if not found then raise exception 'Usuario no encontrado' using errcode='42501'; end if;
 select * into v_perfil from public.perfiles where id=v_uid for update;
 if not found then
  select nullif(trim(raw_user_meta_data->>'business_name'),'') into v_nombre from auth.users where id=v_uid;
  if v_nombre is null or length(v_nombre) not between 2 and 100 then
   raise exception 'Falta el nombre del local en esta cuenta. Consultá al administrador.';
  end if;
  v_org := gen_random_uuid();
  insert into public.organizaciones(id,nombre,slug,created_at)
  values(v_org,v_nombre,'local-'||v_org::text,now());
  insert into public.perfiles(id,organizacion_id,nombre,rol,created_at)
  values(v_uid,v_org,'Barbero','admin',now()) returning * into v_perfil;
 end if;
 select * into v_pro from public.profesionales where perfil_id=v_uid for update;
 if found then
  if v_pro.organizacion_id<>v_perfil.organizacion_id then
   raise exception 'La cuenta tiene una vinculación de organización inconsistente. Consultá al administrador.';
  end if;
 else
  -- Un empleado no puede asignarse un profesional nuevo dentro de un local ajeno.
  if v_perfil.rol<>'admin' then
   raise exception 'Tu cuenta profesional todavía no está vinculada. Consultá al administrador del local.';
  end if;
  insert into public.profesionales(id,organizacion_id,perfil_id,nombre,activo,created_at)
  values(gen_random_uuid(),v_perfil.organizacion_id,v_uid,v_perfil.nombre,true,now()) returning * into v_pro;
 end if;
 -- Solo un administrador puede dar de alta un catálogo inicial. Respeta servicios existentes.
 if v_perfil.rol='admin' and not exists(select 1 from public.servicios s where
 s.organizacion_id=v_perfil.organizacion_id and s.activo and (s.profesional_id is null or s.profesional_id=v_pro.id)) then
  insert into public.servicios(id,organizacion_id,profesional_id,nombre,duracion_min,precio,activo,created_at)
  select gen_random_uuid(),v_perfil.organizacion_id,v_pro.id,s.nombre,s.duracion,s.precio,true,now()
  from (values ('Corte',30,4500),('Barba',20,3000),('Corte + barba',45,7000)) s(nombre,duracion,precio);
 end if;
 return jsonb_build_object('organizacion_id',v_perfil.organizacion_id,'profesional_id',v_pro.id,'activo',v_pro.activo);
end $$;
create or replace function turnia_private.turnia_v2_opciones_turno() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_perfil public.perfiles; v_pros jsonb; v_servicios jsonb;
begin
 select * into v_perfil from public.perfiles where id=auth.uid();
 if not found then raise exception 'Sesión o perfil requerido' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'nombre',p.nombre) order by p.nombre),'[]'::jsonb) into v_pros
 from public.profesionales p where p.organizacion_id=v_perfil.organizacion_id and p.activo
 and (v_perfil.rol='admin' or (v_perfil.rol='profesional' and p.perfil_id=v_perfil.id));
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'nombre',s.nombre,'profesional_id',s.profesional_id,
 'duracion_min',s.duracion_min,'precio',s.precio) order by s.nombre),'[]'::jsonb) into v_servicios
 from public.servicios s where s.organizacion_id=v_perfil.organizacion_id and s.activo
 and exists(select 1 from public.profesionales p where p.organizacion_id=s.organizacion_id and p.activo
 and (s.profesional_id is null or s.profesional_id=p.id)
 and (v_perfil.rol='admin' or (v_perfil.rol='profesional' and p.perfil_id=v_perfil.id)));
 return jsonb_build_object('profesionales',v_pros,'servicios',v_servicios);
end $$;

create or replace function turnia_private.turnia_v2_guardar_turno(
 p_id uuid,p_profesional_id uuid,p_servicio_id uuid,p_fecha date,p_hora time,p_nombre text,
 p_telefono text,p_vip boolean,p_estado text,p_solicitud_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_perfil public.perfiles; v_pro public.profesionales; s public.servicios; t public.turnos; v_cliente uuid; v_id uuid;
begin
 select * into v_perfil from public.perfiles where id=auth.uid();
 if not found then raise exception 'Sesión o perfil requerido' using errcode='42501'; end if;
 perform 1 from public.organizaciones where id=v_perfil.organizacion_id for update;
 if p_id is not null then
  select x.* into t from public.turnos x where x.id=p_id and x.organizacion_id=v_perfil.organizacion_id
  and (v_perfil.rol='admin' or (v_perfil.rol='profesional' and exists(select 1 from public.profesionales p
  where p.id=x.profesional_id and p.perfil_id=v_perfil.id and p.organizacion_id=v_perfil.organizacion_id))) for update of x;
  if not found then raise exception 'Turno no encontrado o sin permiso' using errcode='42501'; end if;
  v_id := t.id;
 end if;
 select * into v_pro from public.profesionales p where p.id=p_profesional_id and p.organizacion_id=v_perfil.organizacion_id
 and p.activo and (v_perfil.rol='admin' or (v_perfil.rol='profesional' and p.perfil_id=v_perfil.id));
 if not found then raise exception 'Profesional fuera de tu acceso o inactivo' using errcode='42501'; end if;
 select * into s from public.servicios where id=p_servicio_id and organizacion_id=v_perfil.organizacion_id and activo
 and (profesional_id is null or profesional_id=v_pro.id);
 if not found then raise exception 'Servicio no disponible para este profesional'; end if;
 if p_nombre is null or length(trim(p_nombre)) not between 2 and 100 then raise exception 'Nombre inválido'; end if;
 if p_telefono is null or length(trim(p_telefono))>30 or p_telefono !~ '^[+()0-9 .-]+$'
 or length(regexp_replace(p_telefono,'[^0-9]','','g')) not between 6 and 20 then raise exception 'Teléfono inválido'; end if;
 if p_estado is null or p_estado not in ('pendiente','confirmado','cancelado') then raise exception 'Estado inválido'; end if;
 if p_fecha is null or p_hora is null or not(p_hora=any(array['10:00'::time,'11:00'::time,'12:30'::time,'16:00'::time,'17:30'::time,'18:30'::time])) then raise exception 'Horario inválido'; end if;
 -- Reintentos exactos de creación no generan duplicados.
 if p_id is null then
  if p_solicitud_id is null then raise exception 'Falta el identificador de solicitud'; end if;
  select * into t from public.turnos where solicitud_id=p_solicitud_id;
  if found then
   if t.organizacion_id<>v_perfil.organizacion_id or t.profesional_id<>v_pro.id or t.servicio_id is distinct from s.id
   or t.fecha<>p_fecha or t.hora<>p_hora or t.cliente_nombre<>trim(p_nombre) or t.cliente_telefono<>trim(p_telefono)
   or t.vip is distinct from coalesce(p_vip,false) or t.estado<>p_estado then raise exception 'Identificador de solicitud ya utilizado'; end if;
   return jsonb_build_object('id',t.id,'fecha',t.fecha,'estado',t.estado);
  end if;
 end if;
 -- Editar datos de un registro histórico no permite reprogramarlo al pasado.
 if p_fecha+p_hora <= (clock_timestamp() at time zone 'America/Argentina/Buenos_Aires') and
 (p_id is null or t.fecha<>p_fecha or t.hora<>p_hora or t.profesional_id<>v_pro.id
 or t.servicio_id is distinct from s.id or t.estado<>p_estado) then raise exception 'Fecha u horario pasado'; end if;
 if p_estado in ('pendiente','confirmado') and exists(select 1 from public.turnos x
 where x.profesional_id=v_pro.id and x.id is distinct from v_id and x.estado in ('pendiente','confirmado')
 and x.periodo && tsrange(p_fecha+p_hora,p_fecha+p_hora+make_interval(mins=>s.duracion_min),'[)')) then raise exception 'Horario ocupado'; end if;
 select id into v_cliente from public.clientes where organizacion_id=v_perfil.organizacion_id and telefono=trim(p_telefono) order by created_at,id limit 1;
 if v_cliente is null then
  insert into public.clientes(id,organizacion_id,nombre,telefono,created_at)
  values(gen_random_uuid(),v_perfil.organizacion_id,trim(p_nombre),trim(p_telefono),now()) returning id into v_cliente;
 end if;
 if p_id is null then
  insert into public.turnos(id,organizacion_id,profesional_id,servicio_id,servicio_nombre,cliente_id,cliente_nombre,cliente_telefono,
  fecha,hora,vip,precio_total,estado,duracion_min,solicitud_id,created_at)
  values(gen_random_uuid(),v_perfil.organizacion_id,v_pro.id,s.id,s.nombre,v_cliente,trim(p_nombre),trim(p_telefono),p_fecha,p_hora,
  coalesce(p_vip,false),s.precio+case when coalesce(p_vip,false) then 1500 else 0 end,p_estado,s.duracion_min,p_solicitud_id,now()) returning id into v_id;
 else
  update public.turnos set profesional_id=v_pro.id,servicio_id=s.id,servicio_nombre=s.nombre,cliente_id=v_cliente,
  cliente_nombre=trim(p_nombre),cliente_telefono=trim(p_telefono),fecha=p_fecha,hora=p_hora,vip=coalesce(p_vip,false),
  precio_total=s.precio+case when coalesce(p_vip,false) then 1500 else 0 end,estado=p_estado,duracion_min=s.duracion_min
  where id=v_id;
 end if;
 return jsonb_build_object('id',v_id,'fecha',p_fecha,'estado',p_estado);
end $$;

create or replace function turnia_private.turnia_v2_eliminar_turno(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_perfil public.perfiles; t public.turnos;
begin
 select * into v_perfil from public.perfiles where id=auth.uid();
 if not found then raise exception 'Sesión o perfil requerido' using errcode='42501'; end if;
 perform 1 from public.organizaciones where id=v_perfil.organizacion_id for update;
 select x.* into t from public.turnos x where x.id=p_id and x.organizacion_id=v_perfil.organizacion_id
 and (v_perfil.rol='admin' or (v_perfil.rol='profesional' and exists(select 1 from public.profesionales p
 where p.id=x.profesional_id and p.perfil_id=v_perfil.id and p.organizacion_id=v_perfil.organizacion_id))) for update of x;
 if not found then raise exception 'Turno no encontrado o sin permiso' using errcode='42501'; end if;
 delete from public.turnos where id=t.id;
 return jsonb_build_object('id',t.id,'fecha',t.fecha);
end $$;

-- La API usa las mismas firmas de producción. Solo el rol autenticado tiene
-- acceso y las funciones que operan con privilegios viven en el esquema interno.
create or replace function public.turnia_v2_agenda(p_fecha date default null, p_id uuid default null)
returns setof public.turnos language sql stable security invoker set search_path = ''
as $$ select * from turnia_private.turnia_v2_agenda(p_fecha, p_id) $$;

create or replace function public.turnia_v2_estado(p_id uuid, p_estado text)
returns jsonb language sql security invoker set search_path = ''
return turnia_private.turnia_v2_estado(p_id, p_estado);

create or replace function public.turnia_v2_preparar_cuenta()
returns jsonb language sql security invoker set search_path = ''
return turnia_private.turnia_v2_preparar_cuenta();

create or replace function public.turnia_v2_opciones_turno()
returns jsonb language sql stable security invoker set search_path = ''
return turnia_private.turnia_v2_opciones_turno();

create or replace function public.turnia_v2_guardar_turno(
    p_id uuid, p_profesional_id uuid, p_servicio_id uuid, p_fecha date, p_hora time,
    p_nombre text, p_telefono text, p_vip boolean, p_estado text, p_solicitud_id uuid
)
returns jsonb language sql security invoker set search_path = ''
return turnia_private.turnia_v2_guardar_turno(
    p_id, p_profesional_id, p_servicio_id, p_fecha, p_hora,
    p_nombre, p_telefono, p_vip, p_estado, p_solicitud_id
);

create or replace function public.turnia_v2_eliminar_turno(p_id uuid)
returns jsonb language sql security invoker set search_path = ''
return turnia_private.turnia_v2_eliminar_turno(p_id);

revoke execute on function
  public.turnia_v2_agenda(date, uuid),
  turnia_private.turnia_v2_agenda(date, uuid),
  public.turnia_v2_estado(uuid, text),
  turnia_private.turnia_v2_estado(uuid, text),
  public.turnia_v2_preparar_cuenta(),
  turnia_private.turnia_v2_preparar_cuenta(),
  public.turnia_v2_opciones_turno(),
  turnia_private.turnia_v2_opciones_turno(),
  public.turnia_v2_guardar_turno(uuid, uuid, uuid, date, time, text, text, boolean, text, uuid),
  turnia_private.turnia_v2_guardar_turno(uuid, uuid, uuid, date, time, text, text, boolean, text, uuid),
  public.turnia_v2_eliminar_turno(uuid),
  turnia_private.turnia_v2_eliminar_turno(uuid)
from public, anon, authenticated;

grant execute on function
  public.turnia_v2_agenda(date, uuid),
  turnia_private.turnia_v2_agenda(date, uuid),
  public.turnia_v2_estado(uuid, text),
  turnia_private.turnia_v2_estado(uuid, text),
  public.turnia_v2_preparar_cuenta(),
  turnia_private.turnia_v2_preparar_cuenta(),
  public.turnia_v2_opciones_turno(),
  turnia_private.turnia_v2_opciones_turno(),
  public.turnia_v2_guardar_turno(uuid, uuid, uuid, date, time, text, text, boolean, text, uuid),
  turnia_private.turnia_v2_guardar_turno(uuid, uuid, uuid, date, time, text, text, boolean, text, uuid),
  public.turnia_v2_eliminar_turno(uuid),
  turnia_private.turnia_v2_eliminar_turno(uuid)
to authenticated;

notify pgrst,'reload schema';
commit;
