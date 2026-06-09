# PRP: Ranking protegido

> Extensión de **La Escalera** (post-Fase 4). Términos canónicos en [`docs/context.md`](../context.md) (sección "La Escalera" → "Ranking protegido"). Complementa [`la-escalera-prp.md`](./la-escalera-prp.md); no reabre sus decisiones de fondo. Feature chica y autocontenida: una sola fase. Fecha de diseño: 2026-06-08.

## Goal

Permitir que un **admin** ponga a un **Miembro** de La Escalera en **Ranking protegido** por un período (lesión, viaje u otro): mientras dura, **no se lo puede retar** y **no recibe la Penalización mensual** si estuvo protegido más de la mitad del mes. Su **puesto se conserva** (sigue visible en la tabla) y un **ícono público** acorde al motivo le avisa al resto por qué no es retable.

## Why

- **Resuelve un dolor real:** un jugador lesionado o de viaje hoy tiene que **rechazar retos a mano** y, peor, **arriesga la multa** por no llegar al mínimo mensual por una causa legítima.
- **Información que falta:** "los demás no saben que está lesionado o se fue de viaje". El ícono + motivo público lo comunica sin que el jugador tenga que avisar uno por uno.
- **Flexibilidad con control humano:** el admin decide a quién y por cuánto, sin reglas rígidas. La única automatización es la exención de multa (regla de la mitad del mes).
- **Costo incremental acotado:** reusa el motor de retos/partidos/cierre mensual ya construido; agrega una tabla y guards puntuales.

## What + success criteria

Un admin protege a un miembro desde `/admin/escalera` eligiendo **motivo** (Lesión/Viaje/Otro), **nota opcional** y **período [inicio, fin]** (inicio puede ser pasado; editable). Mientras hoy ∈ [inicio, fin] el miembro queda **fuera del mercado de retos** pero **rankeado**; al otorgarse se **limpian** sus retos y partidos vivos. El **cierre de mes** lo exime de la multa si estuvo protegido **> la mitad** de los días del mes. Un **ícono por motivo** aparece en la fila de la tabla (al lado de fueguitos/copita) y en el perfil.

**Éxito:**
- El admin protege/edita/termina una protección y ve las vigentes en la pestaña "Miembros".
- Un protegido **no aparece como retable** (sin botón "Retar", sin preview) en tabla ni perfil, y sus retos/partidos vivos quedaron cancelados.
- El protegido **conserva su puesto** y muestra el ícono del motivo (público).
- El cierre de mes **no multa** a quien estuvo protegido > la mitad de los días de ese mes; **sí** multa a quien estuvo menos.
- El regreso al mercado es **automático** al pasar el `endDate` en protecciones **acotadas**; en las **abiertas** (sin fin), el admin la **termina** cuando el jugador vuelve.
- `pnpm typecheck` + `pnpm build` + `/revisar` verdes. Validado por el usuario.

---

## Decisiones cerradas

> Tabla firme — no re-discutir en implementación. Cerradas en grill-me 2026-06-08.

| # | Decisión | Resolución |
|---|---|---|
| 1 | Término | **«Ranking protegido»** (adjetivo "protegido"). Se protege el **puesto/standing**; coherente con "ranking = puesto" del glosario. |
| 2 | Relación con `isActive` | Estado **nuevo y distinto**. Inactivo **sale** del ranking; protegido **permanece** rankeado con su puesto + ícono. No reusar `isActive`. |
| 3 | Exención de multa | **Protegido > la mitad de los días** del mes calendario UY que se cierra → exento. ≤ la mitad → se multa normal. Regla automática en el cierre. |
| 4 | Ciclo de vida | **Período** con `startDate` y `endDate` **opcional** (granularidad día UY). Inicio **backdateable**; ambos **editables** (extender/modificar). **Acotada** (con fin): "protegido ahora" = `now ∈ [startDate, endDate]`, **regreso automático** al pasar `endDate` (se computa al leer, sin cron). **Abierta** (sin fin): protegido hasta que el admin la **termine**. |
| 5 | Motivo | **Categoría** `Lesión / Viaje / Otro` + **nota opcional**. **Público** (objetivo de la feature). |
| 6 | Alcance del protegido | **Fuera del mercado**: no se lo reta, y **tampoco** puede retar / aceptar / jugar mientras dure. Sigue rankeado. |
| 7 | Limpieza al otorgar | Si la protección **cubre el presente**, cancelar sus retos `PROPOSED` (enviados+recibidos) y sus partidos de escalera `PENDING/CONFIRMED`, con **email a los rivales**. Deja el mercado limpio. |
| 8 | Ícono | **Por motivo**: lesión → vendaje (`Bandage`), viaje → avión (`Plane`), otro → escudo (`Shield`). Tooltip con motivo + período (+ nota). Ubicación: esquina de la fila (junto a fueguitos/copita) y header del perfil. |
| 9 | Admin UX | Nueva pestaña **«Miembros»** en `/admin/escalera`: lista con acción Proteger / Editar / Terminar por fila (dialog con motivo + fechas + nota). Vista global de protecciones vigentes. |
| 10 | Permiso | **SUPERADMIN + ADMIN** (consistente con el resto de `/admin/escalera`). |

