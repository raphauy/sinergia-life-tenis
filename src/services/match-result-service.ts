import { prisma } from '@/lib/prisma'
import { refreshBracketSlotsFromGroup, propagateWinner, retractWinner } from './bracket-service'

export async function createMatchResult(data: {
  matchId: string
  reportedById: string
  walkover?: boolean
  set1Player1: number
  set1Player2: number
  tb1Player1?: number | null
  tb1Player2?: number | null
  set2Player1?: number | null
  set2Player2?: number | null
  tb2Player1?: number | null
  tb2Player2?: number | null
  superTbPlayer1?: number | null
  superTbPlayer2?: number | null
  winnerId: string
  photoUrl?: string | null
}) {
  const match = await prisma.match.findUnique({
    where: { id: data.matchId },
    include: { result: true },
  })
  if (!match) throw new Error('Partido no encontrado')
  if (match.status !== 'CONFIRMED') throw new Error('El partido debe estar confirmado para cargar resultado')
  if (match.result) throw new Error('Este partido ya tiene resultado')
  if (!match.player1Id || !match.player2Id) throw new Error('El partido no tiene ambos jugadores asignados')

  return prisma.$transaction(async (tx) => {
    const result = await tx.matchResult.create({
      data: {
        matchId: data.matchId,
        reportedById: data.reportedById,
        walkover: data.walkover ?? false,
        set1Player1: data.set1Player1,
        set1Player2: data.set1Player2,
        tb1Player1: data.tb1Player1,
        tb1Player2: data.tb1Player2,
        set2Player1: data.set2Player1,
        set2Player2: data.set2Player2,
        tb2Player1: data.tb2Player1,
        tb2Player2: data.tb2Player2,
        superTbPlayer1: data.superTbPlayer1,
        superTbPlayer2: data.superTbPlayer2,
        winnerId: data.winnerId,
        photoUrl: data.photoUrl ?? null,
      },
    })

    await tx.match.update({
      where: { id: data.matchId },
      data: { status: 'PLAYED', playedAt: new Date() },
    })

    if (match.stage === 'GROUP' && match.groupId) {
      await refreshBracketSlotsFromGroup(match.groupId, tx)
    } else if (match.stage === 'QUARTERFINAL' || match.stage === 'SEMIFINAL') {
      await propagateWinner(data.matchId, tx)
    }

    return result
  })
}

export async function updateMatchResult(
  matchId: string,
  data: {
    walkover?: boolean
    set1Player1: number
    set1Player2: number
    tb1Player1?: number | null
    tb1Player2?: number | null
    set2Player1?: number | null
    set2Player2?: number | null
    tb2Player1?: number | null
    tb2Player2?: number | null
    superTbPlayer1?: number | null
    superTbPlayer2?: number | null
    winnerId: string
  }
) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { result: true },
  })
  if (!match) throw new Error('Partido no encontrado')
  if (!match.result) throw new Error('Este partido no tiene resultado para editar')

  const previousWinnerId = match.result.winnerId
  const winnerChanged = previousWinnerId !== data.winnerId

  return prisma.$transaction(async (tx) => {
    const updated = await tx.matchResult.update({
      where: { id: match.result!.id },
      data: {
        walkover: data.walkover ?? false,
        set1Player1: data.set1Player1,
        set1Player2: data.set1Player2,
        tb1Player1: data.tb1Player1,
        tb1Player2: data.tb1Player2,
        set2Player1: data.set2Player1,
        set2Player2: data.set2Player2,
        tb2Player1: data.tb2Player1,
        tb2Player2: data.tb2Player2,
        superTbPlayer1: data.superTbPlayer1,
        superTbPlayer2: data.superTbPlayer2,
        winnerId: data.winnerId,
      },
    })

    if (winnerChanged && (match.stage === 'QUARTERFINAL' || match.stage === 'SEMIFINAL')) {
      await retractWinner(matchId, previousWinnerId, tx)
      await propagateWinner(matchId, tx)
    }

    if (match.stage === 'GROUP' && match.groupId) {
      await refreshBracketSlotsFromGroup(match.groupId, tx)
    }

    return updated
  })
}

export async function updateMatchResultPhoto(matchId: string, photoUrl: string | null) {
  return prisma.matchResult.update({
    where: { matchId },
    data: { photoUrl },
  })
}
