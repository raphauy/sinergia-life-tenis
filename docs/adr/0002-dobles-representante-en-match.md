---
status: accepted
date: 2026-11-09
---

# Un partido de dobles sigue teniendo un `User` por lado: el representante de la pareja

Para el torneo de dobles del 14/11/2026 (5 días de plazo) hay que meter parejas en un `Match` que tiene un `User` por lado (`player1Id`/`player2Id`) y un `winnerId` que es un `User`; el ranking de grupo, la clasificación al bracket y la propagación de ganadores (~35 archivos) asumen eso. Decidimos **no** tocar `Match` ni `MatchResult`: la pareja es una entidad aparte (`DoublesPair`, dos `Player` de la categoría) y en el lado del partido y en `winnerId` va el `User` de uno de los dos, el **representante** (`captainPlayerId`); el compañero se deriva buscando la pareja por (categoría, usuario). `Tournament.modality` (`SINGLES | DOUBLES`) indica cuándo leer así. La asimetría es solo de código: en UI la pareja es simétrica y nadie elige ni ve al representante (es el primero tal como el club mandó la pareja).

## Considered Options

- **Columnas `player1PartnerId`/`player2PartnerId` en `Match`**: display trivial, pero `propagateWinner`/`retractWinner`/`refreshBracketSlotsFromGroup` tendrían que arrastrar al compañero y la tabla de grupo igual necesita la pareja antes del primer partido (otra tabla o campo en `Player`). Dos fuentes de verdad.
- **`team1Id`/`team2Id` en `Match`**: modelo más puro, pero vuelve polimórfico el lado del partido para singles, escalera y dobles a la vez. No entra en 5 días.

## Consequences

- Ranking, clasificación y bracket no se modifican; operan sobre el representante.
- Toda lectura de un partido de dobles (cards, detalle, "Próximos partidos", autorización para cargar resultado) pasa por un lookup de pareja. Olvidarlo muestra una persona donde va una pareja o deja afuera al compañero.
- Si algún día el dobles se vuelve permanente o necesita estadísticas por persona dentro de la pareja, hay que revisar esta decisión (y probablemente ir a `team1Id`/`team2Id`).
