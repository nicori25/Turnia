# Despliegue y Operación

Edición: 12 de noviembre de 2026. Versión 1.0. Documento para revisión.

## 8.1 Entorno de desarrollo

Objetivo: establecer un procedimiento reproducible para preparar, ejecutar y mantener Turnia. El proyecto es una SPA de Vue 3 y Vite con Supabase Auth; las reservas y la agenda todavía utilizan estado local en memoria.

Estado de referencia: la revisión previa registró una compilación exitosa y 19 comprobaciones de interfaz, con 16 aprobadas y 3 fallidas. Esta edición no vuelve a ejecutar esas pruebas ni acredita disponibilidad actual del servicio remoto.

Preparación desde /workspace/Turnia:
1. Revisar los cambios locales antes de instalar.
2. Ejecutar npm ci usando el package-lock.json existente.
3. Configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY sin imprimir sus valores.
4. Ejecutar npm run dev -- --host 127.0.0.1 --port 5173 --strictPort.
5. Verificar renderizado, navegación, selección de servicio y total en un navegador.

En la ejecución anterior se utilizaron Node 24.22.1 y npm 11.9.0. Son versiones observadas, no un requisito formal fijado en el repositorio. Mantener el checkout existente; no crear un worktree para una puesta en marcha rutinaria.

Elemento | Requisito
Configuración | Variables VITE_* visibles en el navegador. Usar clave pública; nunca service_role.
Acceso externo | Permitir el dominio exacto del proyecto Supabase. La consulta anterior quedó bloqueada por un 403 del proxy.
Documentación | El README menciona .env.example, pero ese archivo no estaba incluido en la revisión.

## 8.2 Producción y 8.3 Publicación del sistema

Entorno propuesto: alojamiento estático con HTTPS para los archivos generados por Vite y proyecto Supabase separado para pruebas y producción. No se ha confirmado proveedor de alojamiento, dominio público ni despliegue productivo.

Generación: npm run build. Por defecto se genera dist/. Revisar la salida antes de publicarla. npm run preview sirve para revisión local de la compilación; no sustituye a un servidor de producción.

Las variables VITE_* se incorporan a la compilación. Un cambio de URL o clave pública exige volver a generar el frontend. No incorporar contraseñas ni claves de servicio al bundle.

Lista previa a publicar:
1. Revisar cambios y corregir fallos que bloqueen la entrega.
2. Compilar y probar el artefacto en un entorno de pruebas.
3. Configurar HTTPS y fallback a index.html para rutas de Vue Router.
4. Validar rutas directas, sesión y cierre de sesión contra Supabase real.
5. Revisar URLs de retorno y confirmación de email del proyecto.
6. Registrar versión y artefacto anterior para recuperación.
7. Obtener autorización de publicación y desplegar.
8. Ejecutar pruebas de humo sobre el destino.

No ejecutar supabase/schema.sql a ciegas sobre un proyecto existente: comprobar tablas, políticas y datos, preparar migración y respaldo. La existencia de un archivo SQL no acredita su aplicación remota.

Condición de salida: las reservas persistentes, la prevención de duplicados y las notificaciones siguen pendientes. No anunciar un servicio de reservas plenamente operativo mientras esas funciones no estén implementadas y probadas. Publicar el entorno de desarrollo tampoco equivale a publicar la aplicación.

## 8.4 Monitoreo y 8.5 Mantenimiento

No se verificó un monitoreo productivo configurado. Se propone observar disponibilidad de la web, errores JavaScript, fallos de autenticación y, una vez implementada, la tasa de errores de reserva. Definir responsables y umbrales después de medir una línea de base.

Frecuencia propuesta | Actividad
Antes de cada entrega | Compilación, regresión funcional, revisión de variables públicas, políticas y cambios de esquema.
Semanal | Revisión de errores e incidentes y estado de dependencias.
Mensual | Revisión de permisos, dependencias y necesidad de actualizaciones.
Según objetivo de recuperación | Respaldo de datos y restauración de prueba. Frecuencia, retención y proveedor por definir.

Procedimiento ante incidentes:
1. Registrar hora, síntoma, versión e impacto sin exponer datos personales.
2. Diferenciar fallo del frontend, red, autenticación o base de datos.
3. Probar una operación de solo lectura y consultar evidencias autorizadas.
4. Aplicar una corrección verificable o restaurar el artefacto anterior.
5. Repetir las pruebas afectadas y documentar causa y resolución.

Rollback del frontend: conservar la versión previa y volver a desplegarla si es compatible con el esquema actual. Cambios de datos requieren un plan separado; revertir archivos estáticos no revierte una migración.

Respaldo: definir RPO y RTO con el responsable del proyecto; no hay valores acordados. Verificar las capacidades contratadas de Supabase y probar restauración en un entorno aislado. Los datos mantenidos solo en memoria por este prototipo no cuentan con persistencia ni recuperación.

Privacidad: evitar claves, contraseñas y teléfonos completos en logs; limitar acceso y conservación. Estas acciones son procedimientos propuestos y no se presentan como controles ya desplegados.
