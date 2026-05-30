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

Una escalera única ordenada por **Rating** (ELO). Los miembros se **retan** entre sí; al aceptarse un reto se genera un partido que reusa el flujo existente; al cargar el resultado el rating de ambos se ajusta (suma-cero). Un **mínimo mensual** de partidos mantiene el rating y el **acceso prioritario a reserva**; no llegar penaliza y revoca el beneficio hasta ponerse al día.

**Éxito:**
- La escalera única, sembrada con los ~41 del primer torneo, es visible públicamente y se reordena sola con cada resultado.
- El ciclo `reto → reserva → partido → resultado → cambio de rating` funciona de punta a punta.
- La actividad mensual gobierna penalización y acceso a reservar.
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
| 15 | Premio (reserva) | Acceso a reservar **anticipado por nuestra app**, **binario por participar** (no por puesto). `priorityEligible` gatea el pedir reserva. Reserva sigue **semiautomática** (Mati confirma). |
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

† Defaults razonables, no especificados explícitamente por Mati; ajustables.

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
- **Reserva gateada:** `createReservation` para partidos de escalera debe verificar `LadderMember.priorityEligible` del solicitante.
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
  priorityEligible Boolean  @default(true)  // recalculado por el cron
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
      aplicar -monthlyPenalty (RatingHistory reason PENALTY); priorityEligible = false
    si no:
      priorityEligible = true
  crear LadderPeriodClose(ladderId, year, month)
```

### Task list granular (por fase)

**Fase 1 — Fundación**
1. Migración Prisma: nuevos modelos/enums + `Match` polimórfico. `pnpm db:migrate`.
2. Refactor TS-guiado de lecturas `Match.tournamentId`/`categoryId` en el módulo torneo.
3. `ladder-service.ts`: `getLadder`, `getLadderRanking` (order by rating), `getMember`.
4. Seed/acción de admin: proponer orden desde el 1er torneo, reordenar, bloquear → crear `LadderMember` + ratings + `RatingHistory` reason `SEED`.
5. Vista pública de la escalera (adaptar `ranking-table`). Home/nav apuntan a la escalera.

**Fase 2 — Retos + ELO**
6. `challenge-service.ts`: `createChallenge` (valida cap de abiertos + máximo mensual de iniciados + objetivo válido), `acceptChallenge` (crea `Match`), `rejectChallenge`, `cancelChallenge`, expiración.
7. Preview ELO (`expectedScore` + delta) en la UI de aceptar.
8. Hook en `match-result-service`: al `PLAYED`, aplicar ELO + `RatingHistory`; editar → delta local; walkover → neutral.
9. Emails de reto (recibido/aceptado/rechazado).
10. UI de jugador: lanzar reto, bandeja de retos, estado.

**Fase 3 — Compromiso**
11. `/api/cron/ladder-close` + config Vercel cron. `LadderPeriodClose` idempotente.
12. Gating de `createReservation` por `priorityEligible`.
13. Feedback de estado mensual al miembro.

**Fase 4 — Gamificación**
14. "Jugador de la semana" (deltas de `RatingHistory` en la semana).
15. Evolución de rating / movimientos de puesto. UI motivadora.

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
- [ ] Cron de cierre idempotente; penalización + elegibilidad correctas.
- [ ] Reserva gateada por actividad.
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
