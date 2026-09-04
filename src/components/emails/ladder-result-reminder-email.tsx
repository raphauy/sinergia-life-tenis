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

interface LadderResultReminderEmailProps {
  playerName: string
  rivalName: string
  /** Cuándo se jugaba ("Domingo 31 de agosto a las 19:30"). */
  matchLabel: string
  /** Días de atraso: 1 = el partido fue ayer. */
  daysLate: number
  actionUrl: string
}

export default function LadderResultReminderEmail({
  playerName,
  rivalName,
  matchLabel,
  daysLate,
  actionUrl,
}: LadderResultReminderEmailProps) {
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
            Tu partido de <strong>La Escalera</strong> contra <strong>{rivalName}</strong> ({matchLabel}) todavía
            no tiene resultado{daysLate === 1 ? '' : <>, y ya pasaron <strong>{daysLate} días</strong></>}.
            Lo puede cargar cualquiera de los dos y lleva menos de un minuto.
          </Text>
          <Text style={{ fontSize: '14px', color: theme.colors.text, margin: '0 0 16px' }}>
            Mientras no esté cargado, los puntos no se mueven y el partido{' '}
            <strong>no cuenta para tu mínimo del mes</strong>.
          </Text>
          <Text style={{ fontSize: '14px', color: theme.colors.text, margin: '0 0 16px' }}>
            ¿Al final no llegaron a jugarlo? Desde esa misma pantalla pueden cancelarlo y
            coordinar una fecha nueva: <strong>el reto sigue en pie</strong>, no hace falta
            volver a retarse.
          </Text>
          <Section style={{ textAlign: 'center' as const, margin: '0 0 8px' }}>
            <a href={actionUrl} style={{ display: 'inline-block', backgroundColor: theme.colors.primary, color: '#ffffff', textDecoration: 'none', padding: '10px 22px', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold' }}>
              Cargar el resultado
            </a>
          </Section>
          <Text style={{ fontSize: '13px', color: theme.colors.textMuted, margin: '16px 0 0', textAlign: 'center' as const }}>
            Apenas cargues el resultado o canceles el partido, este aviso deja de llegarte.
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

LadderResultReminderEmail.PreviewProps = {
  playerName: 'Juan Pérez',
  rivalName: 'Carlos López',
  matchLabel: 'Domingo 31 de agosto 19:30 hs',
  daysLate: 4,
  actionUrl: 'https://life-tenis.raphauy.dev/jugador/juan-perez/partidos/abc123',
} as LadderResultReminderEmailProps
