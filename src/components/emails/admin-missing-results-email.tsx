import { Html, Head, Body, Container, Section, Text, Hr, Img } from '@react-email/components'
import { theme } from './email-theme'

interface AdminMissingResultsEmailProps {
  adminName: string
  /** Partidos que pasaron su horario y siguen sin resultado, del más atrasado al menos. */
  items: string[]
  /** Cuántos de esos ya superaron el umbral configurado. Es lo que dispara este aviso. */
  overThresholdCount: number
  /** Umbral configurado en La Escalera (`resultReminderAdminDays`). */
  thresholdDays: number
  actionUrl: string
}

const listItemStyle = {
  fontSize: '14px',
  color: theme.colors.text,
  margin: '0 0 4px',
  paddingLeft: '12px',
  borderLeft: `2px solid ${theme.colors.border}`,
}

export default function AdminMissingResultsEmail({
  adminName,
  items,
  overThresholdCount,
  thresholdDays,
  actionUrl,
}: AdminMissingResultsEmailProps) {
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
            Hay <strong>{items.length} {items.length === 1 ? 'partido' : 'partidos'}</strong> de La Escalera sin
            resultado cargado, y {overThresholdCount === 1 ? 'uno lleva' : `${overThresholdCount} llevan`}{' '}
            <strong>{thresholdDays} {thresholdDays === 1 ? 'día' : 'días'}</strong> o más. A los jugadores les
            llega el recordatorio todos los días, pero acá ya conviene que metas mano.
          </Text>

          <Section style={{ margin: '0 0 16px' }}>
            {items.map((item) => (
              <Text key={item} style={listItemStyle}>{item}</Text>
            ))}
          </Section>

          <Text style={{ fontSize: '14px', color: theme.colors.textMuted, margin: '0 0 16px' }}>
            Podés cargar el resultado vos mismo, o cancelar el partido si al final no se jugó.
          </Text>

          <Section style={{ textAlign: 'center' as const, margin: '0 0 8px' }}>
            <a href={actionUrl} style={{ display: 'inline-block', backgroundColor: theme.colors.primary, color: '#ffffff', textDecoration: 'none', padding: '10px 22px', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold' }}>
              Ver partidos en curso
            </a>
          </Section>
          <Hr style={{ borderColor: theme.colors.border, margin: '16px 0 0' }} />
          <Text style={{ fontSize: '12px', color: theme.colors.textMuted, margin: '16px 0 0' }}>
            Este aviso sale a las 9 hs cuando algún resultado lleva {thresholdDays}{' '}
            {thresholdDays === 1 ? 'día' : 'días'} o más sin cargar. El umbral se ajusta en la
            configuración de La Escalera.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

AdminMissingResultsEmail.PreviewProps = {
  adminName: 'Mati',
  items: [
    'Domingo 31 de agosto 19:30 · Lucas Espinosa vs Bruno Braga · hace 4 días',
    'Martes 2 de septiembre 19:30 · Lucas Espinosa vs Javier Bettinelli · hace 2 días',
    'Miércoles 3 de septiembre 13:30 · Gonzalo Martino vs Facundo Ramos · hace 1 día',
  ],
  overThresholdCount: 1,
  thresholdDays: 3,
  actionUrl: 'https://life-tenis.raphauy.dev/admin/escalera',
} as AdminMissingResultsEmailProps
