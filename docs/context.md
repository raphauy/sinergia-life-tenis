# Lenguaje Ubicuo

Glosario del dominio del proyecto. Es la fuente única para los términos que usamos al hablar (usuario ↔ código). El código está en inglés; este documento usa los términos en español (lo que ve el usuario final) y aclara el nombre en código cuando difiere.

> **No es spec.** Acá solo va lenguaje: qué significa cada término, qué aliases evitar, qué relaciones existen, qué ambigüedades quedaron resueltas. Decisiones de producto van al PRD/PRPs; planes de implementación van a los PRPs.

## Cómo escribir una entrada

Una entrada del glosario tiene este formato:

```
**Término**:
Definición concisa (1-3 oraciones). Aclarar cardinalidad y relaciones con otros términos del glosario.
_Código_: `NombreEnCódigo` (si difiere).
_Evitar_: aliases prohibidos y por qué (opcional).
```

Reglas:

- Una sola definición canónica por concepto. Si hay ambigüedad, resolverla acá antes de codificar.
- Agrupar por temática (sección con `##`) cuando haya 3+ términos relacionados.
- Si un término se refina o cambia, actualizarlo en el lugar — no agregar uno nuevo.
- Al cerrar un término durante `grill-me`, escribirlo acá inline (no al final de la sesión).

> Semilla inicial abajo: términos núcleo extraídos del schema y del PRD del MVP. El resto se llena lazy durante `/grill-me` a medida que aparecen.

## Lenguaje

### Personas y roles

**Usuario**:
Cuenta de la plataforma, identificada por **email** (único). Es la identidad de login (OTP por email). Tiene un **Rol** y puede estar activa o no. Un Usuario puede tener varios **Jugadores** (uno por torneo). Existe solo por invitación o creación de admin (no hay registro público).
_Código_: `User`.
_Evitar_: usar "jugador" para la cuenta — eso es **Jugador** (la inscripción), no el Usuario.

**Jugador**:
Inscripción de una persona a un **Torneo** + **Categoría** concretos. Tiene `firstName`/`lastName`/`slug` propios y opcionalmente `whatsappNumber`/`email`. Puede no estar vinculado a un **Usuario** (`userId` nullable hasta que acepta la invitación). Cardinalidad: uno por (torneo, email). Puede tener `withdrawnAt` (retirado del torneo).
_Código_: `Player`.
_Evitar_: confundir con **Usuario** (la cuenta de login). Un mismo Usuario es varios Jugadores a lo largo de los torneos.

**Rol**:
Nivel de permiso del **Usuario**: `SUPERADMIN` (todo + invitar admins), `ADMIN` (todo salvo invitar admins) o `PLAYER` (su panel + cargar resultados propios). Un SUPERADMIN/ADMIN puede además ser **Jugador**.
_Código_: `Role`.

### Torneo y estructura

**Torneo**:
Evento competitivo con nombre, `slug`, descripción, reglas, fechas (inicio/fin, `finalsDate` opcional) y un **Formato de partido**. Tiene **Categorías**. Flag `isActive` (la idea es uno activo a la vez).
_Código_: `Tournament`.

**Categoría**:
Nivel de juego dentro de un **Torneo** ("A", "B", "C"). Agrupa **Jugadores** y, en la fase de grupos, **Grupos**. Única por (torneo, nombre).
_Código_: `TournamentCategory`.

**Grupo**:
Subdivisión de una **Categoría** para la fase de grupos (todos contra todos). Numerado dentro de la categoría. Sus primeros puestos clasifican al **Bracket**.
_Código_: `Group`.

**Etapa**:
Fase de un **Partido** dentro del torneo: `GROUP` (fase de grupos), `QUARTERFINAL`, `SEMIFINAL`, `FINAL` (estas tres = el **Bracket** de eliminación directa).
_Código_: `MatchStage`.

**Bracket**:
Cuadro de eliminación directa (cuartos → semis → final) que se puebla con los clasificados de los **Grupos**. Un Partido del bracket puede tener sus jugadores aún sin resolver, derivados de una fuente (`player1SourceGroupId` + `player1SourcePosition`, etc.).
_Código_: no es un modelo; se expresa con `Match.stage` + `bracketPosition` + campos `*SourceGroup`/`*SourcePosition`.
_Evitar_: "llave" y "cuadro" como términos sueltos — usar **Bracket**.

### Partido y resultado

**Partido**:
Enfrentamiento entre dos contendientes (`player1`/`player2`) en un **Torneo** + **Categoría** (y opcionalmente un **Grupo**), con **Cancha** y horario opcionales. Estados: `PENDING` (sin fecha/hora/cancha) → `CONFIRMED` (agendado, dispara email) → `PLAYED` (resultado cargado) | `CANCELLED`.
_Código_: `Match` · estados `MatchStatus`.
_Ojo (ambigüedad resuelta)_: los contendientes de un Partido (`player1Id`/`player2Id`) referencian a **`User`**, NO a `Player`. La inscripción es `Player`, pero el partido se juega entre Usuarios.

**Resultado**:
Marcador de un **Partido**: games por set (`set1`, `set2`, `set3`), tiebreaks por set (`tb1`/`tb2`), super tiebreak (`superTb`), flag `walkover`, `winnerId`, y `photoUrl` opcional. Lo carga un jugador (en partido propio confirmado) o un admin.
_Código_: `MatchResult` (1–1 con `Match`).

**Formato de partido**:
Cómo se define un **Partido** del torneo: `SINGLE_SET` (default), `TWO_SETS_SUPERTB` (2 sets + super tiebreak a 10 si 1-1) o `BEST_OF_THREE` (futuro). Es propiedad del **Torneo** y determina los campos válidos del **Resultado**.
_Código_: `MatchFormat`.

