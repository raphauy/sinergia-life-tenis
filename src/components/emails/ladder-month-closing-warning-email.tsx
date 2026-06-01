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

interface LadderMonthClosingWarningEmailProps {
  playerName: string
  played: number
  min: number
  daysLeft: number
  penalty: number // puntos en juego si no llega (positivo)
  actionUrl: string
}

export default function LadderMonthClosingWarningEmail({
  playerName,
  played,
  min,
  daysLeft,
  penalty,
  actionUrl,
}: LadderMonthClosingWarningEmailProps) {
  const missing = Math.max(0, min - played)
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
            Este mes llevás <strong>{played} de {min}</strong> partidos en <strong>La Escalera</strong> y quedan <strong>{daysLeft} días</strong>. Te {missing === 1 ? 'falta' : 'faltan'} <strong>{missing}</strong> para no perder puntos.
          </Text>
          <Section style={{ backgroundColor: theme.colors.background, borderRadius: '8px', padding: '16px', margin: '0 0 16px' }}>
            <Text style={{ fontSize: '14px', color: theme.colors.text, margin: '0' }}>
              Si no llegás al mínimo, a fin de mes se descuentan <strong>{penalty}</strong> puntos de tu ranking.
            </Text>
          </Section>
          <Section style={{ textAlign: 'center' as const, margin: '0 0 8px' }}>
            <a href={actionUrl} style={{ display: 'inline-block', backgroundColor: theme.colors.primary, color: '#ffffff', textDecoration: 'none', padding: '10px 22px', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold' }}>
              Retar a alguien
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

LadderMonthClosingWarningEmail.PreviewProps = {
  playerName: 'Juan Pérez',
  played: 1,
  min: 2,
  daysLeft: 3,
  penalty: 50,
  actionUrl: 'https://life-tenis.raphauy.dev/jugador/juan-perez',
} as LadderMonthClosingWarningEmailProps
