import { prisma } from '@/lib/prisma'
import { getLadderResultDeltas, scoreFromPerspective } from '@/services/ladder-stats-service'

/** Un cruce del historial, orientado al player1 de la card que lo muestra. */
export interface HeadToHeadMatch {
  matchId: string
  /** Fecha del partido (playedAt, o el slot agendado si no hay). */
  date: Date
  /** true si lo ganó el player1 de la card. */
  wonByPlayer1: boolean
  walkover: boolean
  /** Marcador con los games del GANADOR primero (o 'W/O'): se lee solo. */
  score: string
  /** Puntos de Rating que cambiaron de manos en ese cruce (null si no hay fila MATCH). */
  disputedPoints: number | null
  /** true si es el partido de la card (el historial incluye el partido en curso). */
  isCurrent: boolean
}

/** Head-to-head de escalera entre los dos jugadores de un partido. */
export interface HeadToHead {
  /** Victorias del player1 de la card. */
  player1Wins: number
  /** Victorias del player2 de la card. */
  player2Wins: number
  /** Cruces totales (incluye el partido de la card si ya se jugó). */
  total: number
  /** Cruces del más reciente al más viejo. */
  matches: HeadToHeadMatch[]
}

const h2hSelect = {
  id: true,
  ladderId: true,
  status: true,
  playedAt: true,
  scheduledAt: true,
  createdAt: true,
  player1Id: true,
  player2Id: true,
  result: {
    select: {
      walkover: true,
      winnerId: true,
      set1Player1: true,
      set1Player2: true,
      tb1Player1: true,
      tb1Player2: true,
      set2Player1: true,
      set2Player2: true,
      tb2Player1: true,
      tb2Player2: true,
      superTbPlayer1: true,
      superTbPlayer2: true,
    },
  },
}

/** Clave simétrica de un par de jugadores dentro de una escalera. */
function pairKey(ladderId: string, a: string, b: string): string {
  return a < b ? `${ladderId}|${a}|${b}` : `${ladderId}|${b}|${a}`
}

/**
 * Historial (head-to-head) entre los dos jugadores de cada partido, para la línea
 * "N enfrentamientos · X-Y {líder}" de la card. Solo cuenta partidos de LA ESCALERA
 * jugados (incluye los ganados por walkover, que son victorias del registro) y el
 * marcador de cada cruce viene orientado al player1 de la card que lo va a mostrar.
 *
 * Map<matchId, HeadToHead> con entrada SOLO para los partidos que tienen al menos un
 * cruce distinto de sí mismos: si el par nunca se enfrentó antes no hay historial que
 * mostrar y la card no dibuja la línea.
 *
 * Una sola query para toda la lista: trae los cruces entre los jugadores involucrados
 * (superset) y arma el índice por par en memoria.
 */
export async function getHeadToHeadByMatch(
  matches: { id: string; ladderId: string | null; player1Id: string | null; player2Id: string | null }[]
): Promise<Map<string, HeadToHead>> {
  const cards = matches.filter((m) => m.ladderId && m.player1Id && m.player2Id)
  if (cards.length === 0) return new Map()

  const ladderIds = [...new Set(cards.map((m) => m.ladderId as string))]
  const userIds = [...new Set(cards.flatMap((m) => [m.player1Id as string, m.player2Id as string]))]

  const played = await prisma.match.findMany({
    where: {
      ladderId: { in: ladderIds },
      status: 'PLAYED',
      player1Id: { in: userIds },
      player2Id: { in: userIds },
    },
    select: h2hSelect,
  })
  const withResult = played.filter((m) => m.result && m.player1Id && m.player2Id)
  if (withResult.length === 0) return new Map()

  const deltaMap = await getLadderResultDeltas(withResult)

  // Cruces por par, del más reciente al más viejo.
  const dateOf = (m: (typeof withResult)[number]) => m.playedAt ?? m.scheduledAt ?? m.createdAt
  const byPair = new Map<string, typeof withResult>()
  for (const m of [...withResult].sort((a, b) => dateOf(b).getTime() - dateOf(a).getTime())) {
    const key = pairKey(m.ladderId as string, m.player1Id as string, m.player2Id as string)
    const list = byPair.get(key) ?? []
    list.push(m)
    byPair.set(key, list)
  }

  const out = new Map<string, HeadToHead>()
  for (const card of cards) {
    const p1 = card.player1Id as string
    const p2 = card.player2Id as string
    const list = byPair.get(pairKey(card.ladderId as string, p1, p2)) ?? []
    // Sin cruces previos (el único sería este mismo partido) no hay historial.
    if (list.filter((m) => m.id !== card.id).length === 0) continue

    let player1Wins = 0
    let player2Wins = 0
    const h2hMatches: HeadToHeadMatch[] = list.map((m) => {
      const result = m.result!
      const wonByPlayer1 = result.winnerId === p1
      if (wonByPlayer1) player1Wins++
      else if (result.winnerId === p2) player2Wins++
      const delta = deltaMap.get(m.id)
      const disputed = delta ? delta.player1 ?? delta.player2 : null
      return {
        matchId: m.id,
        date: dateOf(m),
        wonByPlayer1,
        walkover: result.walkover,
        // Games del ganador primero: la fila se entiende sin mirar el encabezado.
        score: result.walkover ? 'W/O' : scoreFromPerspective(result, result.winnerId === m.player1Id),
        disputedPoints: disputed != null ? Math.abs(disputed) : null,
        isCurrent: m.id === card.id,
      }
    })

    out.set(card.id, { player1Wins, player2Wins, total: h2hMatches.length, matches: h2hMatches })
  }
  return out
}
