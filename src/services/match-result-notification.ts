import { getGroupById } from '@/services/group-service'
import { getAdminUsers } from '@/services/user-service'
import { sendMatchResultEmail, sendMatchResultEditedEmail } from '@/services/email-service'
import { formatMatchScore } from '@/lib/format-score'
import { fullName } from '@/lib/format-name'

type MatchForNotification = {
  groupId: string | null
  player1: { firstName: string | null; lastName: string | null } | null
  player2: { firstName: string | null; lastName: string | null } | null
  player1Id: string | null
  player2Id: string | null
  tournament: { name: string }
  group: { id: string; number: number } | null
  result: {
    walkover: boolean
    winnerId: string
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
    reportedBy: { firstName: string | null; lastName: string | null }
  } | null
}

/**
 * Send match result notification to all group players + admins (BCC).
 * Fire-and-forget: never throws, logs errors.
 */
export async function notifyMatchResult(match: MatchForNotification) {
  try {
    const data = await gatherNotificationData(match)
    if (!data) return

    await sendMatchResultEmail(data)
  } catch (error) {
    console.error('[EMAIL] Failed to send match result notification:', error)
  }
}

/**
 * Send match result edited notification to all group players + admins (BCC).
 * Fire-and-forget: never throws, logs errors.
 */
export async function notifyMatchResultEdited(match: MatchForNotification, adminName: string) {
  try {
    const data = await gatherNotificationData(match)
    if (!data) return

    await sendMatchResultEditedEmail({ ...data, adminName })
  } catch (error) {
    console.error('[EMAIL] Failed to send match result edited notification:', error)
  }
}

async function gatherNotificationData(match: MatchForNotification) {
  if (!match.groupId || !match.group || !match.result) return null

  const [group, admins] = await Promise.all([
    getGroupById(match.groupId),
    getAdminUsers(),
  ])

  if (!group) return null

  const toEmails = group.players
    .map((p) => p.email)
    .filter((e): e is string => !!e)

  if (toEmails.length === 0) return null

  const bccEmails = admins
    .map((a) => a.email)
    .filter((e): e is string => !!e)

  const player1Name = match.player1 ? fullName(match.player1.firstName, match.player1.lastName) || 'Jugador 1' : 'Jugador 1'
  const player2Name = match.player2 ? fullName(match.player2.firstName, match.player2.lastName) || 'Jugador 2' : 'Jugador 2'
  const winnerName = match.result.winnerId === match.player1Id ? player1Name : player2Name
  const score = formatMatchScore(match.result)

  const reportedByName = fullName(match.result.reportedBy.firstName, match.result.reportedBy.lastName) || 'Admin'

  return {
    to: toEmails,
    bcc: bccEmails,
    tournamentName: match.tournament.name,
    categoryName: group.category.name,
    groupNumber: group.number,
    player1Name,
    player2Name,
    winnerName,
    score,
    isWalkover: match.result.walkover,
    reportedByName,
  }
}
