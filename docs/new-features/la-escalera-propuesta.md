# Escalera Life — Propuesta de funcionamiento

*Liga permanente de desafíos para Life Montevideo tenis. Documento para revisar con Mati.*

---

## Qué es

Una **liga permanente** basada en desafíos: los jugadores se retan entre sí y el resultado
mueve un **ranking único** que está siempre vivo. No es un torneo: **no tiene fecha de fin ni
campeón**. Es una forma de mantener al club jugando todo el año.

## Por qué hacerlo así

- **Le da sentido competitivo a la cancha.** Hoy se juega suelto y sin que nada esté en juego;
  con La Escalera cada partido suma a un ranking y a una competencia que engancha.
- **Premia jugar, no solo ganar.** El que juega tiene cancha asegurada, entra en los
  reconocimientos y no pierde puntos por inactividad. El objetivo número uno es *que se juegue*.
- **Es simple de leer pero serio por dentro.** Mantiene la idea intuitiva de "escalera"
  (subo, bajo) y por debajo usa un sistema de puntos probado por los mejores clubes del mundo,
  para que cada partido tenga peso real y los movimientos sean justos.

---

## El beneficio central: reservar con anticipación

Hoy el socio común solo puede reservar cancha **el día anterior**, con mucha competencia.

- **Jugador de La Escalera** → puede coordinar y reservar con **bastante anticipación**
  (una semana o un mes hacia adelante), para los partidos de sus retos.
- **Socio común** → sigue como hasta ahora: solo el día anterior.

Este beneficio es **del que participa, sin importar su puesto** en la escalera. El #1 y el
último tienen el mismo acceso. **No se pierde nunca**: es el premio por estar adentro y jugar.

> *Argumento:* si el acceso dependiera del puesto, los de abajo nunca conseguirían cancha para
> subir y se desengancharían. Atándolo a participar, mantenemos viva a toda la base.

---

## Cómo funciona

### El ranking
- **Una sola escalera** para todos (las categorías A/B/C del primer torneo dejan de usarse;
  queda una única lista ordenada por puntos).
- El ranking mide **compromiso + habilidad**: se mueve con cada partido (ganás o perdés puntos
  según quién era el rival) y baja por inactividad si no llegás al mínimo del mes.

### Los retos
- Podés **retar a cualquiera**. Si el rival **acepta**, se juega.
- Tiene **3–4 días para aceptar o rechazar**. Una vez aceptado, coordinan día y hora con
  tranquilidad dentro de la ventana de reserva.
- **Rechazar es libre** (no penaliza). Lo que importa es llegar al mínimo del mes.

> *Argumento (por qué retar a cualquiera y no solo "3 hacia arriba"):* con una sola escalera,
> si solo se pudiera retar hacia arriba, el #1 nunca podría jugar. Permitir retar a cualquiera
> + premio escalado se autorregula solo: ganarle a alguien de abajo da poco, así que no hay mucho incentivo para buscar solo rivales fáciles; y retar a alguien de arriba es atractivo, porque ganás más puntos
> y arriesgás poco (pero sin saltos bruscos: nadie se desploma por una derrota).

### Mínimo y máximo mensual
- **Mínimo (a definir): ej. 2 partidos por mes.** Si no los jugás, **perdés puntos**.
- **Máximo mensual de retos (a definir)** (un número razonable para no saturar la única cancha — a calibrar).
- Cuenta todo: **tanto los retos que iniciás como los que te hacen a vos** suman a los partidos de tu mes.

### Los puntos: cómo se mueve el ranking

Esto no lo inventamos. Investigamos cómo lo resuelven las ligas y los **clubes más importantes
del mundo**, y casi todos usan el mismo sistema, llamado **ELO** (el mismo del ajedrez, el
fútbol y los e-sports). Acá en Life lo podemos llamar simplemente **"puntos"**, pero el motor
es ese, probado por millones de jugadores.

**La idea en una frase:** ganás más cuando le ganás a alguien mejor que vos, y arriesgás poco
cuando retás para arriba. **Nadie se desploma por una derrota.**

**Cómo se calcula.** Antes de cada partido ya se sabe exactamente cuánto está en juego, porque
depende solo de los puntos que cada uno tiene hoy:

