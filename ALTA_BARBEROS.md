# Registro de un barbero con local

Corrección en la rama `fix-barber-onboarding`.

## Activación

1. En Supabase SQL Editor ejecutar completo
   `supabase/migrations/20261125_alta_barbero.sql`.
2. Confirmar que finalice correctamente. No borrar cuentas, perfiles o políticas.
3. Integrar esta rama en `main` y esperar el despliegue.
4. Cerrar sesión y volver a entrar con la cuenta del barbero. Actualizar la
   pantalla de reserva: debe aparecer el local y su profesional activo.

## Funcionamiento

El registro de Auth guarda el nombre del local, pero por sí solo no garantiza
un perfil y un profesional visibles. El frontend llama a
`turnia_v2_preparar_cuenta()` con una sesión autenticada al registrarse con sesión,
al iniciar sesión o al recuperar una sesión existente.

- Si la cuenta no tiene perfil y tiene nombre de local válido en sus metadatos,
  crea una organización nueva, un perfil administrador y un profesional activo.
- Solo usa la identidad autenticada; no permite indicar un usuario, rol u
  organización ajenos. Los datos de organización o rol enviados en metadatos
  no conceden pertenencia ni permisos sobre locales existentes.
- Si ya existe perfil, mantiene su organización y rol. Un administrador sin
  profesional propio puede vincularse a uno nuevo dentro de su organización.
- Un profesional existente inactivo no se reactiva automáticamente. Una cuenta
  de empleado sin vínculo profesional requiere intervención del administrador.
- Un administrador sin servicios compatibles obtiene tres servicios iniciales
  asignados a su profesional: Corte ($4.500), Barba ($3.000) y Corte + barba
  ($7.000). No se reemplazan precios ni servicios existentes.
- El alta es transaccional y se serializa por usuario para evitar duplicaciones.

Si Supabase exige confirmación de email, primero se confirma el correo y luego
se inicia sesión para completar el alta. El local no aparece como activo solo
por haber enviado el formulario de registro sin una sesión válida.

El archivo agrega una función y su permiso de ejecución. No reemplaza las
políticas ni los triggers existentes. Es necesario aplicar el SQL antes de
activar el código nuevo en producción. El acceso remoto desde el chat sigue
sin estar verificado; las pruebas no crean cuentas en el proyecto real.