### Decisiones de detalle

- `endDate` **opcional**: protección **acotada** (con fin → regreso automático) o **abierta** (sin fin → hasta que el admin la termine). Cubre la lesión de duración incierta sin obligar a inventar una fecha.
- **Dos salidas distintas:** **"Terminar protección"** = `endDate = ahora`, **conserva** el período en el historial → los días ya cubiertos siguen contando para la exención; es la salida correcta cuando el jugador **se recuperó antes** y vuelve a jugar. **"Eliminar protección"** = **borra** la fila (protección creada por error); no deja días ni rastro.
- **Backdating no reabre meses ya cerrados** (no reembolsa multas pasadas); solo afecta meses aún no cerrados.

---

## Modelo de datos (migración nueva)

> Excepción a "todo el schema se migró en Fase 1" (igual que Fases 2 y 3): estas estructuras no existían.

```prisma
enum ProtectionReason {
  INJURY
  TRAVEL
  OTHER
}

// Período de Ranking protegido de un Miembro. Varios por miembro (historial:
// lesión en marzo, viaje en julio). endDate null = abierta (sin fin). "Protegido
// ahora" = existe una fila con startDate <= now y (endDate null o now <= endDate).
// Para la exención de multa se computa la unión de días cubiertos ∩ mes cerrado.
model LadderProtection {
  id             String           @id @default(cuid())
  ladderMemberId String
  reason         ProtectionReason
  note           String?
  startDate      DateTime         // 00:00 UY del día de inicio (en UTC)
  endDate        DateTime?        // 23:59:59.999 UY del día de fin (en UTC); null = abierta
  createdById    String           // admin que la otorgó (auditoría)
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt

  member    LadderMember @relation(fields: [ladderMemberId], references: [id], onDelete: Cascade)
  createdBy User         @relation("ProtectionCreator", fields: [createdById], references: [id])

  @@index([ladderMemberId])
  @@index([startDate])
  @@index([endDate])
}
```

- `LadderMember` gana `protections LadderProtection[]`.
- `User` gana `protectionsCreated LadderProtection[] @relation("ProtectionCreator")`.
- **Almacenamiento de fechas:** el admin elige días de calendario (date pickers, sin hora). Se guardan como `fromZonedTime(startOfDay(día), UY)` y `fromZonedTime(endOfDay(día), UY)` para que las comparaciones `now ∈ [start, end]` y el conteo de días por mes sean correctos en UY (patrón de `date-utils.ts`). El **fin es opcional**: vacío = protección **abierta** (`endDate = null`).

---

## Comportamiento

### Predicado "protegido ahora"

Un miembro está protegido en el instante `t` si existe un `LadderProtection` suyo con `startDate <= t` y (`endDate` null **o** `t <= endDate`). Función núcleo en `ladder-protection-service.ts` (nuevo): `getCurrentProtection(userId)` → `{ reason, note, startDate, endDate } | null`, y una variante batch `getCurrentProtections(userIds)` → `Map<userId, ...>` para no hacer N queries en la tabla/ranking.

### Exención de multa (cierre de mes)

En `closeLadderMonth` (`ladder-cron-service.ts`), para cada miembro activo que **no** llega al mínimo, antes de multar:

1. Calcular los **días distintos del mes UY que se cierra** cubiertos por **alguna** protección del miembro (unión de `[startDate, endDate] ∩ [monthStart, monthEnd]`, contados como días de calendario UY). Una protección **abierta** (`endDate` null) cubre hasta `monthEnd` (sigue vigente).
2. Si `díasCubiertos > díasDelMes / 2` → **exento** (no se multa, no se crea fila `PENALTY`).
3. Si no → multa normal.

`> díasDelMes / 2` es **estrictamente más de la mitad** (mes de 30 → 16+ días; mes de 31 → 16+).

**Aviso pre-cierre** (`sendMonthClosingWarnings`): excluir a los **protegidos vigentes** al momento del aviso (van camino a la exención; no tiene sentido asustarlos).

### Guards del mercado de retos

