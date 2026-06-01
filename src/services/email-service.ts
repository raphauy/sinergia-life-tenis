import { Resend } from 'resend'
import OtpEmail from '@/components/emails/otp-email'
import PlayerInvitationEmail from '@/components/emails/player-invitation-email'
import AdminInvitationEmail from '@/components/emails/admin-invitation-email'
import MatchConfirmationEmail from '@/components/emails/match-confirmation-email'
import MatchRescheduledEmail from '@/components/emails/match-rescheduled-email'
import MatchCancelledEmail from '@/components/emails/match-cancelled-email'
import MatchResultEmail from '@/components/emails/match-result-email'
import MatchResultEditedEmail from '@/components/emails/match-result-edited-email'
import ChallengeReceivedEmail from '@/components/emails/challenge-received-email'
import ChallengeAcceptedEmail from '@/components/emails/challenge-accepted-email'
import ChallengeRejectedEmail from '@/components/emails/challenge-rejected-email'
import LadderMatchCancelledEmail from '@/components/emails/ladder-match-cancelled-email'
import LadderPenaltyAppliedEmail from '@/components/emails/ladder-penalty-applied-email'
import LadderMonthClosingWarningEmail from '@/components/emails/ladder-month-closing-warning-email'
import LadderMatchExpiryWarningEmail from '@/components/emails/ladder-match-expiry-warning-email'
import LadderMatchAutoCancelledEmail from '@/components/emails/ladder-match-auto-cancelled-email'

const isDev = process.env.NODE_ENV === 'development'
const resend = new Resend(process.env.RESEND_API_KEY)
const fromEmail = process.env.EMAIL_FROM || 'Life Tenis <noreply@sinergialifetenis.com>'

// ===================== OTP =====================

export async function sendOtpEmail(input: { to: string; otp: string }) {
  console.log(`[EMAIL] OTP for ${input.to}: ${input.otp}`)
  if (isDev) return

  await resend.emails.send({
    from: fromEmail,
    to: input.to,
    subject: 'Tu código de verificación - Life Tenis',
    react: OtpEmail({ otp: input.otp }),
  })
}

// ===================== Player Invitation =====================

export async function sendPlayerInvitationEmail(input: {
  to: string
  playerName: string
  tournamentName: string
  categoryName: string
  acceptUrl: string
}) {
  console.log(`[EMAIL] Player invitation to ${input.to} (${input.playerName}) - ${input.tournamentName}`)
  if (isDev) return

  await resend.emails.send({
    from: fromEmail,
    to: input.to,
    subject: `Invitación al torneo ${input.tournamentName} - Life Tenis`,
    react: PlayerInvitationEmail({
      playerName: input.playerName,
      tournamentName: input.tournamentName,
      categoryName: input.categoryName,
      acceptUrl: input.acceptUrl,
    }),
  })
}

// ===================== Admin Invitation =====================

export async function sendAdminInvitationEmail(input: {
  to: string
  inviterName: string
  acceptUrl: string
}) {
  console.log(`[EMAIL] Admin invitation to ${input.to} by ${input.inviterName}`)
  if (isDev) return

  await resend.emails.send({
    from: fromEmail,
    to: input.to,
    subject: 'Invitación de administrador - Life Tenis',
    react: AdminInvitationEmail({
      inviterName: input.inviterName,
      acceptUrl: input.acceptUrl,
    }),
  })
}

// ===================== Match Confirmation =====================

export async function sendMatchConfirmationEmail(input: {
  to: string
  playerName: string
  rivalName: string
  tournamentName: string
  date: string
  time: string
  courtName: string
  stageLabel?: string
}) {
  console.log(`[EMAIL] Match confirmation to ${input.to} - ${input.playerName} vs ${input.rivalName} - ${input.date} ${input.time}${input.stageLabel ? ` (${input.stageLabel})` : ''}`)
  if (isDev) return

  await resend.emails.send({
    from: fromEmail,
    to: input.to,
    subject: `${input.stageLabel ? `${input.stageLabel} confirmada` : 'Partido confirmado'} - ${input.tournamentName} - Life Tenis`,
    react: MatchConfirmationEmail({
      playerName: input.playerName,
      rivalName: input.rivalName,
      tournamentName: input.tournamentName,
      date: input.date,
      time: input.time,
      courtName: input.courtName,
      stageLabel: input.stageLabel,
    }),
  })
}

// ===================== Match Rescheduled =====================

export async function sendMatchRescheduledEmail(input: {
  to: string
  playerName: string
  rivalName: string
  tournamentName: string
  date: string
  time: string
  courtName: string
}) {
  console.log(`[EMAIL] Match rescheduled to ${input.to} - ${input.playerName} vs ${input.rivalName} - ${input.date} ${input.time}`)
  if (isDev) return

  await resend.emails.send({
    from: fromEmail,
    to: input.to,
    subject: `Partido reprogramado - ${input.tournamentName} - Life Tenis`,
    react: MatchRescheduledEmail({
      playerName: input.playerName,
      rivalName: input.rivalName,
      tournamentName: input.tournamentName,
      date: input.date,
      time: input.time,
      courtName: input.courtName,
    }),
  })
}

