# Invitación interactiva de cumpleaños

Experiencia web mobile-first construida con Angular 22, TypeScript estricto, Tailwind CSS y Supabase. La invitación cuenta una historia en seis escenas, recuerda la respuesta del visitante, permite modificarla y ofrece un panel administrativo protegido.

## Funcionalidades

- Sobre con apertura animada, narrativa navegable y opción de saltar la introducción.
- Retrato real reemplazable en `public/assets/images/cumpleanera.webp`.
- Detalles del evento, mapa, cuenta regresiva, Google Calendar y archivo `.ics`.
- RSVP idempotente con estados positivo/negativo, acompañantes y recuperación local.
- Enlaces personalizados `/i/:token` con tokens aleatorios; sólo se guarda SHA-256 en la base.
- Panel `/admin` con Supabase Auth, estadísticas, filtros, creación de enlaces y exportación CSV segura.
- RLS, privilegios mínimos, Edge Functions, validación de servidor y rate limiting.
- Responsive desde 320 px, foco visible, etiquetas reales y `prefers-reduced-motion`.

## Desarrollo local

Requisitos: Node.js 22.22.3 o superior y npm/pnpm.

```bash
npm install
copy .env.example .env.local
npm start
```

Variables necesarias en `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://TU_PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_REEMPLAZAR
```

Estas dos variables son públicas por diseño: se incluyen en el bundle del navegador. Nunca agregues `service_role` al frontend ni a `.env.local`.

Si no hay configuración, la UI se puede recorrer en modo visual, pero jamás mostrará una confirmación falsa. El RSVP sólo termina en éxito cuando la Edge Function confirma el guardado.

## Configurar Supabase

El proyecto de Supabase suministrado ya está referenciado en `supabase/config.toml`. Para desplegar desde una terminal autenticada:

```bash
npx supabase login
npx supabase link --project-ref flumerysbrwhcobammwe
npx supabase db push
npx supabase functions deploy invitation-api --no-verify-jwt
npx supabase functions deploy admin-api
```

La migración `supabase/migrations/202611030001_initial_schema.sql` crea las tablas, RLS, políticas, rate limit y el evento inicial.

### Crear el administrador

1. En Supabase Dashboard abre **Authentication → Users** y crea el usuario con correo y contraseña.
2. Copia su UUID.
3. En el SQL editor ejecuta, reemplazando el UUID:

```sql
insert into public.admin_users (user_id)
values ('UUID_DEL_USUARIO');
```

La ruta `/admin` valida tanto la sesión de Auth como la pertenencia a `admin_users` dentro de la Edge Function.

## Pruebas

```bash
npm run build
npm test
npx playwright install chromium
npm run e2e
```

Los flujos E2E interceptan la Edge Function para verificar apertura, navegación, RSVP, recuperación, enlace inválido, fallo de red, autenticación y ausencia de overflow sin escribir datos reales.

## Publicar en Vercel

1. Importa el repositorio en Vercel.
2. Registra `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Vercel usará `npm run build` y publicará `dist/invitacion-cumple/browser` según `vercel.json`.
4. Configura el dominio público en la allow-list de Supabase Auth.

Las rutas SPA (`/i/:token` y `/admin`) ya tienen rewrite a `index.html`.

## Contenido configurable

- Valores de respaldo frontend: `src/app/config/event.config.ts`.
- Valores persistentes: registro de `public.events` en Supabase.
- Fotografía: reemplaza `public/assets/images/cumpleanera.webp` conservando el nombre.
- Música: establece `music_url` en `events`. Si está vacía, el control no aparece.
- Nombre y edad se mantienen opcionales, tal como se solicitó.

## Seguridad y privacidad

Las tablas no tienen permisos anónimos. Las operaciones públicas pasan por `invitation-api`; el navegador conserva un token de recuperación aleatorio en `localStorage` y la base sólo guarda su hash. Borrar los datos del navegador elimina esa recuperación local, salvo que el visitante conserve un enlace personalizado. El administrador puede eliminar una invitación y su RSVP asociado mediante borrado en cascada.
