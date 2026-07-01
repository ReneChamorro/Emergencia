# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # dev server on :5173
pnpm build        # tsc -b && vite build
pnpm lint         # eslint . --ext ts,tsx
pnpm preview      # preview production build
```

Package manager is **pnpm** — never use npm or yarn.

## Environment

Copy `.env.example` to `.env.local` and fill in:
```
VITE_SUPABASE_URL=https://trvzysvkmpotrieftwua.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```
The Supabase client (`src/lib/supabase.ts`) falls back to placeholder values when vars are missing (prevents white-screen on load), but the app won't work without real credentials.

## Architecture

### Frontend
- **`@` alias** → `src/` (configured in `vite.config.ts`)
- **Auth**: `src/context/AuthContext.tsx` holds `session`, `profile` (from `profiles` table), and `loading`. Wrap consumers in `<AuthProvider>`. Route guards live in `src/components/ProtectedRoute.tsx`.
- **Routes**: `/` public intake, `/login`, `/coordinador` (coordinator only), `/profesional` (professional or coordinator).
- **UI components**: `src/components/ui/` are hand-written Radix UI primitives (no shadcn CLI). Add new primitives there following the same pattern.
- **Icons**: Lucide only (`lucide-react`). No other icon libraries.

### Supabase / Database
- No Supabase CLI is used. Apply migrations manually in the **Supabase SQL Editor**.
- Migrations are in `supabase/migrations/` numbered 0001–0006.
- The **`profiles`** table extends `auth.users`. All accounts start as `professional`; promote to `coordinator` manually.
- **`availability_blocks.day_of_week`** uses 0=Monday … 6=Sunday (not JS's 0=Sunday). Helper `dateToDayOfWeek` in `calendarUtils.ts` converts JS dates correctly.

### Row-Level Security (RLS) model
| Actor | Cases | Appointments | Profiles |
|---|---|---|---|
| anon | INSERT only (restricted fields) | — | — |
| coordinator | full CRUD | full CRUD | full CRUD |
| professional | SELECT/UPDATE where `assigned_professional_id = auth.uid()` | SELECT/UPDATE own + INSERT follow-ups for own assigned cases | own row only |

The `is_coordinator()` SECURITY DEFINER function (in migration 0001) is used in RLS policies to avoid recursion. Do not replace it with inline role checks.

**Critical**: A case's `assigned_professional_id` must be set for the professional to see it via RLS. When creating an appointment via the coordinator calendar, the case must also be updated to set `assigned_professional_id`.

### Key libraries
| Library | Where used |
|---|---|
| `react-hook-form` + `zod` | Forms (Intake, AddCaseDialog). Schemas in `src/lib/validation.ts` |
| `tailwind-merge` + `clsx` → `cn()` | `src/lib/utils.ts` — use `cn()` for conditional classes |
| `react-router-dom` v6 | Routing in `src/App.tsx` |

### Shared logic files
- **`src/lib/domain.ts`**: label maps (`URGENCY_LABEL`, `STATUS_LABEL`, etc.), badge class maps, `formatDateTime`, `formatDate`. Import labels from here — never hardcode Spanish strings in components.
- **`src/lib/calendarUtils.ts`**: pure date helpers, calendar grid generation, hour-slot splitting (`blockToHourSlots`, `buildHourSlots`), `timeInRange`, grouping helpers. No external calendar library.
- **`src/lib/validation.ts`**: `sanitizeText` (codepoint loop, not regex — encoding-safe), `sanitizePhone`, `intakeSchema`, `manualCaseSchema`, `LIMITS`.

### Styling
- Tailwind 3 with CSS variable tokens: `--primary`, `--accent`, `--destructive`, `--success`, `--warning` (defined in `src/index.css` as HSL values).
- Color palette: dark blue + white with lighter blue accents — clinical/neutral theme.
- Minimum touch target: 44 px. Use `size-4` / `size-5` for icons.

### Modality options
Presencial (in-person) has been removed. Use only `["videollamada", "llamada"]` as `ApptModality` values everywhere appointments are created or displayed.
