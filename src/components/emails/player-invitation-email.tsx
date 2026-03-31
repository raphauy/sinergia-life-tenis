import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Button,
  Hr,
  Img,
} from '@react-email/components'
import { theme } from './email-theme'

interface PlayerInvitationEmailProps {
  playerName: string
  tournamentName: string
  categoryName: string
  acceptUrl: string
}

export default function PlayerInvitationEmail({
  playerName,
  tournamentName,
  categoryName,
  acceptUrl,
}: PlayerInvitationEmailProps) {
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
          <Text style={{ fontSize: '14px', color: theme.colors.text, margin: '0 0 8px' }}>
            Has sido invitado a participar en el torneo <strong>{tournamentName}</strong> en la categoría <strong>{categoryName}</strong>.
          </Text>
          <Text style={{ fontSize: '14px', color: theme.colors.text, margin: '0 0 24px' }}>
            Hacé click en el botón para aceptar la invitación y crear tu cuenta:
          </Text>
          <Section style={{ textAlign: 'center' as const, margin: '24px 0' }}>
            <Button href={acceptUrl} style={{ backgroundColor: theme.colors.primary, color: '#ffffff', padding: '12px 32px', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold', textDecoration: 'none' }}>
              Aceptar invitación
            </Button>
          </Section>
          <Text style={{ fontSize: '12px', color: theme.colors.textMuted, margin: '24px 0 0' }}>
            Este enlace expira en 7 días.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
