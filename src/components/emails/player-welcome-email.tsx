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

interface PlayerWelcomeEmailProps {
  playerName: string
  panelUrl: string
  rating: number
}

export default function PlayerWelcomeEmail({
  playerName,
  panelUrl,
  rating,
}: PlayerWelcomeEmailProps) {
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
            ¡Bienvenido a La Escalera, {playerName}!
          </Text>
          <Text style={{ fontSize: '14px', color: theme.colors.text, margin: '0 0 16px' }}>
            Tu registro fue aprobado y ya formás parte de La Escalera con <strong>{rating} puntos</strong>.
            Entrás al pie de la escalera: desde acá empezás a retar y a escalar.
          </Text>
          <Section style={{ textAlign: 'center' as const, margin: '24px 0' }}>
            <Button href={panelUrl} style={{ backgroundColor: theme.colors.primary, color: '#ffffff', padding: '12px 32px', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold', textDecoration: 'none' }}>
              Ir a mi panel
            </Button>
          </Section>
          <Text style={{ fontSize: '12px', color: theme.colors.textMuted, margin: '24px 0 0' }}>
            Para entrar, iniciá sesión con este email: te enviaremos un código de un solo uso.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
