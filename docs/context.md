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
_UI_ (decidido en Fase 4): el **valor** se muestra como **«puntos»** ("1266 puntos en La Escalera") y la palabra **«Ranking»** se reserva para el **puesto** ("Ranking #8"). En código sigue siendo `rating`. _Deuda_: algunas superficies legacy aún dicen "ranking" para el valor (columna de la tabla, "X de ranking" en tarjetas) — pendiente de unificar a "puntos".
_Evitar_: usar «ranking» para el **valor** (es el **puesto**). El valor es **«puntos»**.

**Partido de escalera**:
Un **Partido** (`Match`) generado por un **Reto** aceptado. Reusa el ciclo `PENDING → CONFIRMED → PLAYED | CANCELLED` y la **Reserva de slot**. A diferencia de un partido de torneo, `tournamentId`/`categoryId` van **nulos** y el partido se vincula a la escalera/reto (`Match` pasa a ser polimórfico: torneo **o** escalera).
_Código_: `Match` con `tournamentId`/`categoryId` nullable + vínculo a `Challenge`.

**Siembra**:
Acto **único** de poblar **La Escalera** por primera vez a partir del **resultado final del 1er Torneo**. El admin recibe un orden 1‑N propuesto (ganador de la final de cada categoría arriba, luego por ronda de bracket alcanzada, empates de ronda desempatados por ranking de grupos, categorías A→B→C) sobre **todos** los inscriptos del torneo; lo reordena/quita gente y lo **bloquea** en una sola transacción que crea los **Miembros**, sus **Rating** iniciales (−`seedStep` por puesto desde `seedBaseRating`) y la fila de historial inicial. Mientras la escalera no tenga partidos, se puede **re-sembrar** (reset).
_Código_: acción de admin sobre `Ladder`/`LadderMember`; `RatingHistory` reason `SEED`.
_Evitar_: "importar" / "migrar jugadores" — es **Siembra**.

**Acceso prioritario a reserva**:
Beneficio inherente de La Escalera: un **Partido de escalera** se puede reservar con **anticipación** (hasta `reservationLeadDays`) por nuestra app —cualquiera de los dos jugadores lo pide—, mientras el socio común reserva por la app del club el día anterior. **No está gateado por actividad ni por puesto**: el #1 y el último tienen el mismo acceso, y la inactividad **no** lo revoca. La única consecuencia de la inactividad es la **Penalización mensual** de **Rating** (puntos), nunca el acceso a reservar. Hoy la reserva es **semiautomática** (el jugador la pide, Mati la carga en la app del club y confirma).
_Código_: reusa `SlotReservation` + flujo `PENDING → CONFIRMED`; el tope de anticipación vive en `Ladder.reservationLeadDays`.
_Evitar_: "acceso prioritario que se pierde por inactividad" / `priorityEligible` — el acceso no se gatea; la inactividad penaliza puntos.

**Penalización mensual** (multa):
Descuento de **Rating** que el cierre de mes aplica a un **Miembro** activo que jugó menos del **Mínimo mensual de partidos** en el mes calendario UY. Monto = `monthlyPenalty` (default 50; se guarda positivo y se **resta**). Es la **única** consecuencia de la inactividad: no afecta el acceso a reservar ni a retar. Se registra en `RatingHistory` con reason `PENALTY`.
_Evitar_: confundirla con el **Máximo de retos mensual** (limita retar, no toca puntos) o con el "acceso prioritario a reserva" (que no se gatea).

**Mínimo mensual de partidos**:
Cantidad de **Partidos de escalera** *jugados* que un **Miembro** activo debe alcanzar en el mes calendario UY para no recibir la **Penalización mensual** (`minMatchesPerMonth`, default 2).
_Evitar_: confundirlo con el **Máximo de retos mensual** — son dos topes distintos (uno mínimo de jugados, otro máximo de retos iniciados).

**Máximo de retos mensual**:
Tope de **Retos** que un **Miembro** puede **iniciar** en el mes calendario UY (`maxChallengesPerMonth`, default 4). Alcanzado el tope, no inicia más retos ese mes, pero sigue pudiendo **aceptar** retos recibidos, jugar y reservar. Gobierna "poder retar"; no penaliza puntos.
_Código_: `challenge-service` (conteo de retos iniciados en el mes).

**Cierre de mes**:
Proceso mensual (Vercel cron, 1º a las 00:00 UY, idempotente vía `LadderPeriodClose`) que evalúa la actividad del mes recién terminado de cada **Miembro** activo y aplica la **Penalización mensual** a quien no alcanzó el **Mínimo mensual de partidos**. Un miembro cuyo alta cae en el mes que se cierra tiene **gracia** (no se penaliza ese mes).
_Código_: `closeLadderMonth` + ruta `/api/cron/ladder-month-close`.

### Gamificación (Fase 4)

> Términos cerrados en grill-me 2026-06-01 (Fase 4). Diseño en `docs/PRPs/la-escalera-prp.md` §"Fase 4".