- `createChallenge`: rechazar si el **retador o el retado** está protegido ahora. Mensajes: "No podés retar mientras estás en Ranking protegido." / "{Nombre} está protegido ({motivo}); no se lo puede retar ahora."
- `acceptChallenge`: rechazar si el retado está protegido ahora (defensivo; normalmente ya no tiene retos vivos).
- `getLadderView` / `getChallengeState`: una fila/perfil de un protegido **no es retable** (sin preview, sin control). Si el **viewer** está protegido, `canChallenge = false` (no inicia retos), pero su fila sigue marcada `self`.

### Limpieza al otorgar / editar (cubre el presente)

En el service `setProtection` (crear o editar), si el período resultante **cubre `now`**:

1. Cancelar retos `PROPOSED` del miembro (como challenger y como challenged) → `status = CANCELLED`, `respondedAt = now`.
2. Cancelar sus partidos de escalera `PENDING`/`CONFIRMED` → reusar la lógica de `cancelLadderMatch` (borrar `SlotReservation`, `Match.CANCELLED`, limpiar `scheduledAt`/`courtNumber`/`confirmedAt`). No mueve ELO.
3. **Emails a los rivales** de **todo** lo cancelado: partidos (reusar/adaptar `ladder-match-cancelled-email`) **y** retos `PROPOSED` (reusar/adaptar `challenge-rejected-email` o `ladder-match-cancelled-email`), nombrando que el otro entró en Ranking protegido con su motivo. Siempre se avisa.

Todo en una transacción corta; emails fuera de la transacción (patrón del cierre de mes).

### Reconciliación diaria (protecciones con inicio futuro)

La limpieza al otorgar cubre las protecciones que arrancan **hoy o antes**. Para una protección **con inicio futuro** (ej.: viaje la semana que viene), agregar un paso idempotente a `runLadderDailyTasks`: para cada miembro **protegido ahora**, cancelar cualquier reto/partido vivo que haya quedado. Como los guards bloquean crear nuevos, en régimen esto solo dispara el día en que una protección futura se activa.

### Estado mensual del jugador (perfil)

`getMonthlyActivity` gana un estado `'protegido'` cuando el miembro está protegido ahora: `LadderMonthlyStatus` muestra "Protegido hasta DD/MM · no se aplica la multa este mes" (en vez de al-día/en-riesgo). Solo dueño/admin (como hoy).

### Sin tratamiento especial

- **Jugador de la semana / movimiento de puesto:** sin cambios. Un protegido no juega → no gana rating → no es candidato a POTW y no tiene movimiento. Cae solo, sin código extra.

---

## UI

### Tabla de La Escalera (`ladder-table.tsx`)

- `LadderEntry` (de `getLadderRanking`) gana `protection: { reason, note, startDate, endDate } | null`.
- Fila protegida: **ícono por motivo** en el bloque `absolute right-3 top-1` (junto a copita/fueguitos), vía un componente nuevo `ProtectionBadge` (mismo patrón que `WinStreakBadge` + `IconTooltip`). Tooltip: "Protegido · {Motivo} · hasta DD/MM" (+ nota si hay).
- **Sin control de reto** para esa fila (no `showControl`), sin preview. Opcional: etiqueta inline tenue "Protegido" (mobile-first; el ícono ya comunica).

### Perfil del jugador (`/jugador/[slug]/page.tsx`)

- En el header (fila de badges, junto a "Ranking #", movimiento, copita, fueguitos): badge "Protegido · {Motivo}" con el ícono del motivo y, si hay, "hasta DD/MM". Público.
- El `ChallengeControl` del header no se muestra si el perfil está protegido (no retable).

### Admin — pestaña "Miembros" (`/admin/escalera`)

- Nueva `TabsTrigger`/`TabsContent` "Miembros" junto a Ranking/Actividad/Ajustes.
- Lista de miembros (orden del ranking) con: puesto, avatar+nombre (link al perfil), puntos, y **estado**: si está protegido, badge con motivo + período; si no, vacío.
- Acción por fila:
  - **Proteger** (si no protegido) → dialog: motivo (`Select`), nota (`Textarea`, opcional), inicio (`DatePicker`, default hoy), fin (`DatePicker`, **opcional** → vacío = abierta).
  - **Editar** (si protegido) → mismo dialog precargado (cambiar motivo/nota/fechas; extender; pasar de acotada a abierta y viceversa).
  - **Terminar** (si protegido) → `endDate = ahora`; **conserva** el período en el historial (salida correcta cuando el jugador se recuperó antes y vuelve). Confirm inline (patrón de `CancelControl`).
  - **Eliminar** → **borra** la fila (protección creada por error; no deja días ni rastro).
