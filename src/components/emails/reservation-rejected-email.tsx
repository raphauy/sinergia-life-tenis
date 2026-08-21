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

interface ReservationRejectedEmailProps {
  playerName: string
  rivalName: string
  /** El turno que se había pedido ("Sábado 11:00 hs"). */
  slotLabel: string
  /** Motivo elegido por el admin ("No hay cancha disponible"). */
  reasonLabel: string
  /** Solo escalera: hasta cuándo tienen para elegir otro. null en torneo. */
  deadlineLabel: string | null
  actionUrl: string
}

export default function ReservationRejectedEmail({
  playerName,
  rivalName,
  slotLabel,
  reasonLabel,
  deadlineLabel,
  actionUrl,
}: ReservationRejectedEmailProps) {
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
            No pudimos confirmarles el turno que pidieron para el partido contra{' '}
            <strong>{rivalName}</strong> (<strong>{slotLabel}</strong>): {reasonLabel}.
          </Text>
          <Text style={{ fontSize: '14px', color: theme.colors.text, margin: '0 0 16px' }}>
            {deadlineLabel ? (
              <>Elijan otro horario cuando puedan — <strong>el reto sigue en pie</strong> y tienen hasta el <strong>{deadlineLabel}</strong>.</>
            ) : (
              <>Pueden elegir otro horario cuando les quede cómodo.</>
            )}
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

ReservationRejectedEmail.PreviewProps = {
  playerName: 'Juan Pérez',
  rivalName: 'Carlos López',
  slotLabel: 'Sábado 11:00 hs',
  reasonLabel: 'no hay cancha disponible a esa hora',
  deadlineLabel: 'Martes 25 de agosto',
  actionUrl: 'https://life-tenis.raphauy.dev/jugador/juan-perez',
} as ReservationRejectedEmailProps
