# La Escalera — Roadmap

Liga permanente de desafíos sobre un ranking ELO único. Diseño completo en [`la-escalera-prp.md`](./la-escalera-prp.md). Decisión arquitectónica en [ADR 0001](../adr/0001-match-polimorfico-escalera.md).

> Regla del roadmap: el **schema Prisma completo de la feature se migra en la Fase 1** (de una sola vez). Las fases siguientes solo agregan lógica/UI sobre ese schema. Cada fase es un chunk shippable, validado con el usuario antes de la siguiente.

---

## Fase 1 — Fundación + escalera visible

**Estado:** ✅ terminada

**Objetivo:** Dejar la escalera única viva y visible (read-only), con los ~41 del primer torneo sembrados, y la migración polimórfica de `Match` ya absorbida por el código existente. De-riesga lo más caro (la migración) antes de construir lógica encima.

**Alcance:**
- Migración completa del schema de la feature: `Ladder`, `LadderMember`, `Challenge`, `RatingHistory`, `LadderPeriodClose`, enums (`ChallengeStatus`, `RatingChangeReason`), y `Match` polimórfico (`tournamentId`/`categoryId` nullable + `ladderId`/`challengeId`).
- Refactor guiado por TypeScript de toda lectura de `Match.tournamentId`/`categoryId` en el módulo de torneos (manejo del `null`).
- Seed de La Escalera: crear el `Ladder`, garantizar `User` para los participantes, enrolar como `LadderMember` y asignar ratings iniciales (escalón −20/puesto, A>B>C, 1500→700). El admin **propone desde el resultado del 1er torneo y confirma/reordena** el 1‑41 antes de bloquear.
- Vista pública de la escalera única ordenada por rating (reusa/adapta `ranking-service` + `ranking-table`). Home y navegación pública apuntan a La Escalera.
- Config de la liga en la fila `Ladder` (valores de arranque; ver PRP).

**Fuera de alcance:** retos, cálculo ELO en vivo, reservas de escalera, penalizaciones, gamificación.

**Dependencias:** ninguna (primera fase). Requiere que el admin confirme el orden 1‑41 del seed antes de bloquearlo (la mecánica ya está aprobada por Mati).

**Criterios de "hecha":**
- `pnpm typecheck` y `pnpm build` verdes con `Match` nullable (el módulo torneo sigue funcionando igual).
- La escalera única se ve públicamente con los ~41 sembrados, ordenados por rating.
- Validado por el usuario.

---

## Fase 2 — Retos + partidos + ELO en vivo

**Estado:** pendiente

**Objetivo:** Cerrar el loop competitivo: un miembro reta a otro, se juega y el resultado **mueve el ranking** solo.

**Alcance:**
- Ciclo de `Challenge`: proponer (a cualquiera), aceptar, rechazar, cancelar, expiración por ventana (`respondByAt`). Cap de retos abiertos simultáneos por persona.
- Al `ACCEPTED`: crear `Match` (`PENDING`, ambos jugadores, `ladderId`/`challengeId`). De ahí toma el flujo existente: pedir `SlotReservation` → Mati confirma → cargar resultado.
- Cálculo ELO suma-cero (K configurable) al pasar el partido a `PLAYED`; `RatingHistory` con `ratingBefore`/`ratingAfter`/`delta`; el reto queda `JUGADO` (estado del partido) y el ranking se reordena.
- Preview de "cuánto ganás / cuánto perdés" para ambos antes de aceptar.
- Walkover → ELO‑neutral (delta 0).
- Editar resultado → recálculo **delta local** (sin replay).
- Emails de reto (recibido / aceptado / rechazado), reusando la infra de email.

**Fuera de alcance:** penalización mensual, cron, gating del beneficio de reserva, gamificación.

**Dependencias:** Fase 1.

**Criterios de "hecha":**
- Un reto recorre `PROPUESTO → ACEPTADO → reserva → confirmado → jugado` y el rating de ambos cambia según ELO.
- El preview de puntos coincide con el delta aplicado.
- Walkover no mueve rating; edición de resultado ajusta el rating por delta local.
- `pnpm typecheck` + `pnpm build` + `/revisar`. Validado por el usuario.

---

## Fase 3 — Compromiso + gancho de reserva

**Estado:** pendiente

**Objetivo:** Que la actividad mensual gobierne penalizaciones y el acceso prioritario a reservar (el premio central).

**Alcance:**
- Vercel cron de cierre de mes (idempotente vía `LadderPeriodClose`): cuenta partidos jugados del mes por miembro (el ganador por walkover suma participación; el ausente no), aplica −X de penalización a los que no llegan al mínimo (`RatingHistory` reason `PENALTY`) y recalcula `priorityEligible`.
- `priorityEligible` **gatea** la acción de pedir reserva: al día → puede reservar con anticipación por nuestra app; bajo mínimo → no puede (vuelve a la app del club, día anterior).
- Mensajería/feedback al miembro sobre su estado mensual (al día / en riesgo / penalizado).

**Fuera de alcance:** automatización de la reserva en la app del club (sigue manual de Mati); gamificación.

**Dependencias:** Fase 2.

**Criterios de "hecha":**
- El cron cierra el mes una sola vez por período (idempotente) y aplica penalización + elegibilidad correctamente.
- Un miembro bajo mínimo no puede pedir reserva; al ponerse al día, recupera el acceso.
- `pnpm typecheck` + `pnpm build` + `/revisar`. Validado por el usuario.

---

## Fase 4 — Gamificación + reconocimientos

**Estado:** pendiente

**Objetivo:** Que La Escalera "se sienta" como un juego y motive el enganche (adherencia es el objetivo de producto nº1).

**Alcance:**
- "Jugador de la semana": más rating ganado en la semana (desde `RatingHistory`).
- Evolución de rating y movimientos de puesto por miembro.
- UI motivadora (badges, deltas visibles, estados, etc.) — alcance fino a aterrizar con `/grill-me`.

**Fuera de alcance:** temporadas/campeón, notificaciones push/WhatsApp.

**Dependencias:** Fase 2 (necesita `RatingHistory`); idealmente Fase 3.

**Criterios de "hecha":** reconocimiento semanal visible y al menos una vista de evolución; validado por el usuario.

---

## Fuera de alcance de la feature (todas las fases)

- Automatización vía API de reservas del club (Mati confirma manual).
- Auto-registro público de miembros (el admin agrega).
- Múltiples escaleras (por sexo/sede/categoría).
- Temporadas con reset/campeón (ranking continuo).
- Notificaciones por WhatsApp/push (solo email).
