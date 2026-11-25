-- Complementa 20261119_organizaciones_profesionales.sql. No modifica políticas ni triggers.
-- Se invoca con la sesión autenticada después del registro o primer inicio de sesión.
begin;
create or replace function public.turnia_v2_preparar_cuenta() returns jsonb
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
revoke all on function public.turnia_v2_preparar_cuenta() from public,anon,authenticated;
grant execute on function public.turnia_v2_preparar_cuenta() to authenticated;
notify pgrst,'reload schema';
commit;