- Componente cliente nuevo `member-protection-manager.tsx`; lecturas server en `ladder-protection-service.ts`.

### Íconos (lucide)

| Motivo | Ícono | Color sugerido |
|---|---|---|
| Lesión (`INJURY`) | `Bandage` | ámbar/rojo tenue |
| Viaje (`TRAVEL`) | `Plane` | azul |
| Otro (`OTHER`) | `Shield` | slate |

---

## Blueprint (task list, una fase)

1. **Schema + migración:** `ProtectionReason`, modelo `LadderProtection`, relaciones en `LadderMember` y `User`. `pnpm db:migrate`.
2. **Validación:** `src/lib/validations/ladder-protection.ts` — `protectionSchema` (reason enum, note opcional ≤200, `endDate` opcional, `startDate ≤ endDate` si hay fin, fechas válidas; transforma día UY → UTC bounds).
3. **Service `ladder-protection-service.ts`:**
   - `getCurrentProtection(userId)` / `getCurrentProtections(userIds)` (batch).
   - `getProtectionDaysInMonth(memberId, year, month)` (unión de días cubiertos ∩ mes UY).
   - `setProtection({ userId, reason, note, startDate, endDate, adminId })` (crea/edita + limpieza si cubre now).
   - `endProtection(protectionId)` (endDate=now) · `deleteProtection(protectionId)`.
   - `getMembersWithProtection()` (para la pestaña admin: ranking + protección vigente).
4. **Guards de reto:** `createChallenge` + `acceptChallenge` chequean protección; `getLadderView`/`getChallengeState` marcan no-retable; `canChallenge=false` si viewer protegido.
5. **Ranking enriquecido:** `getLadderRanking` (y `LadderEntry`) incluyen `protection`. Propagar a tabla, perfil, admin.
6. **Cierre de mes:** exención por "> mitad del mes" en `closeLadderMonth`; excluir protegidos del aviso pre-cierre.
7. **Reconciliación diaria:** paso en `runLadderDailyTasks` para protecciones recién activadas.
8. **Estado mensual:** `'protegido'` en `getMonthlyActivity` + `LadderMonthlyStatus`.
9. **UI tabla/perfil:** `ProtectionBadge` + integración en `ladder-table.tsx` y `page.tsx` del perfil (ocultar control de reto).
10. **Admin:** pestaña "Miembros" + `member-protection-manager.tsx` + actions en `src/app/admin/escalera/actions.ts` (`setProtectionAction`, `endProtectionAction`, `deleteProtectionAction`), con `requireAdmin` y `revalidatePath('/', '/admin/escalera', perfil)`.
11. **Emails:** adaptar `ladder-match-cancelled-email` para el caso "rival protegido".
12. **Glosario:** ya actualizado (ver `docs/context.md`).
13. **Cierre:** `/revisar` + `pnpm typecheck` + `pnpm build` + validación del usuario.

---

## Edge cases

- **Backdating sobre mes ya cerrado:** no reabre ni reembolsa; solo cuenta para meses aún no cerrados.
- **Editar para que ya no cubra `now`** (acortar fin a ayer): el miembro vuelve al mercado al leer; nada que limpiar (estuvo vacío durante la protección).
- **Períodos superpuestos:** permitidos; "protegido ahora" = alguno cubre now; la exención usa la **unión** de días (sin doble conteo).
- **Miembro inactivo:** la acción de proteger se ofrece solo sobre miembros **activos** (un inactivo no está en el ranking).
- **Protección de duración incierta (lesión):** el admin pone un fin tentativo y lo **extiende** si hace falta.
- **Mes a caballo de una protección abierta-y-extendida:** el cierre cuenta solo los días de **ese** mes cubiertos.

---

## Fuera de alcance

- Auto-otorgar protección (el jugador la pide y se aprueba): el admin la pone a mano.
- Reabrir/recalcular meses ya cerrados por un backdating.
- Mostrar el estado protegido en superficies fuera de tabla + perfil (cards de `/partidos`, fixture, etc.) — salvo pedido explícito.
- Notificaciones por WhatsApp/push.

---

## Decisiones resueltas (2ª ronda, 2026-06-08)

1. **Protección abierta permitida:** `endDate` opcional. Acotada → regreso automático al pasar el fin; abierta → hasta que el admin la **termine**.
2. **Siempre se avisa:** la limpieza emailea a los rivales tanto de **partidos** como de **retos `PROPOSED`** cancelados.
3. **"Eliminar protección"** incluido, además de **"Terminar"**: Terminar (fin = ahora) conserva el historial y es la salida cuando el jugador **se recupera antes**; Eliminar borra una protección creada por error.
