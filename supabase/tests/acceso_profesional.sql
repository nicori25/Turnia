-- Ejecutar solo en una base local de prueba. Los datos se revierten al final.
begin;
do $$
declare
  administrador uuid := gen_random_uuid();
  profesional uuid := gen_random_uuid();
  organizacion uuid;
  profesional_a uuid;
  profesional_b uuid;
  servicio uuid;
  turno_a uuid;
  turno_b uuid;
begin
  assert not has_column_privilege('authenticated', 'public.perfiles', 'rol', 'UPDATE');
  assert not has_column_privilege('authenticated', 'public.perfiles', 'organizacion_id', 'UPDATE');
  assert has_column_privilege('authenticated', 'public.perfiles', 'nombre', 'UPDATE');
  assert not has_column_privilege('anon', 'public.perfiles', 'nombre', 'UPDATE');

  insert into auth.users (id) values (administrador), (profesional);
  insert into public.organizaciones (nombre, slug) values ('Prueba profesional', 'test-' || gen_random_uuid())
    returning id into organizacion;
  insert into public.perfiles (id, organizacion_id, nombre, rol) values
    (administrador, organizacion, 'Administrador', 'admin'),
    (profesional, organizacion, 'Profesional', 'profesional');
  insert into public.profesionales (organizacion_id, perfil_id, nombre)
    values (organizacion, administrador, 'Administrador') returning id into profesional_a;
  insert into public.profesionales (organizacion_id, perfil_id, nombre)
    values (organizacion, profesional, 'Profesional') returning id into profesional_b;
  insert into public.servicios (organizacion_id, nombre, duracion_min, precio)
    values (organizacion, 'Compartido', 35, 4000) returning id into servicio;
  insert into public.turnos (organizacion_id, profesional_id, servicio_id, servicio_nombre,
    cliente_nombre, cliente_telefono, fecha, hora, precio_total)
    values (organizacion, profesional_a, servicio, 'Compartido', 'Prueba A', '11 0000 0000', '2035-01-01', '10:00', 4000)
    returning id into turno_a;
  insert into public.turnos (organizacion_id, profesional_id, servicio_id, servicio_nombre,
    cliente_nombre, cliente_telefono, fecha, hora, precio_total)
    values (organizacion, profesional_b, servicio, 'Compartido', 'Prueba B', '11 0000 0000', '2035-01-01', '10:00', 4000)
    returning id into turno_b;

  assert (select duracion_min from public.turnos where id = turno_b) = 35;
  assert (select count(*) from jsonb_array_elements(public.catalogo_turnia() -> 'servicios') item
    where item ->> 'id' = servicio::text) = 2;

  perform set_config('request.jwt.claims', json_build_object('sub', profesional)::text, true);
  assert (select count(*) from public.mi_agenda_turnia('2035-01-01', null)) = 1;
  assert not public.cambiar_estado_turnia(turno_a, 'cancelado');
  assert public.cambiar_estado_turnia(turno_b, 'confirmado');
  assert public.guardar_servicio_turnia(servicio, null, null, null, false) is null;

  perform set_config('request.jwt.claims', json_build_object('sub', administrador)::text, true);
  assert (select count(*) from public.mi_agenda_turnia('2035-01-01', null)) = 2;
  assert public.cambiar_estado_turnia(turno_b, 'cancelado');
end
$$;
rollback;
