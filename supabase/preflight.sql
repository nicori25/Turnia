-- Ejecutar en el SQL Editor del proyecto existente. Devuelve solo metadatos
-- y un conteo agregado; no devuelve filas de clientes ni de turnos.
with tablas as (
  select c.oid, c.relname as nombre, c.relrowsecurity as rls
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('organizaciones', 'perfiles', 'profesionales', 'servicios', 'clientes', 'turnos')
    and c.relkind in ('r', 'p')
), turnos_activos as (
  select t.id, t.profesional_id, t.fecha + t.hora as inicio,
    t.fecha + t.hora + make_interval(mins => coalesce(s.duracion_min, 30)) as fin
  from public.turnos t
  left join public.servicios s on s.id = t.servicio_id and s.organizacion_id = t.organizacion_id
  where t.estado in ('pendiente', 'confirmado')
), intervalos as (
  select inicio, max(fin) over (
    partition by profesional_id order by inicio, id
    rows between unbounded preceding and 1 preceding
  ) as fin_anterior
  from turnos_activos
)
select jsonb_build_object(
  'tablas', coalesce((
    select jsonb_agg(jsonb_build_object(
      'nombre', nombre, 'rls', rls,
      'anon_select', has_table_privilege('anon', oid, 'SELECT'),
      'anon_insert', has_table_privilege('anon', oid, 'INSERT'),
      'authenticated_update', has_table_privilege('authenticated', oid, 'UPDATE')
    ) order by nombre)
    from tablas
  ), '[]'::jsonb),
  'politicas', coalesce((
    select jsonb_agg(to_jsonb(p) - 'schemaname' order by p.tablename, p.policyname)
    from pg_catalog.pg_policies p
    where p.schemaname = 'public' and p.tablename in (select nombre from tablas)
  ), '[]'::jsonb),
  'escritura_columnas_de_identidad', coalesce((
    select jsonb_agg(to_jsonb(p) order by p.table_name, p.column_name, p.grantee, p.privilege_type)
    from (
      select grantee, table_name, column_name, privilege_type
      from information_schema.column_privileges
      where table_schema = 'public' and grantee in ('PUBLIC', 'anon', 'authenticated')
        and privilege_type in ('INSERT', 'UPDATE')
        and (
          (table_name = 'perfiles' and column_name in ('id', 'organizacion_id', 'rol'))
          or (table_name = 'profesionales' and column_name in ('perfil_id', 'organizacion_id'))
        )
    ) p
  ), '[]'::jsonb),
  'triggers', coalesce((
    select jsonb_agg(jsonb_build_object('tabla', t.nombre, 'nombre', g.tgname, 'estado', g.tgenabled)
      order by t.nombre, g.tgname)
    from pg_catalog.pg_trigger g join tablas t on t.oid = g.tgrelid
    where not g.tgisinternal
  ), '[]'::jsonb),
  'columnas_agregadas_en_turnos', coalesce((
    select jsonb_agg(a.attname order by a.attname)
    from pg_catalog.pg_attribute a
    join tablas t on t.oid = a.attrelid and t.nombre = 'turnos'
    where a.attnum > 0 and not a.attisdropped and a.attname in ('duracion_min', 'solicitud_id', 'periodo')
  ), '[]'::jsonb),
  'funciones_existentes', coalesce((
    select jsonb_agg(p.oid::regprocedure::text order by p.proname, p.oid)
    from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'catalogo_turnia', 'horarios_disponibles', 'reservar_turno', 'reservar_turno_app', 'mi_agenda_turnia',
      'cambiar_estado_turnia', 'mis_servicios_turnia', 'guardar_servicio_turnia', 'preparar_cuenta_turnia'
    )
  ), '[]'::jsonb),
  'turnos_activos_que_se_superponen', (select count(*) from intervalos where inicio < fin_anterior)
) as diagnostico_turnia;
