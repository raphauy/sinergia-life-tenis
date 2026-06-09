import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Hr,
  Img,
  Button,
} from '@react-email/components'
import { theme } from './email-theme'

interface LadderProtectionCancelledEmailProps {
  recipientName: string
  protectedName: string
  reasonLabel: string
  kind: 'reto' | 'partido'
  actionUrl: string
}

export default function LadderProtectionCancelledEmail({
  recipientName,
  protectedName,
  reasonLabel,
  kind,
  actionUrl,
}: LadderProtectionCancelledEmailProps) {
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
            <strong>{protectedName}</strong> entró en <strong>Ranking protegido</strong> ({reasonLabel}),
            así que se canceló tu {kind} de <strong>La Escalera</strong>. No afecta los puntos. Vas a poder
            retarlo de nuevo cuando vuelva.
          </Text>
          <Section style={{ textAlign: 'center' as const, margin: '24px 0 0' }}>
            <Button href={actionUrl} style={{ backgroundColor: theme.colors.primary, color: '#ffffff', padding: '12px 32px', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold', textDecoration: 'none' }}>
              Ver La Escalera
            </Button>
          </Section>
          <Hr style={{ borderColor: theme.colors.border, margin: '24px 0 0' }} />
          <Text style={{ fontSize: '12px', color: theme.colors.textMuted, margin: '16px 0 0' }}>
            Cualquier duda, escribile a{' '}
            <a href="https://wa.me/59899523201" style={{ color: theme.colors.primary, textDecoration: 'underline' }}>Mati</a>.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
