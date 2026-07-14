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

interface LadderMatchCancelledEmailProps {
  recipientName: string
  otherName: string
  cancelledByName: string
  // Partido confirmado que se suspendió: el reto sigue vivo y vuelven a coordinar.
  reopened?: boolean
}

export default function LadderMatchCancelledEmail({
  recipientName,
  otherName,
  cancelledByName,
  reopened,
}: LadderMatchCancelledEmailProps) {
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
            Hola {recipientName},
          </Text>
          <Text style={{ fontSize: '14px', color: theme.colors.text, margin: '0 0 16px' }}>
            {reopened ? (
              <>
                Se suspendió el partido de <strong>La Escalera</strong> contra <strong>{otherName}</strong> (cancelado por {cancelledByName}) y se liberó la reserva. El reto sigue en pie: no hace falta volver a retarse, solo coordinen una nueva fecha y reserven cuando puedan. No afecta los puntos.
              </>
            ) : (
              <>
                Se canceló el partido pendiente de <strong>La Escalera</strong> contra <strong>{otherName}</strong> (cancelado por {cancelledByName}). No afecta los puntos. Si quieren, pueden volver a retarse.
              </>
            )}
          </Text>
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
