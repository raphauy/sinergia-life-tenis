# PRP: Sección Gallina

> Extensión de **La Escalera** (post-Fase 4). Términos canónicos en [`docs/context.md`](../context.md) (sección "La Escalera" → "Sección Gallina"). Complementa [`la-escalera-prp.md`](./la-escalera-prp.md); no reabre sus decisiones de fondo. Feature chica y autocontenida: una sola fase. Fecha de diseño: 2026-06-15.

## Goal

Exponer públicamente, en el home, a los **Miembros** que **rechazaron** un **Reto parejo** en los **últimos 7 días** ("gallinas") — para crear presión social a favor de aceptar retos. Excluye los rechazos justificados (rival demasiado abajo = poquitos puntos, o demasiado arriba = nivel muy superior) midiendo la cercanía por puestos.

## Why

- **Refuerza el objetivo de producto nº1 (adherencia):** la app premia jugar; rechazar retos parejos es lo contrario. Mostrarlo —con humor— empuja a aceptar.
- **Justo por diseño:** no se expone a quien rechaza un reto desbalanceado (alguien muy por debajo o muy por encima). Solo los retos "parejos" cuentan.
- **Costo incremental acotado:** reusa el motor de retos y el ranking ya construidos; agrega una columna de snapshot, un knob de config y una card en el home. Sin cron ni notificaciones.

## What + success criteria

En el home, debajo de **Jugador de la semana**, una card **"Sección Gallina"** (ícono de gallinita + contador de jugadores distintos) **desplegable** que muestra una línea por gallina: su nombre + **#N** (puesto actual) y a quién le rechazó (nombre + #N), con una 2ª línea chica "hace X días". Una gallina aparece si rechazó **explícitamente** un reto cuyo rival estaba dentro de **±`gallinaPositionRange` puestos** (default 10) al momento del rechazo, en los últimos 7 días, y **no** está hoy en Ranking protegido.

**Éxito:**
- Tras rechazar un reto parejo, la persona aparece en la card dentro de los 7 días y sale automáticamente al cumplirse 7 días desde el rechazo.
- Un rechazo a un rival a **más de 10 puestos** (arriba o abajo) **no** genera gallina.
- Una gallina con varios rechazos válidos figura **una sola vez** (rival más reciente + "(+N)", fecha del más reciente).
- Un protegido (Ranking protegido) **no** se muestra aunque haya rechazado.
- Card vacía → **no se renderiza**. Mobile-first prolijo.
- La card **arranca poblada** con los rechazos de los últimos 7 días ya existentes al deployar.
- `pnpm typecheck` + `pnpm build` + `/revisar` verdes. Validado por el usuario.

---

## Decisiones cerradas

> Tabla firme — no re-discutir en implementación. Cerradas en grill-me 2026-06-15.

| # | Decisión | Resolución |
|---|---|---|
| 1 | Término | **«Gallina»** (la persona expuesta) en la **«Sección Gallina»** (la card). Se protege el tono lúdico/de presión social. |
| 2 | Qué cuenta | Solo **rechazo explícito** (`Challenge.status = REJECTED`). **No** cuenta dejar vencer (`EXPIRED`). |
| 3 | Ventana | **Móvil, 7 días por rechazo**: visible mientras `respondedAt >= ahora − 7 días`. No es semana calendario (el "de la semana" es branding). |
| 4 | Reto parejo | Retador y retado dentro de **±`gallinaPositionRange` puestos** (`Math.abs(gap) ≤ range`, inclusive: exactamente 10 califica). Más de N hacia arriba **o** hacia abajo → no califica. |
| 5 | Base de puestos | **Snapshot al rechazar** (`Challenge.rankGapAtReject`, signo = puestoRetador − puestoRetado). Fiel a la justificación (los "puntos que daría"/"nivel" se evalúan cuando se propone el reto). Para rechazos sin snapshot (legacy) → **fallback a puestos en vivo**. |
| 6 | Umbral | **Configurable**: `Ladder.gallinaPositionRange Int @default(10)`, coherente con los demás knobs. |
| 7 | Exclusión protegidos | Una gallina que **hoy** está en Ranking protegido **no se muestra** (reaparece si la protección termina dentro de los 7 días). |
| 8 | Agrupación | **Una línea por gallina**: rival **más reciente** + "(+N)" si hubo varios; fecha "hace X días" del rechazo más reciente. El contador del header = **jugadores distintos**. |
| 9 | Contenido | Nombre + **#N** (puesto **actual**) de la gallina y del rival. **Sin** puntos en juego. |
| 10 | Ubicación / visibilidad | Card pública en el **home**, debajo de "Jugador de la semana". Sin badge en el perfil (fuera de alcance). El viewer se ve a sí mismo si es gallina. |

### Decisiones de detalle

