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

interface MatchConfirmationEmailProps {
  playerName: string
  rivalName: string
  tournamentName: string
  date: string
  time: string
  courtName: string
  stageLabel?: string
}

export default function MatchConfirmationEmail({
  playerName,
  rivalName,
  tournamentName,
  date,
  time,
  courtName,
  stageLabel,
}: MatchConfirmationEmailProps) {
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
            {stageLabel ? (
              <>
                Tu partido de <strong>{stageLabel}</strong> contra <strong>{rivalName}</strong> en el torneo <strong>{tournamentName}</strong> ha sido confirmado:
              </>
            ) : (
              <>
                Tu partido contra <strong>{rivalName}</strong> en el torneo <strong>{tournamentName}</strong> ha sido confirmado:
              </>
            )}
          </Text>
          <Section style={{ backgroundColor: theme.colors.background, borderRadius: '8px', padding: '16px', margin: '0 0 16px' }}>
            <Text style={{ fontSize: '14px', color: theme.colors.text, margin: '0 0 4px' }}>
              <strong>Fecha:</strong> {date}
            </Text>
            <Text style={{ fontSize: '14px', color: theme.colors.text, margin: '0 0 4px' }}>
              <strong>Hora:</strong> {time}
            </Text>
            <Text style={{ fontSize: '14px', color: theme.colors.text, margin: '0' }}>
              <strong>Cancha:</strong> {courtName}
            </Text>
          </Section>
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
