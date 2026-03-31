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

interface OtpEmailProps {
  otp: string
}

export default function OtpEmail({ otp }: OtpEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: theme.colors.background, fontFamily: theme.fonts.sans, padding: '20px 0' }}>
        <Container style={{ backgroundColor: theme.colors.cardBg, borderRadius: '8px', padding: '40px', maxWidth: '480px', margin: '0 auto', border: `1px solid ${theme.colors.border}` }}>
          <Section style={{ textAlign: 'center' as const, margin: '0 0 8px' }}>
            <Img src={theme.logoUrl} alt="Life Tenis" width="200" style={{ margin: '0 auto' }} />
          </Section>
          <Text style={{ fontSize: '14px', color: theme.colors.textMuted, textAlign: 'center' as const, margin: '0 0 24px' }}>
            Verificación de acceso
          </Text>
          <Hr style={{ borderColor: theme.colors.border }} />
          <Text style={{ fontSize: '14px', color: theme.colors.text, margin: '24px 0 16px' }}>
            Tu código de verificación es:
          </Text>
          <Section style={{ textAlign: 'center' as const, margin: '16px 0' }}>
            <Text style={{ fontSize: '36px', fontWeight: 'bold', fontFamily: theme.fonts.mono, letterSpacing: '8px', color: theme.colors.text, margin: '0', padding: '16px', backgroundColor: theme.colors.background, borderRadius: '8px', display: 'inline-block' }}>
              {otp}
            </Text>
          </Section>
          <Text style={{ fontSize: '13px', color: theme.colors.textMuted, margin: '24px 0 0' }}>
            Este código expira en 10 minutos. No lo compartas con nadie.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
