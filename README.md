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

> La **primera cuenta** que se registra queda como **coordinadora** automáticamente.
> Las siguientes se crean como **profesionales** (un coordinador puede cambiar el rol).

## Puesta en marcha

### 1. Instalar dependencias

```bash
pnpm install
```

### 2. Crear el proyecto de Supabase y aplicar el esquema

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. En el panel de Supabase, abre **SQL Editor** y ejecuta el contenido de
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
   Esto crea las tablas (`profiles`, `cases`, `appointments`, `case_events`),
   los índices, las políticas de RLS y el trigger de creación de perfil.

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
