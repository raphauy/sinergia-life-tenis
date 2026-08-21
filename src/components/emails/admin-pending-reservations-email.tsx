import { Html, Head, Body, Container, Section, Text, Hr, Img } from '@react-email/components'
import { theme } from './email-theme'

/** Un bloque de reservas de un mismo día: el día ya formateado + una línea por reserva. */
interface DayBlock {
  /** "miércoles 3 de septiembre" */
  dayLabel: string
  /** ["11:00 hs · Cancha 2 · Juan Pérez vs Carlos López", ...] */
  items: string[]
}

interface AdminPendingReservationsEmailProps {
  adminName: string
  /** Total de reservas de escalera sin confirmar (incluye las de más adelante). */
  totalPending: number
  /** Las de pasado mañana: mañana a las 9 se abre la reserva del club para ese día. */
  urgent: DayBlock | null
  /** Las de mañana: la ventana de reserva del club ya pasó. */
  tomorrow: DayBlock | null
  /** Las de hoy más tarde. No disparan el aviso, pero se listan si sale igual. */
  today: DayBlock | null
  /** Cuántas quedan DESPUÉS de pasado mañana (las de hoy no cuentan acá). */
  laterCount: number
  actionUrl: string
}

const listItemStyle = {
  fontSize: '14px',
  color: theme.colors.text,
  margin: '0 0 4px',
  paddingLeft: '12px',
  borderLeft: `2px solid ${theme.colors.border}`,
}

export default function AdminPendingReservationsEmail({
  adminName,
  totalPending,
  urgent,
  tomorrow,
  today,
  laterCount,
  actionUrl,
}: AdminPendingReservationsEmailProps) {
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
            Hola {adminName},
          </Text>
          <Text style={{ fontSize: '14px', color: theme.colors.text, margin: '0 0 16px' }}>
            Tenés <strong>{totalPending} {totalPending === 1 ? 'reserva pendiente' : 'reservas pendientes'}</strong> de confirmar en La Escalera.
          </Text>

          {urgent && (
            <>
              <Text style={{ fontSize: '14px', color: theme.colors.text, margin: '0 0 8px' }}>
                <strong>{urgent.items.length} {urgent.items.length === 1 ? 'es' : 'son'} para el {urgent.dayLabel}.</strong>{' '}
                Mañana a las 9 hs se abre la reserva del club para ese día: si no la sacás antes, te pueden ganar el horario.
              </Text>
              <Section style={{ margin: '0 0 16px' }}>
                {urgent.items.map((item) => (
                  <Text key={item} style={listItemStyle}>{item}</Text>
                ))}
              </Section>
            </>
          )}

          {tomorrow && (
            <>
              <Text style={{ fontSize: '14px', color: theme.colors.text, margin: '0 0 8px' }}>
                {urgent ? 'Además, ' : ''}{tomorrow.items.length} {tomorrow.items.length === 1 ? 'es' : 'son'} para mañana ({tomorrow.dayLabel}), y la ventana de reserva del club ya pasó.
              </Text>
              <Section style={{ margin: '0 0 16px' }}>
                {tomorrow.items.map((item) => (
                  <Text key={item} style={listItemStyle}>{item}</Text>
                ))}
              </Section>
            </>
          )}

          {today && (
            <>
              <Text style={{ fontSize: '14px', color: theme.colors.text, margin: '0 0 8px' }}>
                {today.items.length === 1 ? 'Hay una para hoy más tarde' : `Hay ${today.items.length} para hoy más tarde`}:
              </Text>
              <Section style={{ margin: '0 0 16px' }}>
                {today.items.map((item) => (
                  <Text key={item} style={listItemStyle}>{item}</Text>
                ))}
              </Section>
            </>
          )}

          {laterCount > 0 && (
            <Text style={{ fontSize: '14px', color: theme.colors.textMuted, margin: '0 0 16px' }}>
              {laterCount === 1 ? 'La otra es' : `Las otras ${laterCount} son`} para más adelante.
            </Text>
          )}

          <Section style={{ textAlign: 'center' as const, margin: '0 0 8px' }}>
            <a href={actionUrl} style={{ display: 'inline-block', backgroundColor: theme.colors.primary, color: '#ffffff', textDecoration: 'none', padding: '10px 22px', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold' }}>
              Ver reservas pendientes
            </a>
          </Section>
          <Hr style={{ borderColor: theme.colors.border, margin: '16px 0 0' }} />
          <Text style={{ fontSize: '12px', color: theme.colors.textMuted, margin: '16px 0 0' }}>
            Este aviso sale todos los días a las 20 hs cuando hay reservas por confirmar en los próximos dos días.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

AdminPendingReservationsEmail.PreviewProps = {
  adminName: 'Mati',
  totalPending: 7,
  urgent: {
    dayLabel: 'miércoles 3 de septiembre',
    items: [
      '11:00 hs · Cancha 2 · Juan Pérez vs Carlos López',
      '19:30 hs · Cancha 1 · Ana Silva vs Lucía Fernández',
      '20:30 hs · Cancha 2 · Pedro Gómez vs Martín Rodríguez',
    ],
  },
  tomorrow: {
    dayLabel: 'martes 2 de septiembre',
    items: ['09:00 hs · Cancha 2 · Diego Castro vs Sebastián Núñez'],
  },
  today: {
    dayLabel: 'lunes 1 de septiembre',
    items: ['20:30 hs · Cancha 1 · Andrés Vega vs Nicolás Souza'],
  },
  laterCount: 2,
  actionUrl: 'https://life-tenis.raphauy.dev/admin',
} as AdminPendingReservationsEmailProps
