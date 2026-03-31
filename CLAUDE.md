# CLAUDE.md

**Comunicarse siempre en español con el usuario.**

@AGENTS.md

## Proyecto

Sinergia Life Tenis — Plataforma de gestión de torneos de tenis para Club Sinergia Life. Single-tenant. PRD completo en `docs/prd.md` (fuente de verdad). Este archivo se mantiene breve; actualizar a medida que se implementa.

## Tech Stack

- **Framework**: Next.js 16 (App Router) + React 19
- **Backend**: Prisma 6 + PostgreSQL (Neon serverless)
- **Auth**: NextAuth v5 (OTP email con Resend)
- **UI**: Tailwind CSS 4 + shadcn/ui (base-nova style)
- **Storage**: Vercel Blob (imágenes)
- **Timezone**: UTC en BD/servidor, America/Montevideo en UI/emails (usar `src/lib/date-utils.ts`)
- **Package Manager**: pnpm

## Architecture

```
UI (RSC by default) → Server Actions → Services → Prisma
                   ↘ API Routes (external only)
```

- Services en `src/services/*-service.ts` — única capa con Prisma. Funciones, no clases. Throw errors.
- Actions en `actions.ts` por ruta — validan con Zod, retornan `ActionResult<T>`, try-catch aquí.
- Validaciones en `src/lib/validations/*.ts`
- `"use client"` solo para interactividad. Suspense + Skeleton (no `loading.tsx`).
- Auth middleware en `src/proxy.ts`. No hay registro público.

### Roles
- `SUPERADMIN` — todo + invitar admins. Puede ser jugador.
- `ADMIN` — todo excepto invitar admins. Puede ser jugador.
- `PLAYER` — su panel, cargar resultados propios.

### Routes
- `/admin/*` — SUPERADMIN + ADMIN
- `/jugador/[playerId]` — público (perfil) + privado (panel). Sub-rutas requieren login.
- `/ranking`, `/fixture` — públicos
- `/perfil` — todos los roles

## Commands

```bash
pnpm dev          # Development server
pnpm build        # Production build
pnpm typecheck    # TypeScript type checking
pnpm lint         # ESLint
pnpm db:migrate   # Prisma migrate dev
pnpm db:generate  # Regenerate Prisma client
```

**Verificación:** `pnpm run typecheck` primero, luego `pnpm run build`.

## Database

Schema en `prisma/schema.prisma`. Modelos clave: User, Tournament, TournamentCategory, Player, Match, MatchResult, ImportedPlayer.

## Plan Mode

- Plan extremadamente conciso. Sacrificar gramática por concisión.
- Al final del plan, listar preguntas sin resolver.
