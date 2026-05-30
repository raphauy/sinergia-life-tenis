# La Escalera — Liga permanente (brainstorm)

> Estado: **brainstorm en curso** (PO + Raphael). Documento de trabajo para retomar en otra sesión.
> Fecha: 2026-05-27. Aún NO es un plan de implementación.

## 1. Concepto

Crear una **liga permanente** basada en desafíos (formato *challenge ladder*) sobre el ranking que dejó el primer torneo (categorías A/B/C).

- **No es un torneo**: no tiene fecha de fin ni campeón.
- Es un sistema de juego continuo en el club que **usa el ranking y lo va modificando**.
- Jugadores se **retan** entre sí; cada reto mueve el ranking.
- Objetivo de producto: **enganche/adherencia** de socios, motivar a que la gente juegue.
- Debe ser **simple de entender** (si no, no hay adherencia), pero con una **buena UI gamificada** para motivar.

### Nombre
- Club cambió de nombre: ahora es **Life Montevideo** (o **Life** a secas). Ya no "Sinergia Life".
  - *Pendiente técnico (después): actualizar nombre en la app y docs.*
- Nombre de la liga (a definir). Candidato fuerte: **"La Escalera"** (metáfora de subir).
  - Otros: Liga Sinergia/Life, Ranking Vivo, Desafíos.

## 2. El premio central: acceso a la cancha (DECIDIDO)

Contexto real: el club tiene 2 canchas; una casi siempre ocupada con clases. La otra queda
para socios pero es difícil conseguir hora — solo se reserva **el día anterior** y hay mucha
concurrencia (todos haciendo refresh a las 9hs).

**El beneficio de estar en La Escalera = reservar cancha con prioridad/anticipación.**

- **Socio común** → reserva solo el día anterior (por la app del club, como hasta ahora).
- **Jugador de La Escalera (que juega)** → reserva con **prioridad/anticipación**, por **nuestra app**.
- El beneficio es **binario**: depende de **participar** (estar activo en La Escalera), **NO de la posición** en el ranking. El #1 y el #20 tienen el mismo acceso si ambos juegan.
- El que **no juega** → vuelve a reservar por la app del club con la regla de un día antes (eso es la penalización natural).

### Flujo de reserva (HOY, manual)
1. El jugador **pide la cancha desde nuestra app** (igual que en el torneo).
2. Queda **PENDING** hasta que **Mati la reserve en la app del club** (él reserva cualquier día).
3. Mati **confirma el partido en nuestra app** → `CONFIRMED`.

- Reutiliza el patrón ya existente: `SlotReservation` + flujo `PENDING → CONFIRMED` del torneo. **No arrancamos de cero acá.**
- **Futuro (fase posterior):** Raphael va a pedir acceso a la **API de reservas del club** para automatizar el paso de Mati. El sistema debe funcionar igual sin esa automatización.

## 3. Reglas de juego que quiere Raphael (a diseñar)

- Cada jugador puede **retar** a otro, con un **mínimo** y un **máximo** de retos por **semana o mes** (números a definir).
- Cada reto da **puntos al ganador y también al perdedor** (premiar la participación).
- **Dificultad escalada**: retar a alguien más arriba es más difícil y vale más puntos.
  Ej: si estoy 10º, ganarle al 1º vale más que ganarle al 9º.
- **Penalizaciones**:
  - No jugar (no retar a nadie) penaliza.
  - Rechazar cierta cantidad de retos en la semana/mes penaliza.
  - "Si te vas de viaje, lamento: no jugaste, perdés." (la inactividad cuesta.)

### Propuesta de Mati (simple)
- Solo se puede retar **hasta 3 lugares hacia arriba** del ranking.
- El ganador **intercambia posición** con el perdedor.
- Mati no es técnico; Raphael cree que con software se puede algo más interesante con puntos,
  **sin que sea complicado de entender**.

