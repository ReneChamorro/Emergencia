# Apoyo Psicológico de Emergencia

App web para coordinar atención psicológica de emergencia tras un terremoto.
Una sola puerta de entrada → triaje y coordinación → asignación a un profesional → seguimiento del caso.

Atención **focalizada en crisis** (1 a 3 contactos iniciales), no terapia indefinida.

## Stack

- **Frontend:** React + TypeScript + Vite
- **Estilos:** Tailwind CSS (tema clínico azul oscuro + blanco) + componentes accesibles estilo shadcn/ui (Radix)
- **Backend:** Supabase (Postgres + Auth + Row Level Security)
- **Gestor de paquetes:** pnpm

## Roles

- **Paciente:** usa el formulario público (`/`), sin necesidad de cuenta.
- **Coordinador ("secretaria"):** revisa la bandeja, fija urgencia, asigna profesional y agenda citas (`/coordinador`).
- **Profesional:** ve solo sus casos asignados, registra contactos y actualiza el estado (`/profesional`).

> Por seguridad, **todas las cuentas nuevas se crean como `professional`**.
> El primer coordinador se promueve manualmente una vez (ver paso 2).

## Puesta en marcha

### 1. Instalar dependencias

```bash
pnpm install
```

### 2. Crear el proyecto de Supabase y aplicar el esquema

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. En el panel de Supabase, abre **SQL Editor** y ejecuta **en orden**:
   1. [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) — tablas
      (`profiles`, `cases`, `appointments`, `case_events`), índices, RLS y trigger.
   2. [`supabase/migrations/0002_security.sql`](supabase/migrations/0002_security.sql) —
      endurecimiento: límites de longitud/rango, intake anónimo restringido, lectura de
      perfiles limitada, y bloqueo de escalada de privilegios. Es idempotente (seguro de
      re-ejecutar).
Luego **promueve al primer coordinador** (una vez). Regístrate primero en `/login`
con ese correo para que exista la cuenta, y ejecuta en el SQL Editor:

```sql
update public.profiles
set role = 'coordinator'
where id = (select id from auth.users where email = 'TU-CORREO@ejemplo.com');
```

### 3. Configurar variables de entorno

Copia `.env.example` a `.env.local` y completa con los datos de tu proyecto
(**Settings → API** en Supabase):

```
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-public-key
```

### 4. Levantar el entorno de desarrollo

```bash
pnpm dev
```

Abre <http://localhost:5173>.

## Flujo de uso

1. La persona afectada entra a `/` y completa el formulario (datos, situación, triaje, consentimiento).
2. El triaje sugiere la **urgencia**; si hay riesgo alto (peligro inmediato o ideación de autolesión)
   se muestra un **banner de crisis** con líneas de emergencia.
3. El coordinador entra a `/coordinador`, revisa la bandeja (ordenada por urgencia),
   ajusta la urgencia/estado, asigna un profesional y agenda la cita.
4. El profesional entra a `/profesional`, ve sus casos, contacta por WhatsApp,
   registra el seguimiento y marca el estado de las citas.

## Modelo de datos

Ver [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) y los tipos en
[`src/types/database.ts`](src/types/database.ts).

## Seguridad

El modelo de datos es sensible (salud mental), así que la seguridad se aplica en
**varias capas**:

- **RLS (Postgres) como fuente de verdad.** El cliente solo lleva la `anon key`
  (pública por diseño). El acceso real lo deciden las políticas, no el frontend:
  - El **anónimo** solo puede *insertar* solicitudes nuevas (`status='nuevo'`, sin
    asignar, sin notas); no puede leer ningún caso.
  - El **profesional** solo ve y edita los casos asignados a él.
  - El **coordinador** ve y gestiona todo.
- **Anti escalada de privilegios:** un profesional no puede ascenderse a coordinador
  (trigger en `profiles`). El primer coordinador se promueve a mano una vez.
- **Anti fuga de PII:** la lista de perfiles (teléfonos, especialidad) solo es legible
  por coordinadores y por el propio usuario.
- **Sanitización + validación** de todos los campos del intake con `zod`
  ([`src/lib/validation.ts`](src/lib/validation.ts)): se quitan caracteres de control,
  se limita la longitud y se valida el formato del teléfono. La BD repite los mismos
  límites como `CHECK` (defensa en profundidad).
- **Freno de abuso:** máx. 5 solicitudes por número de WhatsApp por hora.
- **XSS:** React escapa todo el contenido; el único enlace con datos del usuario
  (`wa.me`) se construye solo con dígitos.

### Limitaciones conocidas / recomendado para producción

- **Rate-limit por IP / CAPTCHA:** el freno actual es por número y no detiene un
  flooding con números variados. Para producción, poner un CAPTCHA (p. ej. Cloudflare
  Turnstile) en el formulario o un proxy con rate-limit por IP delante del REST.
- **Registro público:** cualquiera puede crear una cuenta de profesional. Una vez
  formado el equipo, conviene **desactivar el signup público** en *Authentication →
  Providers* de Supabase (o exigir confirmación por correo).
- Mantener el MCP de Supabase en **read-only** salvo cuando se necesite aplicar cambios.

## Scripts

| Comando | Acción |
| --- | --- |
| `pnpm dev` | Servidor de desarrollo |
| `pnpm build` | Type-check + build de producción |
| `pnpm preview` | Sirve el build de producción |

## Pendiente (fase posterior)

- Avisos automáticos por WhatsApp / correo al asignar o agendar.
- Configurar los números de las líneas de crisis según la localidad
  (en [`src/components/CrisisBanner.tsx`](src/components/CrisisBanner.tsx)).
