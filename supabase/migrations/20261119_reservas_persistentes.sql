-- REEMPLAZADA. La base real utiliza organizaciones y profesionales.
-- No ejecutar la versión anterior que creaba barberos o reemplazaba políticas.
-- Usar el archivo 20261119_organizaciones_profesionales.sql de esta misma carpeta.
do $$ begin
 raise exception 'Migración reemplazada: ejecutar 20261119_organizaciones_profesionales.sql';
end $$;
