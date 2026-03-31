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
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@700&display=swap');`}</style>
      </Head>
      <Body style={{ backgroundColor: theme.colors.background, fontFamily: theme.fonts.sans, padding: '20px 0' }}>
        <Container style={{ backgroundColor: theme.colors.cardBg, borderRadius: '8px', padding: '40px', maxWidth: '480px', margin: '0 auto', border: `1px solid ${theme.colors.border}` }}>
          <table align="center" cellPadding="0" cellSpacing="0" role="presentation" style={{ margin: '0 auto 24px' }}>
            <tr>
              <td style={{ verticalAlign: 'middle', paddingRight: '10px' }}>
                <Img src={theme.logoUrl} alt="Life" width="56" height="56" />
              </td>
              <td style={{ verticalAlign: 'middle' }}>
                <span style={{ fontSize: '36px', fontWeight: 700, fontFamily: theme.fonts.heading, color: theme.colors.text, letterSpacing: '2px' }}>Tenis</span>
              </td>
            </tr>
          </table>
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