// ===================== Match Cancelled =====================

export async function sendMatchCancelledEmail(input: {
  to: string
  playerName: string
  rivalName: string
  tournamentName: string
  date: string
  time: string
  courtName: string
  reason: string
  cancelledByName: string
}) {
  console.log(`[EMAIL] Match cancelled to ${input.to} - ${input.playerName} vs ${input.rivalName} - reason: ${input.reason}`)
  if (isDev) return

  await resend.emails.send({
    from: fromEmail,
    to: input.to,
    subject: `Partido cancelado - ${input.tournamentName} - Life Tenis`,
    react: MatchCancelledEmail({
      playerName: input.playerName,
      rivalName: input.rivalName,
      tournamentName: input.tournamentName,
      date: input.date,
      time: input.time,
      courtName: input.courtName,
      reason: input.reason,
      cancelledByName: input.cancelledByName,
    }),
  })
}

// ===================== Match Result =====================

export async function sendMatchResultEmail(input: {
  to: string[]
  bcc: string[]
  tournamentName: string
  categoryName: string
  groupNumber: number
  player1Name: string
  player2Name: string
  winnerName: string
  score: string
  isWalkover: boolean
  reportedByName: string
}) {
  console.log(`[EMAIL] Match result: ${input.player1Name} vs ${input.player2Name} - ${input.score} -> to ${input.to.length} recipients, bcc ${input.bcc.length}`)
  if (isDev) return

  await resend.emails.send({
    from: fromEmail,
    to: input.to,
    bcc: input.bcc,
    subject: `Resultado: ${input.player1Name} vs ${input.player2Name} - ${input.tournamentName} - Life Tenis`,
    react: MatchResultEmail({
      tournamentName: input.tournamentName,
      categoryName: input.categoryName,
      groupNumber: input.groupNumber,
      player1Name: input.player1Name,
      player2Name: input.player2Name,
      winnerName: input.winnerName,
      score: input.score,
      isWalkover: input.isWalkover,
      reportedByName: input.reportedByName,
    }),
  })
}

// ===================== Match Result Edited =====================

export async function sendMatchResultEditedEmail(input: {
  to: string[]
  bcc: string[]
  adminName: string
  tournamentName: string
  categoryName: string
  groupNumber: number
  player1Name: string
  player2Name: string
  winnerName: string
  score: string
  isWalkover: boolean
}) {
  console.log(`[EMAIL] Match result edited by ${input.adminName}: ${input.player1Name} vs ${input.player2Name} - ${input.score} -> to ${input.to.length} recipients, bcc ${input.bcc.length}`)
  if (isDev) return

  await resend.emails.send({
    from: fromEmail,
    to: input.to,
    bcc: input.bcc,
    subject: `Resultado editado: ${input.player1Name} vs ${input.player2Name} - ${input.tournamentName} - Life Tenis`,
    react: MatchResultEditedEmail({
      adminName: input.adminName,
      tournamentName: input.tournamentName,
      categoryName: input.categoryName,
      groupNumber: input.groupNumber,
      player1Name: input.player1Name,
      player2Name: input.player2Name,
      winnerName: input.winnerName,
      score: input.score,
      isWalkover: input.isWalkover,
    }),
  })
}

// ===================== La Escalera — Retos =====================

export async function sendChallengeReceivedEmail(input: {
  to: string
  challengedName: string
  challengerName: string
  respondBy: string
  ifWin: number
  ifLose: number
  actionUrl: string
}) {
  console.log(`[EMAIL] Challenge received -> ${input.to} (de ${input.challengerName})`)
  if (isDev) return

  await resend.emails.send({
    from: fromEmail,
    to: input.to,
    subject: `${input.challengerName} te retó en La Escalera - Life Tenis`,
    react: ChallengeReceivedEmail({
      challengedName: input.challengedName,
      challengerName: input.challengerName,
      respondBy: input.respondBy,
      ifWin: input.ifWin,
      ifLose: input.ifLose,
      actionUrl: input.actionUrl,
    }),
  })
}

export async function sendChallengeAcceptedEmail(input: {
  to: string
  challengerName: string
  challengedName: string
  actionUrl: string
}) {
  console.log(`[EMAIL] Challenge accepted -> ${input.to} (por ${input.challengedName})`)
  if (isDev) return

  await resend.emails.send({
    from: fromEmail,
    to: input.to,
    subject: `${input.challengedName} aceptó tu reto - La Escalera - Life Tenis`,
    react: ChallengeAcceptedEmail({
      challengerName: input.challengerName,
      challengedName: input.challengedName,
      actionUrl: input.actionUrl,
    }),
  })
}

