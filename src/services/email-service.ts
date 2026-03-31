import { Resend } from 'resend'
import OtpEmail from '@/components/emails/otp-email'
import PlayerInvitationEmail from '@/components/emails/player-invitation-email'
import AdminInvitationEmail from '@/components/emails/admin-invitation-email'
import MatchConfirmationEmail from '@/components/emails/match-confirmation-email'

const resend = new Resend(process.env.RESEND_API_KEY)
const fromEmail = process.env.EMAIL_FROM || 'Sinergia Life Tenis <noreply@sinergialifetenis.com>'

// ===================== OTP =====================

export async function sendOtpEmail(input: { to: string; otp: string }) {
  console.log(`[EMAIL] OTP for ${input.to}: ${input.otp}`)

  await resend.emails.send({
    from: fromEmail,
    to: input.to,
    subject: 'Tu código de verificación - Sinergia Life Tenis',
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

  await resend.emails.send({
    from: fromEmail,
    to: input.to,
    subject: `Invitación al torneo ${input.tournamentName} - Sinergia Life Tenis`,
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

  await resend.emails.send({
    from: fromEmail,
    to: input.to,
    subject: 'Invitación de administrador - Sinergia Life Tenis',
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

  await resend.emails.send({
    from: fromEmail,
    to: input.to,
    subject: `Partido confirmado - ${input.tournamentName} - Sinergia Life Tenis`,
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

// ===================== URL Helpers =====================

export function generatePlayerInviteUrl(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${baseUrl}/invite/player/${token}`
}

export function generateAdminInviteUrl(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return `${baseUrl}/invite/admin/${token}`
}
