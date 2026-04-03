import { Resend } from 'resend'
import OtpEmail from '@/components/emails/otp-email'
import PlayerInvitationEmail from '@/components/emails/player-invitation-email'
import AdminInvitationEmail from '@/components/emails/admin-invitation-email'
import MatchConfirmationEmail from '@/components/emails/match-confirmation-email'
import MatchRescheduledEmail from '@/components/emails/match-rescheduled-email'
import MatchResultEmail from '@/components/emails/match-result-email'
import MatchResultEditedEmail from '@/components/emails/match-result-edited-email'

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
}) {
  console.log(`[EMAIL] Match confirmation to ${input.to} - ${input.playerName} vs ${input.rivalName} - ${input.date} ${input.time}`)
  if (isDev) return

  await resend.emails.send({
    from: fromEmail,
    to: input.to,
    subject: `Partido confirmado - ${input.tournamentName} - Life Tenis`,
    react: MatchConfirmationEmail({
      playerName: input.playerName,
      rivalName: input.rivalName,
      tournamentName: input.tournamentName,
      date: input.date,
      time: input.time,
      courtName: input.courtName,
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

// ===================== URL Helpers =====================

export function generatePlayerInviteUrl(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${baseUrl}/invite/player/${token}`
}

export function generateAdminInviteUrl(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${baseUrl}/invite/admin/${token}`
}
