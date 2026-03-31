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
