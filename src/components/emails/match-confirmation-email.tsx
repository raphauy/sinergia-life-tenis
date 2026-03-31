import {
  Html,
  Head,
  Body,
  Container,
  Font,
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
}

export default function MatchConfirmationEmail({
  playerName,
  rivalName,
  tournamentName,
  date,
  time,
  courtName,
}: MatchConfirmationEmailProps) {
  return (
    <Html>
      <Head>
        <Font fontFamily="Oswald" fallbackFontFamily={['Arial', 'sans-serif']} webFont={{ url: 'https://fonts.gstatic.com/s/oswald/v53/TK3_WkUHHAIjg75cFRf3bXL8LICs1_FvsUZiYA.woff2', format: 'woff2' }} fontWeight={700} fontStyle="normal" />
      </Head>
      <Body style={{ backgroundColor: theme.colors.background, fontFamily: theme.fonts.sans, padding: '20px 0' }}>
        <Container style={{ backgroundColor: theme.colors.cardBg, borderRadius: '8px', padding: '40px', maxWidth: '480px', margin: '0 auto', border: `1px solid ${theme.colors.border}` }}>
          <Section style={{ textAlign: 'center' as const, margin: '0 0 24px' }}>
            <Img src={theme.logoUrl} alt="Life" width="56" height="56" style={{ display: 'inline-block', verticalAlign: 'middle' }} />
            <Text style={{ fontSize: '28px', fontWeight: 700, fontFamily: theme.fonts.heading, color: theme.colors.text, display: 'inline', verticalAlign: 'middle', marginLeft: '10px', letterSpacing: '2px' }}>
              Tenis
            </Text>
          </Section>
          <Hr style={{ borderColor: theme.colors.border }} />
          <Text style={{ fontSize: '16px', color: theme.colors.text, margin: '24px 0 8px' }}>
            Hola {playerName},
          </Text>
          <Text style={{ fontSize: '14px', color: theme.colors.text, margin: '0 0 16px' }}>
            Tu partido contra <strong>{rivalName}</strong> en el torneo <strong>{tournamentName}</strong> ha sido confirmado:
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
          <Text style={{ fontSize: '12px', color: theme.colors.textMuted, margin: '16px 0 0' }}>
            Si tenés algún inconveniente, contactá al administrador del torneo.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
