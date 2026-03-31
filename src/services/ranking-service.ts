import { prisma } from '@/lib/prisma'

export interface RankingEntry {
  position: number
  player: {
    id: string
    name: string
    image: string | null
  }
  pj: number // partidos jugados
  pg: number // partidos ganados
  pp: number // partidos perdidos
  setsFor: number
  setsAgainst: number
  points: number // TODO: lógica real de puntos (pendiente Mati)
}

export async function getRankingByCategory(categoryId: string): Promise<RankingEntry[]> {
  // Get players in this category with linked users
  const players = await prisma.player.findMany({
    where: { categoryId, isActive: true, userId: { not: null } },
    include: {
      user: { select: { id: true, name: true, image: true } },
    },
  })

  // Get all PLAYED matches for this category
  const matches = await prisma.match.findMany({
    where: { categoryId, status: 'PLAYED' },
    include: { result: true },
  })

  const entries: RankingEntry[] = players
    .filter((p) => p.user)
    .map((p) => {
      const userId = p.userId!

      const playerMatches = matches.filter(
        (m) => m.player1Id === userId || m.player2Id === userId
      )

      let pg = 0
      let pp = 0
      let setsFor = 0
      let setsAgainst = 0

      for (const m of playerMatches) {
        if (!m.result) continue
        const isPlayer1 = m.player1Id === userId
        const won = m.result.winnerId === userId

        if (won) pg++
        else pp++

        // Count sets
        const s1p1 = m.result.set1Player1
        const s1p2 = m.result.set1Player2
        if (isPlayer1) {
          setsFor += s1p1 > s1p2 ? 1 : 0
          setsAgainst += s1p2 > s1p1 ? 1 : 0
        } else {
          setsFor += s1p2 > s1p1 ? 1 : 0
          setsAgainst += s1p1 > s1p2 ? 1 : 0
        }

        if (m.result.set2Player1 != null && m.result.set2Player2 != null) {
          const s2p1 = m.result.set2Player1
          const s2p2 = m.result.set2Player2
          if (isPlayer1) {
            setsFor += s2p1 > s2p2 ? 1 : 0
            setsAgainst += s2p2 > s2p1 ? 1 : 0
          } else {
            setsFor += s2p2 > s2p1 ? 1 : 0
            setsAgainst += s2p1 > s2p2 ? 1 : 0
          }
        }
      }

      return {
        position: 0,
        player: {
          id: p.id,
          name: p.user!.name || p.name,
          image: p.user!.image,
        },
        pj: pg + pp,
        pg,
        pp,
        setsFor,
        setsAgainst,
        points: pg, // TODO: lógica real de puntos
      }
    })

  // Sort by points desc, then pg desc, then sets diff desc
  entries.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.pg !== a.pg) return b.pg - a.pg
    return (b.setsFor - b.setsAgainst) - (a.setsFor - a.setsAgainst)
  })

  // Assign positions
  entries.forEach((e, i) => {
    e.position = i + 1
  })

  return entries
}
