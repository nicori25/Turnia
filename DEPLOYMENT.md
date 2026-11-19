# Hosting de main en GitHub Pages

El workflow `.github/workflows/deploy-pages.yml` compila y publica el frontend al
actualizar `main` o ejecutarlo manualmente. Sube únicamente `dist`, no la carpeta
de documentos ni el código fuente. Activar este workflow no acredita un despliegue
exitoso: comprobar su ejecución y la URL que devuelve GitHub.

## Configuración de GitHub

1. En Settings → Pages, seleccionar **GitHub Actions** como origen. La cuenta y
   el plan del repositorio deben permitir GitHub Pages; no cambiar su visibilidad
   para habilitarlo sin una decisión del propietario.
2. En Settings → Secrets and variables → Actions, configurar
   `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` como variables o secretos.
   Usar la URL del proyecto y su clave pública anon; nunca service_role.
   Las variables VITE se incluyen en los archivos públicos del navegador incluso
   si se almacenan como secretos de Actions.
3. Ejecutar **Deploy main to GitHub Pages** y revisar los jobs build y deploy.
4. Abrir la URL que informa el job deploy y probar inicio, selección, recarga y
   acceso administrativo. Para este repositorio, la ruta esperada, todavía no
   verificada, es `https://nicori25.github.io/Turnia/`.

GitHub Pages no ofrece reescrituras para la SPA. El build de Pages activa
`VITE_ROUTER_MODE=hash`; las rutas toman la forma `/Turnia/#/reservar` y funcionan
al recargar. Los demás builds mantienen el historial normal y usan BASE_URL.

## Supabase

Permitir en Supabase la URL de origen y los retornos de autenticación necesarios
para el sitio. Probar login, logout y confirmación de email con una cuenta de
pruebas. No aplicar automáticamente el esquema SQL ni crear usuarios reales.

Publicar el frontend no implementa reservas persistentes, disponibilidad,
prevención de doble reserva ni notificaciones. La agenda sigue usando datos de
ejemplo y mantiene los defectos documentados.

## Validación local

Con las dos variables Supabase presentes:

```bash
VITE_ROUTER_MODE=hash npm run build -- --base /Turnia/
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

Verificar el recorrido de reserva en `/Turnia/` y las rutas con hash. No asumir
que un proceso local proporciona hosting público permanente.