- **#N visible = puesto actual** (consistente con toda la app, clickeable al perfil). El **snapshot** es solo para la **regla** ±N, no para mostrar.
- **Arranca poblada (día 1):** los rechazos previos a la feature no tienen `rankGapAtReject` → se evalúan con **puestos en vivo**. Único caso que se saltea: si uno de los dos **ya no es miembro activo** del ranking y no hay snapshot → no se puede medir "parejo" → no aparece.
- **Solo gallinas que son miembros activos** del ranking (tienen puesto). El **rival** rechazado se muestra con #N si sigue en el ranking; si no, nombre sin #N.

---

## Modelo de datos (migración nueva)

> Excepción a "todo el schema se migró en Fase 1" (igual que Fases 2, 3 y Ranking protegido): estas estructuras no existían.

```prisma
model Ladder {
  // ... campos existentes ...
  gallinaEnabled       Boolean @default(true) // switch admin: muestra/oculta la sección (home + doc)
  gallinaPositionRange Int     @default(10)   // ±N puestos para que un rechazo cuente como "gallina"
}

model Challenge {
  // ... campos existentes ...
  // Snapshot del gap de puestos al RECHAZAR (puestoRetador − puestoRetado), para la
  // Sección Gallina. Solo se setea en rejectChallenge. null = sin snapshot (legacy o
  // algún participante no era miembro activo) → la gallina cae a puestos en vivo.
  rankGapAtReject Int?
}
```

- Una sola migración (`add_gallina`): agrega ambas columnas (nullable / con default). `pnpm db:migrate`.
- Sin índices nuevos: la query filtra por `status` (ya indexado) + `respondedAt` en memoria sobre un universo chico (retos rechazados recientes).

---

## Comportamiento

### Snapshot al rechazar (`rejectChallenge`)

En `challenge-service.ts`, al pasar un reto a `REJECTED`:

1. Cargar `getLadderRanking()` (positions por userId).
2. `gap = posRetador − posRetado` (de `challengerId` / `challengedId`). Si falta alguno (no miembro activo) → `null`.
3. Guardar `rankGapAtReject = gap` en el mismo `update`.

Reject es una acción poco frecuente: una lectura extra del ranking es aceptable.

### Predicado "gallina ahora" (`getGallinas`)

Nueva lectura en `ladder-stats-service.ts` (junto a las demás de gamificación):

