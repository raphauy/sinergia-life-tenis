import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Hr,
  Img,
} from '@react-email/components'
import { theme } from './email-theme'

interface MatchCancelledEmailProps {
  playerName: string
  rivalName: string
  tournamentName: string
  date: string
  time: string
  courtName: string
  reason: string
  cancelledByName: string
}

MatchCancelledEmail.PreviewProps = {
  playerName: 'Juan Pérez',
  rivalName: 'Carlos López',
  tournamentName: 'Torneo Apertura 2026',
  date: '15/04/2026',
  time: '19:00',
  courtName: 'Cancha 1',
  reason: 'Cancelado por lluvia',
  cancelledByName: 'Mati',
} satisfies MatchCancelledEmailProps

export default function MatchCancelledEmail({
  playerName,
  rivalName,
  tournamentName,
  date,
  time,
  courtName,
  reason,
  cancelledByName,
}: MatchCancelledEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: theme.colors.background, fontFamily: theme.fonts.sans, padding: '20px 0' }}>
        <Container style={{ backgroundColor: theme.colors.cardBg, borderRadius: '8px', padding: '40px', maxWidth: '480px', margin: '0 auto', border: `1px solid ${theme.colors.border}` }}>
          <Section style={{ textAlign: 'center' as const, margin: '0 0 24px' }}>
            <Img src={theme.logoUrl} alt="Life Tenis" width="200" style={{ margin: '0 auto' }} />
          </Section>
          <Hr style={{ borderColor: theme.colors.border }} />
          <Text style={{ fontSize: '16px', color: theme.colors.text, margin: '24px 0 8px' }}>
            Hola {playerName},
          </Text>
          <Text style={{ fontSize: '14px', color: theme.colors.text, margin: '0 0 16px' }}>
            Tu partido contra <strong>{rivalName}</strong> en el torneo <strong>{tournamentName}</strong> fue cancelado.
          </Text>
          <Section style={{ backgroundColor: theme.colors.background, borderRadius: '8px', padding: '16px', margin: '0 0 16px' }}>
            <Text style={{ fontSize: '14px', color: theme.colors.text, margin: '0 0 4px' }}>
              <strong>Fecha:</strong> {date}
            </Text>
            <Text style={{ fontSize: '14px', color: theme.colors.text, margin: '0 0 4px' }}>
              <strong>Hora:</strong> {time}
            </Text>
            <Text style={{ fontSize: '14px', color: theme.colors.text, margin: '0 0 4px' }}>
              <strong>Cancha:</strong> {courtName}
            </Text>
            <Text style={{ fontSize: '14px', color: theme.colors.text, margin: '0 0 4px' }}>
              <strong>Motivo:</strong> {reason}
            </Text>
            <Text style={{ fontSize: '14px', color: theme.colors.text, margin: '0' }}>
              <strong>Cancelado por:</strong> {cancelledByName}
            </Text>
          </Section>
          <Text style={{ fontSize: '14px', color: theme.colors.text, margin: '0 0 16px' }}>
            Tu partido vuelve a estar pendiente. Coordiná con tu rival una nueva fecha y hacé una nueva reserva desde la app.
          </Text>
          <Hr style={{ borderColor: theme.colors.border, margin: '16px 0 0' }} />
          <Text style={{ fontSize: '12px', color: theme.colors.textMuted, margin: '16px 0 0' }}>
            Si tenés algún inconveniente, contactá a{' '}
            <a href="https://wa.me/59899523201" style={{ color: theme.colors.primary, textDecoration: 'underline' }}>Mati (+59899523201)</a>.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