**Cancha**:
Cancha donde se juega un Partido. Fijas: 1 o 2 (no son entidad dinámica).
_Código_: `Match.courtNumber` (`Int?`).

**Reserva de slot**:
Reserva de cancha + horario asociada a un **Partido** (`scheduledAt` + `courtNumber`), hecha por un Usuario. Pieza que la futura feature **La Escalera** reutiliza para la prioridad de reserva.
_Código_: `SlotReservation` (1–1 con `Match`).

### Ranking

**Ranking**:
Tabla pública de posiciones por **Categoría** del torneo activo. El cálculo de puntos del MVP está pendiente de definición con Mati. La feature **La Escalera** introduce un ranking permanente tipo ELO (ver sección **La Escalera** abajo).
_Código_: `ranking-service.ts`.

## La Escalera (liga permanente)

> Feature post-MVP. Diseño en `docs/PRPs/la-escalera-prp.md`. Decisión de fondo (cerrada): **una sola escalera** + **ELO suma-cero (K=24)** + **penalización mensual por inactividad**.

**La Escalera**:
Liga permanente de desafíos: **no es un Torneo** (no tiene fin ni campeón). Una **única** lista ordenada por **Rating** (las **Categorías** A/B/C del primer torneo dejan de usarse como agrupación competitiva; solo sirven para el seed inicial). Premia compromiso + habilidad. Pasa a ser el módulo principal de la app.
_Código_: `Ladder` (una sola fila por ahora; entidad propia para soportar config/futuro).
_Evitar_: "torneo" para La Escalera — es un modelo aparte. "liga"/"ranking vivo"/"desafíos" como sinónimos sueltos: usar **La Escalera**.

**Miembro**:
Inscripción permanente de un **Usuario** a **La Escalera**, con un **Rating**. Requiere `User` (cuenta): no se puede retar/jugar sin cuenta. Cardinalidad: uno por (escalera, usuario). Lo agrega un admin (sin auto-registro público). Puede quedar inactivo sin perder su Rating.
_Código_: `LadderMember`.
_UI_: al usuario se le dice **«jugador»** ("jugador de La Escalera"). La distinción Miembro/Jugador se mantiene solo en **código** (`LadderMember` vs `Player`); el contexto desambigua para el usuario final.
_Evitar_: en código, confundir `LadderMember` con `Player` (inscripción a un **Torneo**). Un Miembro es de La Escalera; un Player es de un Torneo.

**Reto**:
Desafío de un **Miembro** (retador) a otro (retado) dentro de **La Escalera**. Se puede retar a cualquiera. Estados: `PROPUESTO` → `ACEPTADO` | `RECHAZADO` | `EXPIRADO` (no respondió en la ventana) | `CANCELADO` (retirado por el retador antes de respuesta). Rechazar es libre (no penaliza). El Reto **no** lleva fecha/cancha; al `ACEPTADO` genera un **Partido de escalera**. Hay un cap chico de retos abiertos en simultáneo por persona.
_Código_: `Challenge` (1–1 con `Match` una vez aceptado).
_Evitar_: "desafío" suelto en código — usar `Challenge`.

**Rating**:
Puntaje ELO de un **Miembro**; su orden define el puesto en **La Escalera**. Suma-cero (lo que gana uno lo pierde el otro), `K=24` de arranque. Baja por inactividad (penalización mensual). Seed inicial desde el primer torneo: −20 puntos por puesto, A>B>C (1500→700).
_Código_: `LadderMember.rating` (+ historial para gráficos y "jugador de la semana").
_UI_: al usuario se le muestra como **«ranking»** (uso coloquial uruguayo: "tengo 1500 de ranking"). En código sigue siendo `rating`.
_Evitar_: llamarlo "puntos" sin contexto — choca con los "puntos" del **Ranking** del torneo (que hoy es `pg`). En La Escalera, "puntos"/"ranking" = **Rating** ELO.

**Partido de escalera**:
Un **Partido** (`Match`) generado por un **Reto** aceptado. Reusa el ciclo `PENDING → CONFIRMED → PLAYED | CANCELLED` y la **Reserva de slot**. A diferencia de un partido de torneo, `tournamentId`/`categoryId` van **nulos** y el partido se vincula a la escalera/reto (`Match` pasa a ser polimórfico: torneo **o** escalera).
_Código_: `Match` con `tournamentId`/`categoryId` nullable + vínculo a `Challenge`.

**Siembra**:
Acto **único** de poblar **La Escalera** por primera vez a partir del **resultado final del 1er Torneo**. El admin recibe un orden 1‑N propuesto (ganador de la final de cada categoría arriba, luego por ronda de bracket alcanzada, empates de ronda desempatados por ranking de grupos, categorías A→B→C) sobre **todos** los inscriptos del torneo; lo reordena/quita gente y lo **bloquea** en una sola transacción que crea los **Miembros**, sus **Rating** iniciales (−`seedStep` por puesto desde `seedBaseRating`) y la fila de historial inicial. Mientras la escalera no tenga partidos, se puede **re-sembrar** (reset).
_Código_: acción de admin sobre `Ladder`/`LadderMember`; `RatingHistory` reason `SEED`.
_Evitar_: "importar" / "migrar jugadores" — es **Siembra**.

**Acceso prioritario a reserva**:
Beneficio central de La Escalera: un **Miembro** activo puede reservar cancha con **anticipación** (vía nuestra app), mientras el socio común solo el día anterior (app del club). Es **binario por participar** (no depende del puesto): el #1 y el último tienen el mismo acceso. Se pierde si se cae la actividad (no llega al mínimo mensual). Hoy la reserva es **semiautomática** (el Miembro la pide, Mati la carga en la app del club y confirma).
_Código_: reusa `SlotReservation` + flujo `PENDING → CONFIRMED`.