export async function sendChallengeRejectedEmail(input: {
  to: string
  challengerName: string
  challengedName: string
}) {
  console.log(`[EMAIL] Challenge rejected -> ${input.to} (por ${input.challengedName})`)
  if (isDev) return

  await resend.emails.send({
    from: fromEmail,
    to: input.to,
    subject: `Tu reto en La Escalera - Life Tenis`,
    react: ChallengeRejectedEmail({
      challengerName: input.challengerName,
      challengedName: input.challengedName,
    }),
  })
}

export async function sendLadderMatchCancelledEmail(input: {
  to: string
  recipientName: string
  otherName: string
  cancelledByName: string
}) {
  console.log(`[EMAIL] Ladder match cancelled -> ${input.to} (por ${input.cancelledByName})`)
  if (isDev) return

  await resend.emails.send({
    from: fromEmail,
    to: input.to,
    subject: `Partido de La Escalera cancelado - Life Tenis`,
    react: LadderMatchCancelledEmail({
      recipientName: input.recipientName,
      otherName: input.otherName,
      cancelledByName: input.cancelledByName,
    }),
  })
}

// ===================== La Escalera — Compromiso mensual (Fase 3) =====================

export async function sendLadderPenaltyAppliedEmail(input: {
  to: string
  playerName: string
  points: number
  newRating: number
  monthLabel: string
  minMatches: number
  actionUrl: string
}) {
  console.log(`[EMAIL] Ladder penalty -> ${input.to} (−${input.points}, nuevo ${input.newRating}, ${input.monthLabel})`)
  if (isDev) return

  await resend.emails.send({
    from: fromEmail,
    to: input.to,
    subject: `Penalización mensual en La Escalera - Life Tenis`,
    react: LadderPenaltyAppliedEmail({
      playerName: input.playerName,
      points: input.points,
      newRating: input.newRating,
      monthLabel: input.monthLabel,
      minMatches: input.minMatches,
      actionUrl: input.actionUrl,
    }),
  })
}

export async function sendLadderMonthClosingWarningEmail(input: {
  to: string
  playerName: string
  played: number
  min: number
  daysLeft: number
  penalty: number
  actionUrl: string
}) {
  console.log(`[EMAIL] Ladder month-closing warning -> ${input.to} (${input.played}/${input.min}, ${input.daysLeft}d)`)
  if (isDev) return

  await resend.emails.send({
    from: fromEmail,
    to: input.to,
    subject: `Te faltan partidos este mes en La Escalera - Life Tenis`,
    react: LadderMonthClosingWarningEmail({
      playerName: input.playerName,
      played: input.played,
      min: input.min,
      daysLeft: input.daysLeft,
      penalty: input.penalty,
      actionUrl: input.actionUrl,
    }),
  })
}

export async function sendLadderMatchExpiryWarningEmail(input: {
  to: string
  playerName: string
  rivalName: string
  daysLeft: number
  actionUrl: string
}) {
  console.log(`[EMAIL] Ladder match expiry warning -> ${input.to} (vs ${input.rivalName}, ${input.daysLeft}d)`)
  if (isDev) return

  await resend.emails.send({
    from: fromEmail,
    to: input.to,
    subject: `Coordiná tu partido de La Escalera - Life Tenis`,
    react: LadderMatchExpiryWarningEmail({
      playerName: input.playerName,
      rivalName: input.rivalName,
      daysLeft: input.daysLeft,
      actionUrl: input.actionUrl,
    }),
  })
}

export async function sendLadderMatchAutoCancelledEmail(input: {
  to: string
  playerName: string
  rivalName: string
  actionUrl: string
}) {
  console.log(`[EMAIL] Ladder match auto-cancelled -> ${input.to} (vs ${input.rivalName})`)
  if (isDev) return

  await resend.emails.send({
    from: fromEmail,
    to: input.to,
    subject: `Partido de La Escalera cancelado - Life Tenis`,
    react: LadderMatchAutoCancelledEmail({
      playerName: input.playerName,
      rivalName: input.rivalName,
      actionUrl: input.actionUrl,
    }),
  })
}

// ===================== URL Helpers =====================

/** Panel del jugador (bandeja de retos). Cae a la home si no tiene slug. */
export function generatePlayerPanelUrl(playerSlug: string | null): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return playerSlug ? `${baseUrl}/jugador/${playerSlug}` : baseUrl
}

/** Detalle de un partido en el panel del jugador. */
export function generatePlayerMatchUrl(playerSlug: string | null, matchId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return playerSlug ? `${baseUrl}/jugador/${playerSlug}/partidos/${matchId}` : baseUrl
}

export function generatePlayerInviteUrl(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${baseUrl}/invite/player/${token}`
}

export function generateAdminInviteUrl(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${baseUrl}/invite/admin/${token}`
}
