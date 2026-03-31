import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Button,
  Hr,
} from '@react-email/components'
import { theme } from './email-theme'

interface AdminInvitationEmailProps {
  inviterName: string
  acceptUrl: string
}

export default function AdminInvitationEmail({
  inviterName,
  acceptUrl,
}: AdminInvitationEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: theme.colors.background, fontFamily: theme.fonts.sans, padding: '20px 0' }}>
        <Container style={{ backgroundColor: theme.colors.cardBg, borderRadius: '8px', padding: '40px', maxWidth: '480px', margin: '0 auto', border: `1px solid ${theme.colors.border}` }}>
          <Text style={{ fontSize: '20px', fontWeight: 'bold', color: theme.colors.primary, textAlign: 'center' as const, margin: '0 0 24px' }}>
            Sinergia Life Tenis
          </Text>
          <Hr style={{ borderColor: theme.colors.border }} />
          <Text style={{ fontSize: '16px', color: theme.colors.text, margin: '24px 0 8px' }}>
            Has sido invitado como administrador
          </Text>
          <Text style={{ fontSize: '14px', color: theme.colors.text, margin: '0 0 24px' }}>
            <strong>{inviterName}</strong> te ha invitado a ser administrador de la plataforma Sinergia Life Tenis.
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
