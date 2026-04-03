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

interface MatchResultEmailProps {
  tournamentName: string
  categoryName: string
  groupNumber: number
  player1Name: string
  player2Name: string
  winnerName: string
  score: string
  isWalkover: boolean
  reportedByName: string
}

MatchResultEmail.PreviewProps = {
  tournamentName: 'Torneo Apertura 2026',
  categoryName: 'Singles A',
  groupNumber: 2,
  player1Name: 'Juan Pérez',
  player2Name: 'Carlos López',
  winnerName: 'Juan Pérez',
  score: '6-4  7-6(3)',
  isWalkover: false,
  reportedByName: 'Juan Pérez',
} satisfies MatchResultEmailProps

export default function MatchResultEmail({
  tournamentName,
  categoryName,
  groupNumber,
  player1Name,
  player2Name,
  winnerName,
  score,
  isWalkover,
  reportedByName,
}: MatchResultEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: theme.colors.background, fontFamily: theme.fonts.sans, padding: '20px 0' }}>
        <Container style={{ backgroundColor: theme.colors.cardBg, borderRadius: '8px', padding: '40px', maxWidth: '480px', margin: '0 auto', border: `1px solid ${theme.colors.border}` }}>
          <Section style={{ textAlign: 'center' as const, margin: '0 0 24px' }}>
            <Img src={theme.logoUrl} alt="Life Tenis" width="200" style={{ margin: '0 auto' }} />
          </Section>
          <Hr style={{ borderColor: theme.colors.border }} />
          <Text style={{ fontSize: '18px', fontWeight: 'bold', color: theme.colors.text, margin: '24px 0 8px' }}>
            Resultado de partido
          </Text>
          <Text style={{ fontSize: '13px', color: theme.colors.textMuted, margin: '0 0 16px' }}>
            {tournamentName} · {categoryName} · Grupo {groupNumber}
          </Text>
          <Section style={{ backgroundColor: theme.colors.background, borderRadius: '8px', padding: '16px', margin: '0 0 16px' }}>
            <Text style={{ fontSize: '15px', color: theme.colors.text, margin: '0 0 8px', textAlign: 'center' as const }}>
              <strong>{player1Name}</strong>
              <span style={{ color: theme.colors.textMuted, margin: '0 8px' }}> vs </span>
              <strong>{player2Name}</strong>
            </Text>
            <Text style={{ fontSize: '20px', fontWeight: 'bold', color: theme.colors.text, margin: '0 0 8px', textAlign: 'center' as const, fontFamily: theme.fonts.mono, letterSpacing: '1px' }}>
              {score}
            </Text>
            <Text style={{ fontSize: '14px', color: theme.colors.primary, margin: '0', textAlign: 'center' as const, fontWeight: 'bold' }}>
              {isWalkover ? `Ganador por W/O: ${winnerName}` : `Ganador: ${winnerName}`}
            </Text>
          </Section>
          <Text style={{ fontSize: '12px', color: theme.colors.textMuted, margin: '16px 0 0' }}>
            Resultado cargado por {reportedByName}.
          </Text>
          <Hr style={{ borderColor: theme.colors.border, margin: '16px 0 0' }} />
          <Text style={{ fontSize: '12px', color: theme.colors.textMuted, margin: '16px 0 0' }}>
            Este email fue enviado automáticamente a los integrantes del grupo. Si tenés alguna consulta, contactá a{' '}
            <a href="https://wa.me/59899523201" style={{ color: theme.colors.primary, textDecoration: 'underline' }}>Mati (+59899523201)</a>.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
