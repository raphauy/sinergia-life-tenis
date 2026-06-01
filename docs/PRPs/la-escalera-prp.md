# PRP: La Escalera

> Feature post-MVP. Roadmap de fases en [`la-escalera-roadmap.md`](./la-escalera-roadmap.md). Términos canónicos en [`docs/context.md`](../context.md) (sección "La Escalera"). Decisión arquitectónica en [ADR 0001](../adr/0001-match-polimorfico-escalera.md). Fecha de diseño: 2026-05-30.

## Goal

Construir **La Escalera**: una liga permanente de desafíos sobre un **ranking ELO único** que se mueve con cada partido y nunca termina. Reemplaza al torneo como actividad central del club. El premio por participar es **reservar cancha con anticipación** por nuestra app.

## Why

- **Enganche/adherencia** de socios: que se juegue todo el año, no solo en torneos puntuales. Es el objetivo de producto nº1.
- Le da **sentido competitivo** a cada partido (suma a un ranking vivo).
- **Premia jugar, no solo ganar**: el que participa tiene cancha asegurada y no se desploma por una derrota; la inactividad cuesta.
- Reutiliza casi todo el motor ya construido (partido, reserva, resultado, calendario, fixture, perfil), así que el costo incremental es acotado.

## What + success criteria

Una escalera única ordenada por **Rating** (ELO). Los miembros se **retan** entre sí; al aceptarse un reto se genera un partido que reusa el flujo existente; al cargar el resultado el rating de ambos se ajusta (suma-cero). Un **mínimo mensual** de partidos jugados mantiene el rating: no llegar aplica una **penalización de puntos** (multa) al cierre del mes. La reserva **no** se gatea por actividad — cualquiera de los dos jugadores de un partido de escalera puede reservar con anticipación.

**Éxito:**
- La escalera única, sembrada con los ~41 del primer torneo, es visible públicamente y se reordena sola con cada resultado.
- El ciclo `reto → reserva → partido → resultado → cambio de rating` funciona de punta a punta.
- La actividad mensual gobierna la **penalización de puntos** (no el acceso a reservar).
- El módulo de torneos sigue funcionando intacto tras volver `Match` polimórfico.

---

## Decisiones cerradas

> Tabla firme — no re-discutir en implementación. La columna vertebral está **aprobada por Mati** (2026-05-30). Los números configurables tienen defaults aprobados y son ajustables en la fila `Ladder`.