## 4. Reframes del PO (ideas de diseño propuestas)

### Reframe #1 — Hay DOS monedas, no una
Separar:
- **Puntos / posición en ranking** → premia **resultados** (ganar, y ganarle a alguien mejor).
- **Acceso a reservar** → premia **participación/actividad**, no habilidad.

Razón: si el acceso lo ganan solo los de arriba, los de abajo nunca consiguen cancha para
subir → **espiral de muerte** y se desenganchan. Premiando participación con acceso, se
mantiene viva toda la base. (Ya quedó alineado con la decisión de la sección 2.)

### Reframe #2 — Mati no está equivocado, está incompleto
Usar su límite **"retar hasta 3 arriba"** como **regla de elegibilidad** (a quién podés retar:
mantiene partidos parejos y es simple) y **encima** poner los puntos para la riqueza. El "swap
de posición" es un caso particular simple de un sistema de puntos; los puntos dan granularidad.

### Reframe #3 — La cancha es parte del juego, no un detalle
- El **mínimo de retos** debe calibrarse a cuántos partidos aguanta físicamente la cancha por
  semana (si no, frustra en vez de enganchar).
- El premio (reservar antes) y el juego (los retos necesitan cancha) **compiten por el mismo
  recurso**. El reto aceptado debería *generar* la reserva del partido.

## 5. Straw-man del loop (borrador para romper)

```
Tenés puntos. El ranking = orden por puntos (seed: resultados del 1er torneo).

RETÁS (hasta 3 arriba):
  Ganás   → +base + bonus por distancia (ganarle al de 3 arriba > al de 1 arriba)
  Perdés  → +puntos de participación (chico, fijo). Jugar SIEMPRE suma algo.

TE RETAN (defensa):
  No podés rechazar libremente. Rechazar de más = penalización.
  Perdés contra alguien de abajo → te cuesta (o no sumás). Hay algo en juego.

CADA MES:
  Jugaste tus retos mínimos → mantenés el acceso prioritario a reserva (premio)
  No llegaste / rechazaste de más → volvés a reserva día-anterior (app del club)
```

## 6. Decisión filosófica grande (PENDIENTE de Raphael)

**¿Qué mide el ranking?**
- **(A) Habilidad pura** — suma cero estilo ELO (lo que gana el ganador lo pierde el perdedor).
  Justo deportivamente, pero el perdedor *resta* → choca con "premiar participación".
- **(B) Compromiso + habilidad** — suma positiva con decaimiento; todos suman por jugar, la
  inactividad baja. Mide "qué tan bueno Y qué tan activo sos".

PO se inclina por **(B)** para un producto de enganche de socios (las categorías A/B/C ya
separan niveles, así que sumar actividad no rompe la competitividad).

## 7. Preguntas abiertas (para próxima sesión)

1. ¿Ranking mide **(A) habilidad pura** o **(B) compromiso+habilidad**?
2. **Categorías**: ¿A/B/C son **tres escaleras separadas** (retás dentro de tu categoría) o
   **una sola escalera** con A/B/C como zonas?
3. **Capacidad de cancha**: ¿cuántos partidos por semana entran realisticamente? (Calibra los mínimos.)
4. Números concretos: mínimo/máximo de retos (¿semanal o mensual?), cuántos rechazos antes de penalizar.
5. Fórmula de puntos concreta: base, bonus por distancia, puntos de participación del perdedor.
6. ¿Hay **temporadas** (reset/cadencia mensual) aunque no haya campeón? Da ritmo a penalizaciones y premios.

## 8. Reutilización del código existente

- Flujo `PENDING → CONFIRMED` de partidos y `SlotReservation` ya construidos para el torneo.
- Ranking: `ranking-service.ts` existe como estructura (cálculo estaba pendiente de definir con Mati).
- Modelos: Player ya tiene `withdrawnAt`; Match tiene `stage`/bracket (para torneos), no necesariamente para la liga.
```