**Semana (de La Escalera)**:
Semana calendario UY con inicio el **lunes** (lunes 00:00 → domingo 23:59). El juego real es lunes–sábado (club cerrado los domingos). Los partidos se atribuyen a una semana por su **fecha agendada** (`Match.scheduledAt`, el slot), **no** por cuándo se cargó el resultado — así un partido del sábado cuenta en su semana aunque el resultado entre el domingo o el lunes. "Rota" el lunes.
_Evitar_: contar por `playedAt`/`RatingHistory.createdAt` (es la fecha de carga, no la de juego).

**Jugador de la semana**:
**Miembro** con mayor **ganancia neta de Rating en partidos** de la **Semana** recién cerrada: suma de los `delta` de `RatingHistory` con reason `MATCH` de sus partidos de esa semana (las victorias por walkover suman 0; las **Penalizaciones** no cuentan). Desempate: más partidos jugados, luego menor **Rating** actual. Si nadie sumó neto positivo, **no hay** jugador de la semana (estado vacío). Se muestra en el home (arriba de la escalera) y como distintivo en el **perfil** durante la semana en curso.
_UI_: se le dice "ranking" a los puntos (ver **Rating**).

**Partido destacado**:
**Partido de escalera** con `scheduledAt` dentro de la **Semana** corriente, mostrado en el home: los `CONFIRMED` por venir y los `PLAYED` (con resultado) de la semana, que quedan visibles hasta el cierre. Tope 5, ordenados por **Importancia**. Los aceptados sin fecha (`PENDING`) no entran.

**Importancia (de un partido)**:
Criterio de orden de los **Partidos destacados**: suma de los **Rating** de los dos jugadores (los partidos entre los de más arriba pesan más).

**Movimiento de puesto**:
Cambio de posición de un **Miembro** en La Escalera desde el 1º del mes corriente UY, reconstruido desde `RatingHistory` (no se guarda historial de posiciones). Se muestra como flecha ↑/↓ N en la fila de la escalera y en el **perfil**. Un miembro sin posición de referencia al inicio del mes (alta posterior) no lleva flecha.

**Evolución de rating**:
Curva del **Rating** de un **Miembro** en el tiempo (desde `RatingHistory`, desde la **Siembra**), mostrada en su **perfil** como gráfico SVG liviano (sin librería de charts).

**Actividad de la escalera (en la fila)**:
A partir de Fase 4, la tabla de La Escalera muestra la actividad de **Retos** y **Partidos de escalera** vivos de **todos** los miembros (global y pública), no solo los del viewer. Cada reto/partido vivo aparece en las **dos** filas implicadas, desde la perspectiva de cada dueño de fila ("Retó a Fulano" / "Retado por Fulano" / "vs Fulano · fecha") con los puntos en juego (preview ELO, dos valores asimétricos según quién gana). Una fila con varios retos crece en alto (una línea por reto). El viewer conserva su acción ("Retar" con preview) sobre filas retables, aun si el rival ya está ocupado con terceros.
_Nota_: esto **relaja** la regla de Fase 2 de "no mostrar preview en partido ya agendado" para el tablero — se muestran los puntos aunque puedan moverse antes de jugarse (se aclarará en ayuda al usuario).

### Ranking protegido (extensión post-Fase 4)

> Términos cerrados en grill-me 2026-06-08. Diseño en `docs/PRPs/ranking-protegido-prp.md`.

**Ranking protegido**:
Estado temporal de un **Miembro**, otorgado por un **admin** por un **Período de protección** `[inicio, fin]`. Mientras hoy ∈ [inicio, fin]: no se lo puede **retar** y queda **fuera del mercado** (tampoco reta/acepta/juega), pero **sigue rankeado** (conserva su puesto, visible en la tabla con un ícono por **Motivo de protección**). Queda **exento de la Penalización mensual** si estuvo protegido **más de la mitad de los días** del mes calendario UY que se cierra. El regreso al mercado es automático al pasar el fin (protección **acotada**) o cuando el admin la **termina** (protección **abierta**, sin fin). Lo que se protege es el **puesto/standing** (de ahí "ranking" = puesto, coherente con **Rating**).
_Código_: `LadderProtection` (uno o varios períodos por miembro; "protegido ahora" = existe un período que cubre el instante).
_Evitar_: usar `isActive` para esto — un Miembro **inactivo sale** del ranking; uno **protegido permanece**. Son estados distintos.

**Período de protección**:
Tramo de **Ranking protegido** de un **Miembro**, con `startDate` y `endDate` **opcional** (`null` = **abierta**, sin fin), **Motivo** y nota opcional. Granularidad de día UY. El inicio puede ser **pasado** (backdateable: proteger a alguien que se lesionó hace días) y ambas fechas son **editables** (extender/modificar). Otorgarlo cubriendo el presente **cancela** (avisando por email) los retos y partidos vivos del miembro. Dos salidas: **Terminar** (fin = ahora, conserva el historial) o **Eliminar** (borra, para errores).
_Código_: `LadderProtection` (`startDate`/`endDate?` como límites de día UY en UTC).

**Motivo de protección**:
Categoría **pública** del **Ranking protegido**: Lesión / Viaje / Otro, con nota opcional. Es público a propósito: el objetivo de la feature es que el resto **sepa por qué** un jugador no es retable. Define el ícono de la fila/perfil (vendaje / avión / escudo).
_Código_: `ProtectionReason` (`INJURY` / `TRAVEL` / `OTHER`).