| # | Decisión | Resolución |
|---|---|---|
| 1 | Estructura del ranking | **Una sola escalera** (A/B/C dejan de usarse como agrupación; solo seed inicial). |
| 2 | Modelo de puntos | **ELO suma-cero**, K=24 de arranque. Nadie se desploma por una derrota. |
| 3 | Compromiso | **Penalización mensual** por no llegar al mínimo (no decaimiento continuo aparte). |
| 4 | Temporadas | **Ranking continuo, sin reset** ni campeón. |
| 5 | Posición en la app | La Escalera es el **módulo principal**; torneos quedan como archivo reutilizable; la vista pública principal pasa a la escalera. |
| 6 | Arquitectura | **Entidades propias** (`Ladder`/`LadderMember`/`Challenge`/`RatingHistory`) + **`Match` polimórfico** (ver ADR 0001). Reusa motor `Match`/`MatchResult`/`SlotReservation`. |
| 7 | Membresía | `LadderMember` **siempre con `User`** (cuenta obligatoria). Admin agrega; sin auto-registro. Inactivo conserva su rating. |
| 8 | Rating de miembro nuevo (post-seed) | Admin lo fija al agregar; **default = rating más bajo actual** (entra por abajo). |
| 9 | Reto | Estados `PROPOSED→ACCEPTED|REJECTED|EXPIRED|CANCELLED`. Se reta a **cualquiera**. Rechazar es **libre**. Ventana de respuesta ~4 días (config). Sin fecha/cancha; al aceptar genera `Match PENDING`. |
| 10 | Anti-spam | **Cap de retos abiertos simultáneos** (default 2) + **máximo de retos iniciados/mes** (default 4), ambos config. |
| 11 | Aplicación de ELO | Al pasar el partido a `PLAYED`, con los ratings del momento. `RatingHistory` con `ratingBefore`/`ratingAfter`/`delta`. Preview a ambos antes de aceptar. |
| 12 | Walkover | **ELO-neutral** (delta 0). Al ausente se lo castiga en la capa de actividad, no en el rating. |
| 13 | Editar resultado | **Delta local**: recalcular el delta de ese partido con los ratings guardados y aplicar la diferencia al rating actual. Sin replay. |
| 14 | Cierre de mes | **Vercel cron** idempotente (1º de mes 00:00 UY). Mes = calendario UY. Cuenta partidos, aplica penalización, recalcula elegibilidad. |
| 15 | Premio (reserva) | Acceso a reservar **anticipado por nuestra app** (hasta `reservationLeadDays`), inherente a tener partidos de escalera. **No se gatea** por actividad ni por puesto; cualquiera de los dos jugadores reserva. La inactividad cuesta **puntos** (decisión #3), no el acceso. Reserva sigue **semiautomática** (Mati confirma). _(Corrige el diseño previo de `priorityEligible`; ver §"Fase 3".)_ |
| 16 | Seed inicial | Propuesto desde el resultado del 1er torneo; el admin **confirma/reordena** el 1‑41 antes de bloquear. Escalón −20/puesto, A>B>C (1500→700). |

### Números configurables (defaults aprobados con Mati; ajustables en la fila `Ladder`)

| Parámetro | Default | Campo |
|---|---|---|
| K (volatilidad ELO) | 24 | `kFactor` |
| Escalón seed | −20/puesto | `seedStep` |
| Mínimo de partidos/mes | 2 | `minMatchesPerMonth` |
| Penalización por no llegar | −50 | `monthlyPenalty` |
| Máximo de retos iniciados/mes | 4 | `maxChallengesPerMonth` |
| Cap de retos abiertos en simultáneo | 2 † | `maxOpenChallenges` |
| Ventana de respuesta | 4 días | `acceptanceWindowDays` |
| Anticipación de reserva | 30 días † | `reservationLeadDays` |
| Cooldown de revancha | 3 días † | `rematchCooldownDays` (nuevo en Fase 2) |
| Plazo del partido pendiente | 3 días † | `matchScheduleDeadlineDays` (nuevo en Fase 2) |
| Formato de partido de escalera | SINGLE_SET † | `matchFormat` en `Ladder` (nuevo en Fase 2) |

† Defaults razonables, no especificados explícitamente por Mati; ajustables.

---

## Fase 2 — diseño cerrado (grill-me 2026-05-31)

> Refina el alcance de Fase 2 del roadmap. Decisiones de implementación/UX cerradas con el usuario; complementan (no reemplazan) la tabla de decisiones de fondo. Lenguaje sin cambios (no hubo términos nuevos). Sin ADR nuevo (todo reversible; el 0001 cubre lo arquitectónico).

### Ciclo del reto

- **Entrada del reto:** botón "Retar" en cada fila de La Escalera **y** en el perfil del rival (`/jugador/[slug]`). Abre diálogo con preview ELO + confirmación.
- **Bandeja de retos:** sección "Retos" dentro del panel del jugador (`/jugador/[slug]`), arriba de "Próximos partidos". Orden por urgencia: recibidos (aceptar/rechazar) → enviados (cancelar/esperando) → próximos partidos (donde cae el partido al aceptarse). Visible solo al dueño/admin.
  - Deuda futura (fuera de alcance): el panel cuelga de `Player` (torneo). Funciona porque los ~41 sembrados tienen `Player`. Un miembro sin torneo exigiría mover el panel a un perfil sobre `User`.
- **Elegibilidad:** retador y retado deben ser `LadderMember` **activos**; nunca a uno mismo. El botón "Retar" aparece solo logueado, siendo miembro activo, sobre **otro** miembro activo.
- **Cap de abiertos (`maxOpenChallenges`, 2):** cuenta retos donde el actor es **retador** y están en `PROPOSED` **o** `ACCEPTED` con partido sin jugar (`Match.status ∈ {PENDING, CONFIRMED}`). Recibir retos no consume cupo. (Predicado exacto del cap.)
- **Máx. mensual (`maxChallengesPerMonth`, 4):** retos iniciados (creados) dentro del mes calendario UY corriente, sin importar desenlace.
- **Un solo reto activo por par:** si ya existe un reto vivo entre A y B (en cualquier dirección), no se crea otro. Cubre duplicado y cruzado.
- **Cooldown de revancha (`rematchCooldownDays`, default 3):** tras un partido jugado entre A y B, no se puede re-retar al mismo rival hasta pasado el cooldown. Campo nuevo en `Ladder`.
- **Expiración perezosa (sin cron en Fase 2):** al leer la bandeja y al validar caps, todo `PROPOSED` con `respondByAt < now` pasa a `EXPIRED` en el acto. `respondByAt = proposedAt + acceptanceWindowDays`. Sin email de expiración.

### Partido de escalera

- **Al aceptar** → `Match` PENDING con `ladderId` + `challengeId` (`tournamentId`/`categoryId` null), `player1` = retador, `player2` = retado.
- **Formato:** `SINGLE_SET`, en campo nuevo `matchFormat` en `Ladder` (default `SINGLE_SET`; configurable).
- **Agendado:** reusa el flujo existente — cualquiera de los dos pide `SlotReservation` desde su panel → Mati confirma (`CONFIRMED` + email) → cargar resultado.
- **Disponibilidad de canchas global:** generalizar `getMonthMatches`/`getReservationsByMonth` para no exigir `tournamentId` (canchas físicas compartidas torneo+escalera). Aplica también al cálculo de slots libres del torneo.
- **Detalle del partido** (`/jugador/[slug]/partidos/[matchId]`): resolver el `TODO Fase 2` — si `ladderId`, encabezar "La Escalera" (no torneo/categoría), usar `ladder.matchFormat`, calendario global.
- **Partido pendiente que no se concreta:** cancelable manualmente por cualquiera de los dos o admin → `Match.CANCELLED`, **no** mueve ELO, libera cupo. Banner lazy "coordinen o cancelen" pasados `matchScheduleDeadlineDays` (campo nuevo, default 3) desde la aceptación. Email pre-vencimiento + auto-cancelación → **Fase 3** (sobre su cron). El banner de Fase 2 no promete fecha dura de auto-cancelación.

### ELO y feedback

- **Preview ELO** ("si ganás +X / si perdés −Y", desde la perspectiva del actor) en los diálogos de **retar** y **aceptar**; no en el partido ya agendado (el rating pudo moverse; se fija recién al `PLAYED`).
- Aplicación al `PLAYED`, suma-cero con redondeo, walkover neutral y edición por **delta local**: según el blueprint y la tabla de decisiones de fondo (sin cambios). Todo condicionado a `ladderId != null`.
- Al cargar resultado se muestra el delta a cada jugador; en el detalle del partido jugado se ven ambos deltas (`RatingHistory`).

### Emails (reusan la infra existente)

Reto recibido → retado · Reto aceptado → retador · Reto rechazado → retador · Partido cancelado → el otro jugador. La confirmación de partido reusa el template existente, adaptado para nombrar "La Escalera" cuando el partido es de escalera.

### Admin (Fase 2)

- **Editor de config del `Ladder`** por UI en `/admin/escalera` (kFactor, ventanas, caps, cooldown, plazo, formato, penalización…). A aterrizar en plan: `seedBaseRating`/`seedStep` probablemente read-only una vez sembrada.
- **Monitoreo** de retos vivos y partidos de escalera en admin (estado, quién a quién, vencimientos, acción de cancelar).

### Fuera de alcance de Fase 2

- Registro directo de partido por admin sin reto previo (fase posterior).
- Gating de reserva por `priorityEligible`, penalización mensual e infra de cron (Fase 3).

### Cambios de schema (migración nueva en Fase 2)

Tres columnas en `Ladder`: `matchFormat MatchFormat @default(SINGLE_SET)`, `rematchCooldownDays Int @default(3)`, `matchScheduleDeadlineDays Int @default(3)`. (Excepción a "todo el schema se migró en Fase 1": estos no existían.)

---

## Fase 3 — diseño cerrado (grill-me 2026-06-01)

> Refina y **corrige** el alcance de Fase 3. La corrección de fondo (penalización = puntos, reserva no gateada) está arriba en decisión #15 y en el glosario. Decisiones de implementación/UX cerradas con el usuario.

### Corrección de modelo (reemplaza el diseño previo de "reserva gateada")

- La **Penalización mensual** es **solo puntos de Rating** (multa). **No** afecta el acceso a reservar ni a retar.
- La **reserva** no se gatea por actividad: **cualquiera de los dos** jugadores de un partido de escalera puede reservar con anticipación (el tope `reservationLeadDays` ya vive en `Ladder`). El beneficio es inherente a tener partidos de escalera.
- Los dos topes mensuales son **independientes**: `maxChallengesPerMonth` (máximo de retos iniciados → "poder retar", ya en Fase 2) y `minMatchesPerMonth` (mínimo de jugados → multa de puntos, esta fase).
- Se **elimina** `LadderMember.priorityEligible` (sin uso).

### Alcance de cron (decidido)

Fase 3 = roadmap **+ diferidos de Fase 2**. Vercel **Pro**. **Dos crons separados** declarados en `vercel.json`:
- `/api/cron/ladder-month-close` — schedule `0 3 1 * *` (00:00 UY del 1º).
- `/api/cron/ladder-daily` — schedule `0 4 * * *` (~01:00 UY).

Auth: env `CRON_SECRET`; Vercel manda `Authorization: Bearer $CRON_SECRET`; la ruta valida. `/api/cron` se agrega a `publicRoutes` en `proxy.ts` (el secret lo chequea la ruta, no el middleware). La lógica vive en funciones de servicio reutilizables por la ruta del cron **y** por acciones de admin (disparo manual).

### Cierre mensual (`closeLadderMonth(ladderId, year, month)`)

- **Mes a cerrar**: el recién terminado en UY. **Sin backfill**: cada corrida cierra solo ese mes (mayo 2026 no se auto-cierra; el 1º real de cierre será 1‑jul para junio).
- **Idempotencia**: se intenta crear `LadderPeriodClose(ladderId, year, month)`; si choca el `@@unique`, ya estaba cerrado → abortar. Todo el cierre (multas + insert) en **una transacción**.
- **Conteo por miembro activo** (`isActive`): partidos `Match` `PLAYED` con `ladderId`, `playedAt` dentro del mes UY, donde el miembro fue `player1`/`player2`. En **walkover** el ganador suma, el ausente (no-ganador) **no**. `CANCELLED` no cuenta.
- **Gracia de alta**: si `joinedAt` cae en el mes que se cierra, el miembro **no** se penaliza ese mes (recién se le exige el mínimo desde el primer mes calendario completo).
- **Multa**: si jugados < `minMatchesPerMonth` → restar `monthlyPenalty` (positivo en BD, se resta) con **piso** `Ladder.ratingFloor` (default 0): el delta aplicado = `-min(monthlyPenalty, rating - ratingFloor)`. Se registra `RatingHistory` reason `PENALTY` con `ratingBefore`/`ratingAfter`/`delta`. Si el delta resulta 0 (ya en el piso), no se escribe fila ni se emaila.
- La multa es un **sumidero** (deflaciona el total a propósito; no es suma-cero). El piso solo aplica a la multa, **nunca** a los deltas de partido.
- **Email de multa**: a cada miembro penalizado, con el descuento y el nuevo rating.

### Cron diario (`runLadderDailyTasks`)

Tres tareas independientes (try/catch por tarea para que una falla no bloquee al resto):
1. **Expirar retos**: `Challenge` `PROPOSED` con `respondByAt < now` → `EXPIRED`. **Sin email**. Se mantiene además la expiración perezosa actual (cron como backstop).
2. **Aviso pre-vencimiento de partido**: a **ambos** jugadores, ~**1 día antes** del plazo (`plazo = match.createdAt + matchScheduleDeadlineDays`; avisar cuando el plazo cae dentro de las próximas 24h). Determinístico (se manda una sola vez sin campo extra en `Match`). Solo para `PENDING` **sin** `SlotReservation`.
3. **Auto-cancelar partido vencido**: `Match` `PENDING` con `ladderId`, **sin ninguna** `SlotReservation`, pasado el plazo → `CANCELLED`. Si ya hay reserva pedida (aunque sin confirmar), **no** se cancela (la pelota está en Mati). Email de cancelación a ambos. El cap de retos abiertos se libera solo (el predicado de Fase 2 deja de contar el match `CANCELLED`). El `Challenge` queda `ACCEPTED` (histórico), igual que en la cancelación manual de Fase 2; el par queda libre para re-retarse (no hubo partido jugado → sin cooldown).

- **Aviso pre-cierre de mes** (parte del diario): faltando `Ladder.monthlyWarningLeadDays` (default 3) días para fin de mes UY, email a cada miembro activo **bajo** el mínimo (respeta la gracia de alta). Dispara en un único día del mes → una sola vez, best-effort.

### Feedback de estado mensual (panel del jugador)

- Badge en `/jugador/[slug]` (cerca de la bandeja de retos), visible solo al dueño/admin. Estados **en vivo** (contando partidos del mes corriente del viewer):
  - **Al día** — jugados ≥ `minMatchesPerMonth`.
  - **En riesgo** — jugados < mínimo, mes en curso ("jugaste X/2 este mes").
  - **Penalizado** — el último cierre le aplicó multa (muestra −X y el rating resultante).

### Admin (Fase 3)

- **Disparo manual** de ambos crons: botón "cerrar mes" (selector de período, default el mes recién terminado; idempotente) y botón "correr tareas diarias". Útil para validar la fase y recuperarse de fallas del cron.
- **Visibilidad**: resumen liviano de "último cierre" en el monitoreo de escalera de Fase 2 (si sale barato); el detalle ya es observable vía `RatingHistory` (`PENALTY`) y el ranking.

### Cambios de schema (migración nueva en Fase 3)

En `Ladder`: agregar `ratingFloor Int @default(0)` y `monthlyWarningLeadDays Int @default(3)`.
En `LadderMember`: **eliminar** `priorityEligible`.

### Emails nuevos (reusan la infra existente)

Multa aplicada → miembro penalizado · Aviso pre-cierre → miembro bajo mínimo · Aviso pre-vencimiento de partido → ambos jugadores · Partido auto-cancelado → ambos jugadores.

### Fuera de alcance de Fase 3

- Cualquier gating de reserva por actividad (eliminado del diseño).
- Automatización de la reserva en la app del club (sigue manual de Mati).
- Reversión/re-cierre de un mes ya cerrado (el guard lo bloquea; corrección manual queda fuera).
- Gamificación (Fase 4).

---

## Contexto necesario

### Archivos a leer antes de implementar

- `prisma/schema.prisma` — modelos `Match`, `MatchResult`, `SlotReservation`, `User`, `Player`.
- `src/services/match-service.ts` — `createMatch`, `confirmMatch`, ciclo de estados, `matchIncludes`.
- `src/services/reservation-service.ts` — `createReservation` (chequeo de slot), flujo `PENDING → CONFIRMED`.
- `src/services/match-result-service.ts` + `src/lib/validations/match-result.ts` — carga/edición de resultado, determinación de ganador, walkover.
- `src/services/ranking-service.ts` — `computeRanking`, `getRankingByCategory` (patrón a adaptar para la escalera).
- `src/components/ranking-table.tsx` — tabla pública a reusar/adaptar.
- `src/proxy.ts` — protección de rutas (agregar rutas de escalera).
- `src/services/email-service.ts` + `src/components/emails/*` — patrón de emails (agregar emails de reto).
- `docs/new-features/la-escalera-propuesta.md` — fórmula ELO, ejemplos numéricos, seed.

### Gotchas

- **`Match` no-nulo hoy.** Volver `tournamentId`/`categoryId` nullable rompe el typecheck en el módulo torneo a propósito; recorrer cada error y manejar el `null` (es el plan, no un bug). Distinguir partido de torneo vs escalera por `ladderId != null` (no por `stage`).
- **Partidos referencian `User`, no `Player`/`LadderMember`.** El reto y el rating son sobre `User`. El `LadderMember` aporta el rating; el partido usa `player1Id`/`player2Id` (User).
- **Suma-cero con redondeo:** redondear el delta del ganador y aplicar su negativo al perdedor (`deltaLoser = -deltaWinner`) para que el rating total nunca se infle.
- **Timezone:** el mes y las ventanas se calculan en `America/Montevideo` y se guardan en UTC (`src/lib/date-utils.ts`). El cron debe usar límites de mes UY.
- **Idempotencia del cron:** registrar el cierre en `LadderPeriodClose` (`@@unique([ladderId, year, month])`) y abortar si ya existe. Vercel puede reintentar.
- **Reserva NO gateada:** cualquiera de los dos jugadores de un partido de escalera puede reservar; no se verifica actividad. La inactividad penaliza puntos, no el acceso. (El campo `priorityEligible` se elimina en Fase 3.)
- **Conteo de actividad con walkover:** el ganador por walkover suma partido para su mínimo; el ausente (perdedor del walkover) **no**.

---

## Implementation blueprint

### Data models (Prisma)

```prisma
enum ChallengeStatus {
  PROPOSED
  ACCEPTED
  REJECTED
  EXPIRED
  CANCELLED
}

enum RatingChangeReason {
  SEED
  MATCH
  PENALTY
  ADJUSTMENT
}

model Ladder {
  id                   String   @id @default(cuid())
  name                 String
  slug                 String   @unique
  isActive             Boolean  @default(true)
  // config calibrable
  kFactor              Int      @default(24)
  seedStep             Int      @default(20)   // -20 por puesto
  minMatchesPerMonth    Int     @default(2)
  monthlyPenalty        Int     @default(50)   // -50 por no llegar al mínimo
  maxChallengesPerMonth Int     @default(4)    // retos iniciados por mes
  maxOpenChallenges     Int     @default(2)    // retos abiertos en simultáneo
  acceptanceWindowDays  Int     @default(4)
  reservationLeadDays   Int     @default(30)
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  members    LadderMember[]
  challenges Challenge[]
  matches    Match[]
  closes     LadderPeriodClose[]

  @@index([slug])
  @@index([isActive])
}

model LadderMember {
  id               String   @id @default(cuid())
  ladderId         String
  userId           String
  rating           Int
  isActive         Boolean  @default(true)
  // priorityEligible: ELIMINADO en Fase 3 — la reserva no se gatea por actividad (ver §"Fase 3").
  joinedAt         DateTime @default(now())
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  ladder        Ladder          @relation(fields: [ladderId], references: [id], onDelete: Cascade)
  user          User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  ratingHistory RatingHistory[]

  @@unique([ladderId, userId])
  @@index([ladderId])
  @@index([userId])
  @@index([rating])
}

model Challenge {
  id           String          @id @default(cuid())
  ladderId     String
  challengerId String          // User
  challengedId String          // User
  status       ChallengeStatus @default(PROPOSED)
  proposedAt   DateTime        @default(now())
  respondByAt  DateTime
  respondedAt  DateTime?
  matchId      String?         @unique
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt

  ladder     Ladder @relation(fields: [ladderId], references: [id], onDelete: Cascade)
  challenger User   @relation("ChallengeChallenger", fields: [challengerId], references: [id])
  challenged User   @relation("ChallengeChallenged", fields: [challengedId], references: [id])
  match      Match? @relation(fields: [matchId], references: [id], onDelete: SetNull)

  @@index([ladderId])
  @@index([challengerId])
  @@index([challengedId])
  @@index([status])
}

model RatingHistory {
  id             String             @id @default(cuid())
  ladderMemberId String
  reason         RatingChangeReason
  matchId        String?
  ratingBefore   Int
  ratingAfter    Int
  delta          Int
  createdAt      DateTime           @default(now())

  member LadderMember @relation(fields: [ladderMemberId], references: [id], onDelete: Cascade)
  match  Match?       @relation(fields: [matchId], references: [id], onDelete: SetNull)

  @@index([ladderMemberId])
  @@index([matchId])
  @@index([createdAt])
}

model LadderPeriodClose {
  id       String   @id @default(cuid())
  ladderId String
  year     Int
  month    Int
  closedAt DateTime @default(now())

  ladder Ladder @relation(fields: [ladderId], references: [id], onDelete: Cascade)

  @@unique([ladderId, year, month])
}

// Cambios en Match (polimórfico — ver ADR 0001):
//   tournamentId String?   (antes obligatorio)
//   categoryId   String?   (antes obligatorio)
//   ladderId     String?
//   challengeId  String?   @unique
//   + relación ladder Ladder?, challenge Challenge?, ratingHistory RatingHistory[]
//   + @@index([ladderId])
// User: agregar relaciones ladderMemberships, challengesAsChallenger, challengesAsChallenged.
```

### Núcleo ELO (pseudocódigo)

```ts
function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400))
}

// score = 1 si gana A, 0 si pierde A
function eloDelta(K: number, scoreWinner = 1, expectedWinner: number): number {
  return Math.round(K * (scoreWinner - expectedWinner)) // delta del ganador (>0)
}

// Aplicar al pasar a PLAYED (suma-cero exacto):
function applyResult(winner: LadderMember, loser: LadderMember, K: number) {
  if (match.result.walkover) return // ELO-neutral
  const eW = expectedScore(winner.rating, loser.rating)
  const d = eloDelta(K, 1, eW)
  // winner += d, loser -= d  (negativo del ganador → suma cero)
  record(winner, +d); record(loser, -d) // RatingHistory reason MATCH
}
```

### Recálculo por edición (delta local)

```
Al editar un resultado de escalera:
  oldDelta = RatingHistory.delta del ganador original (puede ser 0 si era walkover)
  recomputar newDelta con los ratingBefore guardados del partido
  aplicar (newDelta - oldDelta) al rating actual del (nuevo) ganador y su negativo al perdedor
  actualizar/insertar filas de RatingHistory de ese partido
  NO se recalculan los partidos posteriores (path-dependency aceptada; edición es rara)
```

### Cierre de mes (cron, pseudocódigo)

```
ruta: /api/cron/ladder-close  (Vercel cron)
para cada ladder activa:
  (year, month) = mes recién cerrado en UY
  si existe LadderPeriodClose(ladderId, year, month): abortar (idempotente)
  para cada LadderMember activo:
    jugados = count(Match PLAYED del mes, ladderId, member participó y NO fue el ausente del walkover)
    si jugados < minMatchesPerMonth:
      aplicar -monthlyPenalty (RatingHistory reason PENALTY)   // multa de puntos; NO toca reserva
  crear LadderPeriodClose(ladderId, year, month)
```

### Task list granular (por fase)

**Fase 1 — Fundación**
1. Migración Prisma: nuevos modelos/enums + `Match` polimórfico. `pnpm db:migrate`.
2. Refactor TS-guiado de lecturas `Match.tournamentId`/`categoryId` en el módulo torneo.
3. `ladder-service.ts`: `getLadder`, `getLadderRanking` (order by rating), `getMember`.
4. Seed/acción de admin: proponer orden desde el 1er torneo, reordenar, bloquear → crear `LadderMember` + ratings + `RatingHistory` reason `SEED`.
5. Vista pública de la escalera (adaptar `ranking-table`). Home/nav apuntan a la escalera.

**Fase 2 — Retos + ELO** (migración previa: 3 columnas nuevas en `Ladder`; detalle en §"Fase 2 — diseño cerrado")
6. `challenge-service.ts`: `createChallenge` (elegibilidad + cap de abiertos + máx. mensual + un-reto-por-par + cooldown), `acceptChallenge` (crea `Match`), `rejectChallenge`, `cancelChallenge`/`cancelLadderMatch`, expiración perezosa.
7. ELO: núcleo `expectedScore`/`eloDelta` + preview en diálogos de retar/aceptar; hook en `match-result-service` (aplicar al `PLAYED`, `RatingHistory`, editar→delta local, walkover→neutral) solo si `ladderId`.
8. Reserva/partido de escalera: disponibilidad global (`getMonthMatches`/`getReservationsByMonth` sin `tournamentId`); generalizar detalle `/jugador/[slug]/partidos/[matchId]`; banner lazy de plazo + cancelación manual.
9. Emails: reto recibido/aceptado/rechazado + partido cancelado; adaptar confirmación a "La Escalera".
10. UI jugador (lanzar reto fila+perfil, bandeja en el panel, feedback de delta) + admin (editor de config del `Ladder` + monitoreo de retos/partidos).

**Fase 3 — Compromiso** (detalle cerrado en §"Fase 3 — diseño cerrado")
11. Migración: eliminar `LadderMember.priorityEligible`.
12. Cron mensual de cierre (`LadderPeriodClose` idempotente): multa de puntos a quien no llega al mínimo.
13. Cron diario (diferidos de Fase 2): auto-cancelar partidos PENDING vencidos + email pre-vencimiento; expirar retos `PROPOSED` vencidos.
14. Feedback de estado mensual al miembro (en términos de puntos: al día / en riesgo / penalizado).

**Fase 4 — Gamificación**
15. "Jugador de la semana" (deltas de `RatingHistory` en la semana).
16. Evolución de rating / movimientos de puesto. UI motivadora.

---

## Validation loop

Por cada fase, antes de darla por hecha:
1. `pnpm typecheck`
2. `pnpm build`
3. `/revisar` sobre el código modificado
4. Validación funcional con el usuario (criterios de "hecha" de la fase en el roadmap)

---

## Final checklist (feature completa)

- [ ] Escalera única sembrada y visible públicamente; se reordena con cada resultado.
- [ ] Ciclo de reto completo (`PROPUESTO→ACEPTADO→reserva→jugado`) con ELO aplicado.
- [ ] Preview de puntos == delta real; suma-cero sin inflar el total.
- [ ] Walkover ELO-neutral; edición por delta local.
- [ ] Cron de cierre idempotente; penalización de puntos correcta a quien no llega al mínimo.
- [ ] Reserva abierta a ambos jugadores (sin gating por actividad); `priorityEligible` eliminado.
- [ ] Módulo de torneos intacto tras `Match` polimórfico.
- [ ] Términos en `docs/context.md` reflejan lo implementado.

---

## Anti-patterns

- ❌ Modelar La Escalera como un `Tournament` tipado (rechazado — ver ADR 0001).
- ❌ Distinguir partido de escalera por `MatchStage` en vez de `ladderId`.
- ❌ Replay completo de ratings en cada edición (se eligió delta local).
- ❌ Mover ELO en walkover (rompe la separación habilidad/compromiso y habilita farming).
- ❌ Calcular el mes/ventanas en hora local del server en vez de UY.
- ❌ Cron no idempotente (Vercel puede reintentar → doble penalización).
- ❌ Permitir retar/jugar a un miembro sin `User`.
- ❌ Inflar el rating total: el delta del perdedor debe ser el negativo exacto del ganador.