```
chance de ganar = 1 / (1 + 10^((puntos del rival − tus puntos) / 400))
cambio de puntos = K × (resultado − chance de ganar)
```

- `resultado` = 1 si ganás, 0 si perdés.
- `K` = cuánto se puede mover como máximo por partido. Arrancamos con **K = 24**.
- Es **suma cero**: lo que ganás vos, lo pierde tu rival. Los puntos no se inflan nunca.

**De dónde salen los números (ejemplo del top 15).** El **10º tiene 1320 puntos** y reta al
**7º, que tiene 1380** (60 puntos más arriba):

```
chance del 10º = 1 / (1 + 10^(60/400)) = 0,41   → 41% de chance
Si gana:   24 × (1 − 0,41) = +14 puntos  → queda en 1334
Si pierde: 24 × (0 − 0,41) = −10 puntos  → queda en 1310
```

Para el 7º es el espejo: si gana **+10**, si pierde **−14**. Al de arriba, perder le cuesta poco
(era el favorito); al de abajo, ganar le rinde más.

**Clave:** antes de aceptar el reto, los dos jugadores **ven en la app cuánto ganan y cuánto
pierden**. Nadie juega a ciegas.

**Tabla rápida** (cuánto se mueve, con K=24, según cuántos puntos arriba esté el rival):

| Rival arriba tuyo | Tu chance | Si ganás | Si perdés |
|---|---|---|---|
| 0 (parejo) | 50% | +12 | −12 |
| 60 | 41% | +14 | −10 |
| 100 | 36% | +15 | −9 |
| 200 | 24% | +18 | −6 |
| 400 (mucho mejor) | 9% | +22 | −2 |

> Los **puntos** se mueven de forma 100% predecible (la tabla). El **puesto** puede subir 0, 1 o
> 2 lugares según qué tan cerca estén tus vecinos en puntos: no es arbitrario, depende de cuántos
> puntos tienen los de al lado.

### Reconocimiento y participación
- **Jugador de la semana:** el que **más puntos ganó** en la semana.
- Jugar siempre cuenta, aunque pierdas: suma para tu **mínimo mensual**, para los reconocimientos
  y te mantiene el **acceso a cancha**. Así se premia participar sin ensuciar el ranking.

---

## Puntos iniciales (el arranque)

El primer torneo ya definió un orden. Lo usamos como punto de partida: los **41 jugadores**
(16 de A, 16 de B, 9 de C) entran a la escalera única ordenados por su resultado, con **A
arriba, después B, después C**, y de ahí en más cada partido los mueve.

| Categoría | Jugadores | Puestos | Puntos iniciales |
|---|---|---|---|
| A | 16 | 1º – 16º | 1500 → 1200 |
| B | 16 | 17º – 32º | 1180 → 880 |
| C | 9 | 33º – 41º | 860 → 700 |

Regla del arranque: **−20 puntos por puesto**, de corrido por todo el ranking.

Así quedan, por ejemplo, los primeros puestos (todos de categoría A):

| Puesto | 1º | 5º | 7º | 10º | 15º |
|---|---|---|---|---|---|
| Puntos | 1500 | 1420 | 1380 | 1320 | 1220 |

> El orden inicial respeta lo que pasó en el torneo. Los valores exactos (las bandas y los
> escalones) se pueden ajustar, pero el sistema empieza a funcionar igual desde el día 1.

---

## Números a calibrar

- **K** (cuánto mueve cada partido): arranque **24**. Más alto = más volátil.
- **Escalón inicial:** −20 por puesto (ajustable).
- **Mínimo mensual:** 2 partidos (a definir) · **Penalización** por no llegar: **−X puntos** (a definir).
- **Máximo mensual de retos:** a definir según cuántos partidos aguanta la cancha por semana.

---

## Notas de implementación

- Reutiliza lo ya construido para el torneo: flujo de partido `PENDIENTE → CONFIRMADO` y la
  reserva de cancha (`SlotReservation`).
- **Hoy la reserva es semiautomática:** el jugador la pide en la app, Mati la carga en la app
  del club y confirma el partido. **A futuro** se automatiza con acceso a la API de reservas del club.
