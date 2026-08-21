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

interface LadderStaleReservationEmailProps {
  playerName: string
  rivalName: string
  /** El turno que había quedado pedido y ya pasó ("22/08 11:00 hs"). */
  slotLabel: string
  /** Hasta cuándo tienen para elegir otro ("Martes 25 de agosto"). */
  deadlineLabel: string
  actionUrl: string
}

export default function LadderStaleReservationEmail({
  playerName,
  rivalName,
  slotLabel,
  deadlineLabel,
  actionUrl,
}: LadderStaleReservationEmailProps) {
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
            El turno que habían pedido para el partido contra <strong>{rivalName}</strong>{slotLabel ? <> (<strong>{slotLabel}</strong>)</> : null} pasó sin que quedara confirmado. Liberamos la reserva así pueden pedir otro horario: <strong>el reto sigue en pie</strong> y tienen hasta el <strong>{deadlineLabel}</strong>.
          </Text>
          <Text style={{ fontSize: '14px', color: theme.colors.text, margin: '0 0 16px' }}>
            Si al final lo jugaron igual, cargalo desde el partido con la opción <strong>&quot;ya tengo cancha&quot;</strong> y subí el resultado.
          </Text>
          <Section style={{ textAlign: 'center' as const, margin: '0 0 8px' }}>
            <a href={actionUrl} style={{ display: 'inline-block', backgroundColor: theme.colors.primary, color: '#ffffff', textDecoration: 'none', padding: '10px 22px', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold' }}>
              Elegir otro horario
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

LadderStaleReservationEmail.PreviewProps = {
  playerName: 'Juan Pérez',
  rivalName: 'Carlos López',
  slotLabel: '22/08 11:00 hs',
  deadlineLabel: 'Martes 25 de agosto',
  actionUrl: 'https://life-tenis.raphauy.dev/jugador/juan-perez',
} as LadderStaleReservationEmailProps