1. `sevenDaysAgo = subDays(new Date(), 7)`.
2. Query: `challenge` `where { ladderId, status: 'REJECTED', respondedAt: { gte: sevenDaysAgo } }`, `orderBy respondedAt desc`, select `id, challengerId, challengedId, respondedAt, rankGapAtReject, challenger {firstName,lastName}, challenged {firstName,lastName}`.
3. `getLadderRanking()` → maps `positionByUser`, `entryByUser` (nombre/imagen/slug/**protection** de cada gallina).
4. Por reto: `gap = rankGapAtReject ?? liveGap`, con `liveGap = posRetador − posRetado` (ambos de `positionByUser`; si falta alguno y no hay snapshot → **descartar**).
5. **Califica** si `Math.abs(gap) <= ladder.gallinaPositionRange`.
6. **Descartar** si la gallina (retado) **no** es miembro activo (no está en el ranking) **o** está **protegida** ahora (`entry.protection != null`).
7. **Agrupar** por `challengedId` (gallina): `count`, `lastRival` (retador del rechazo más reciente que calificó), `extra = count − 1`, `lastRejectedAt` (su `respondedAt`).
8. **Orden** de la lista: por `lastRejectedAt` desc (gallina más fresca arriba).

Devuelve `Gallina[]`; la card muestra `list.length` como contador.

```ts
interface Gallina {
  userId: string
  name: string
  image: string | null
  playerSlug: string | null
  position: number | null      // puesto actual de la gallina (#N)
  rejectedCount: number        // total de rechazos válidos en la ventana
  rival: {                     // el rechazo más reciente que calificó
    name: string
    position: number | null    // #N actual del rival (null si dejó la escalera)
    playerSlug: string | null
  }
  lastRejectedAt: Date         // para "hace X días"
}
```

> Reusa el patrón de las otras lecturas de `ladder-stats-service` (mapear el ranking a `positionByUser` / slugs; nombres de `User` vía las relaciones del `Challenge` para tolerar no-miembros).

### Helper de fecha "hace X días"

`date-utils.ts` gana `relativeDaysAgoUY(date)` por días de calendario UY (`differenceInCalendarDays` sobre `toZonedTime`): `0 → "hoy"`, `1 → "ayer"`, `n → "hace n días"`.

---

## UI

### Card "Sección Gallina" (`gallina-card.tsx`, nuevo, cliente)

- Recibe `gallinas: Gallina[]`. Si `length === 0` → `return null` (card oculta; el home no la envuelve si está vacía).
- Estructura: contenedor `rounded-lg border bg-card` (mismo lenguaje visual que las otras cards del home + `DocSection`) con un **`Collapsible`** (base-ui, el mismo primitivo de las cards de "Cómo funciona"; **no** se usa el Accordion de Radix/shadcn para no sumar dependencia ni mezclar primitivos).
  - **`CollapsibleTrigger`** (siempre visible): 🐔 **Sección Gallina** · `{n}` `{n === 1 ? 'gallina' : 'gallinas'}` + chevron. (Lucide no tiene gallina; usamos el emoji 🐔. Alternativa si se prefiere lucide: `Bird`.)
  - **`CollapsibleContent`**: una fila por gallina:
    - **Línea 1:** `<Link href="/jugador/{slug}">{name}</Link>` ` #N` · "le rechazó a" `<Link>{rival.name}</Link>` ` #N` `{extra > 0 && '(+'+extra+')'}`. `#N` con el estilo tenue de los puestos de la tabla; nombres `truncate` para mobile.
    - **Línea 2:** `text-xs text-muted-foreground` → `relativeDaysAgoUY(lastRejectedAt)`.
- **Mobile-first:** nombres truncan, los `#N` no se parten; la línea 1 puede envolver con `flex-wrap`; sin puntos en juego (menos ruido). Probar en ~360px.

### Switch admin (`/admin/escalera` → Ajustes)

- `Ladder.gallinaEnabled` (default `true`) gobierna si la sección se muestra. `getGallinas()` devuelve `[]` si está apagado (card oculta) y la `DocSection` de `/escalera` no se renderiza.
- En `ladder-config-form.tsx`, un `Switch` (nuevo `src/components/ui/switch.tsx`, base-ui — sin dep nueva) en una sección "Sección Gallina". Persistido por `updateLadderConfigAction` (validación `gallinaEnabled: z.boolean()` en `ladderConfigSchema`).

### Home (`src/app/page.tsx`)

- Agregar `getGallinas()` al `Promise.all` y `<GallinaCard gallinas={gallinas} />` justo **debajo** del bloque de `PlayerOfTheWeekCard` (dentro del `rows.length > 0`), con su propio `mb-6`. (La card decide ocultarse si está vacía.)

### Página "Cómo funciona" (`/escalera`)

- Sección breve "Sección Gallina": qué es, la regla de ±N puestos (parejo), que solo cuenta el rechazo explícito y que dura 7 días. Tono consistente con el resto del documento (`escalera-doc.tsx`).

---

## Blueprint (task list, una fase)

1. **Schema + migración:** `Ladder.gallinaPositionRange` (default 10) + `Challenge.rankGapAtReject Int?`. `pnpm db:migrate`.
2. **Snapshot:** en `rejectChallenge` (`challenge-service.ts`), calcular `getLadderRanking()` y guardar `rankGapAtReject = posRetador − posRetado` (null si falta alguno).
3. **Lectura:** `getGallinas()` en `ladder-stats-service.ts` (ventana 7 días, regla ±range con fallback en vivo, exclusión de no-miembros y protegidos, agrupación + orden). Tipo `Gallina`.
4. **Helper de fecha:** `relativeDaysAgoUY` en `date-utils.ts`.
5. **UI card:** `gallina-card.tsx` con el `Collapsible` existente (sin instalar nada), mobile-first, oculta si vacía.
6. **Home:** sumar `getGallinas()` al `Promise.all` y renderizar la card debajo de "Jugador de la semana".
7. **Cómo funciona:** sección "Sección Gallina" en `/escalera`.
8. **Glosario:** ya actualizado (ver `docs/context.md`).
9. **Cierre:** `/revisar` + `pnpm typecheck` + `pnpm build` + validación del usuario.

---

## Edge cases

- **Rechazo legacy (sin snapshot):** ambos miembros → gap en vivo; algún no-miembro → se saltea.
- **Gallina se protege dentro de la ventana:** se oculta; si la protección termina antes de los 7 días, reaparece.
- **Varios rechazos de la misma gallina:** una línea, rival más reciente + "(+N)", fecha del más reciente.
- **Borde de 7 días:** sale al cumplirse 7×24h desde `respondedAt` (ventana móvil, en vivo por request).
- **Rival ya no es miembro:** nombre sin #N, sin link.
- **Gap exactamente 10:** califica (`≤ range`).
- **Card vacía:** no se renderiza (no deja hueco en el home).
- **Viewer es gallina:** se ve igual (público, sin caso especial).

---

## Fuera de alcance

- Retos **EXPIRADOS** (dejar vencer) como gallina — solo rechazo explícito.
- Badge de gallina en el **perfil** del jugador (solo card del home).
- Mostrar **puntos esquivados** (preview ELO del reto rechazado).
- Notificaciones (email/push/WhatsApp) al gallinear.
- Histórico de gallinas más allá de la ventana de 7 días.
- Cualquier penalización de Rating por gallinear (es solo exposición social).
```
