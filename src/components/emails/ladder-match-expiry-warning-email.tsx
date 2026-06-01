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

interface LadderMatchExpiryWarningEmailProps {
  playerName: string
  rivalName: string
  daysLeft: number
  actionUrl: string
}

export default function LadderMatchExpiryWarningEmail({
  playerName,
  rivalName,
  daysLeft,
  actionUrl,
}: LadderMatchExpiryWarningEmailProps) {
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
            Tu partido de <strong>La Escalera</strong> contra <strong>{rivalName}</strong> sigue sin reservar. Si no piden cancha en {daysLeft === 1 ? 'el próximo día' : `los próximos ${daysLeft} días`}, se cancela solo.
          </Text>
          <Section style={{ textAlign: 'center' as const, margin: '0 0 8px' }}>
            <a href={actionUrl} style={{ display: 'inline-block', backgroundColor: theme.colors.primary, color: '#ffffff', textDecoration: 'none', padding: '10px 22px', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold' }}>
              Coordinar y reservar
            </a>
          </Section>
          <Hr style={{ borderColor: theme.colors.border, margin: '16px 0 0' }} />
          <Text style={{ fontSize: '12px', color: theme.colors.textMuted, margin: '16px 0 0' }}>
            Cualquier duda, escribile a{' '}
            <a href="https://wa.me/59899523201" style={{ color: theme.colors.primary, textDecoration: 'underline' }}>Mati</a>.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

LadderMatchExpiryWarningEmail.PreviewProps = {
  playerName: 'Juan Pérez',
  rivalName: 'Carlos López',
  daysLeft: 1,
  actionUrl: 'https://life-tenis.raphauy.dev/jugador/juan-perez',
} as LadderMatchExpiryWarningEmailProps
