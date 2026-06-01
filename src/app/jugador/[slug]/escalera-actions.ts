'use server'

import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import {
  createChallenge,
  acceptChallenge,
  rejectChallenge,
  cancelChallenge,
  cancelLadderMatch,
  getChallengePreview,
  type ChallengePreview,
} from '@/services/challenge-service'
import {
  sendChallengeReceivedEmail,
  sendChallengeAcceptedEmail,
  sendChallengeRejectedEmail,
  sendLadderMatchCancelledEmail,
  generatePlayerPanelUrl,
  generatePlayerMatchUrl,
} from '@/services/email-service'
import { getActivePlayerSlugByUserId } from '@/services/player-service'
import { fullName } from '@/lib/format-name'
import { formatDateUY } from '@/lib/date-utils'
import { createChallengeSchema } from '@/lib/validations/challenge'
import type { ActionResult } from '@/lib/action-types'

function userBrief(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, firstName: true, lastName: true },
  })
}

export async function getChallengePreviewAction(rivalId: string): Promise<ChallengePreview | null> {
  const session = await auth()
  if (!session?.user?.id) return null
  return getChallengePreview(session.user.id, rivalId)
}

export async function createChallengeAction(challengedId: string): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'No autenticado' }

    const parsed = createChallengeSchema.safeParse({ challengedId })
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' }
    }

    const challengerId = session.user.id
    const challenge = await createChallenge(challengerId, parsed.data.challengedId)

    // Email al retado (fire-and-forget; el preview es desde SU perspectiva).
    try {
      const [challenger, challenged, slug, preview] = await Promise.all([
        userBrief(challengerId),
        userBrief(parsed.data.challengedId),
        getActivePlayerSlugByUserId(parsed.data.challengedId),
        getChallengePreview(parsed.data.challengedId, challengerId),
      ])
      if (challenged?.email && preview) {
        await sendChallengeReceivedEmail({
          to: challenged.email,
          challengedName: fullName(challenged.firstName, challenged.lastName) || 'Jugador',
          challengerName: fullName(challenger?.firstName, challenger?.lastName) || 'Un jugador',
          respondBy: formatDateUY(challenge.respondByAt),
          ifWin: preview.ifWin,
          ifLose: preview.ifLose,
          actionUrl: generatePlayerPanelUrl(slug),
        })
      }
    } catch (e) {
      console.error('[EMAIL] challenge received:', e)
    }

    revalidatePath('/')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Error al crear el reto' }
  }
}

export async function acceptChallengeAction(challengeId: string): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'No autenticado' }

    const { matchId } = await acceptChallenge(challengeId, session.user.id)

    // Email al retador.
    try {
      const challenge = await prisma.challenge.findUnique({
        where: { id: challengeId },
        select: { challengerId: true, challengedId: true },
      })
      if (challenge) {
        const [challenger, challenged, slug] = await Promise.all([
          userBrief(challenge.challengerId),
          userBrief(challenge.challengedId),
          getActivePlayerSlugByUserId(challenge.challengerId),
        ])
        if (challenger?.email) {
          await sendChallengeAcceptedEmail({
            to: challenger.email,
            challengerName: fullName(challenger.firstName, challenger.lastName) || 'Jugador',
            challengedName: fullName(challenged?.firstName, challenged?.lastName) || 'Tu rival',
            actionUrl: generatePlayerMatchUrl(slug, matchId),
          })
        }
      }
    } catch (e) {
      console.error('[EMAIL] challenge accepted:', e)
    }

    revalidatePath('/')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Error al aceptar el reto' }
  }
}

export async function rejectChallengeAction(challengeId: string): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'No autenticado' }

    const challenge = await rejectChallenge(challengeId, session.user.id)

    try {
      const [challenger, challenged] = await Promise.all([
        userBrief(challenge.challengerId),
        userBrief(challenge.challengedId),
      ])
      if (challenger?.email) {
        await sendChallengeRejectedEmail({
          to: challenger.email,
          challengerName: fullName(challenger.firstName, challenger.lastName) || 'Jugador',
          challengedName: fullName(challenged?.firstName, challenged?.lastName) || 'Tu rival',
        })
      }
    } catch (e) {
      console.error('[EMAIL] challenge rejected:', e)
    }

    revalidatePath('/')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Error al rechazar el reto' }
  }
}

export async function cancelChallengeAction(challengeId: string): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'No autenticado' }

    await cancelChallenge(challengeId, session.user.id)

    revalidatePath('/')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Error al cancelar el reto' }
  }
}

export async function cancelLadderMatchAction(matchId: string): Promise<ActionResult> {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'No autenticado' }
    const isAdmin = session.user.role === 'SUPERADMIN' || session.user.role === 'ADMIN'

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: { player1Id: true, player2Id: true },
    })

    await cancelLadderMatch(matchId, session.user.id, isAdmin)

    // Avisar al otro jugador (o a ambos si lo canceló un admin).
    try {
      if (match?.player1Id && match?.player2Id) {
        const canceller = await userBrief(session.user.id)
        const cancelledByName = fullName(canceller?.firstName, canceller?.lastName) || 'Un jugador'
        const recipients = isAdmin
          ? [match.player1Id, match.player2Id]
          : [match.player1Id === session.user.id ? match.player2Id : match.player1Id]
        for (const rid of recipients) {
          const otherId = rid === match.player1Id ? match.player2Id : match.player1Id
          const [recipient, other] = await Promise.all([userBrief(rid), userBrief(otherId)])
          if (recipient?.email) {
            await sendLadderMatchCancelledEmail({
              to: recipient.email,
              recipientName: fullName(recipient.firstName, recipient.lastName) || 'Jugador',
              otherName: fullName(other?.firstName, other?.lastName) || 'Tu rival',
              cancelledByName,
            })
          }
        }
      }
    } catch (e) {
      console.error('[EMAIL] ladder match cancelled:', e)
    }

    revalidatePath('/')
    revalidatePath('/admin/escalera')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Error al cancelar el partido' }
  }
}
