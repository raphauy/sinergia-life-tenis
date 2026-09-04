/**
 * ONE-OFF — aviso puntual a los jugadores con partidos de La Escalera sin resultado.
 *
 * Va firmado por Raphael y les anticipa que desde ahora la app manda un recordatorio
 * automático por día hasta que carguen el resultado o cancelen el partido. Se manda una
 * sola vez, antes de que el cron `result-reminders` empiece a correr; después de eso el
 * script no tiene razón de existir y se puede borrar.
 *
 * Uso:
 *   pnpm tsx scripts/aviso-resultados-pendientes.tsx                    # dry-run: lista y muestra el mail
 *   pnpm tsx scripts/aviso-resultados-pendientes.tsx --test <email>     # un solo mail de prueba
 *   pnpm tsx scripts/aviso-resultados-pendientes.tsx --send             # envía a los jugadores
 *
 * Contra otra base (la de prod, por ejemplo):
 *   TARGET_DATABASE_URL='postgres://...' pnpm tsx scripts/aviso-resultados-pendientes.tsx
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'
import { Resend } from 'resend'
import { render } from '@react-email/components'
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
import { theme } from '../src/components/emails/email-theme'
import { longDateTimeUY } from '../src/lib/date-utils'
import { fullName } from '../src/lib/format-name'
import { TIMEZONE } from '../src/lib/constants'
import { toZonedTime } from 'date-fns-tz'
import { differenceInCalendarDays } from 'date-fns'

const SEND = process.argv.includes('--send')
/** `--test <email>`: manda UN solo mail, con los datos reales del más atrasado, a esa dirección. */
const TEST_TO = (() => {
  const i = process.argv.indexOf('--test')
  return i >= 0 ? process.argv[i + 1] ?? null : null
})()
const DB_URL = process.env.TARGET_DATABASE_URL || process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://life-tenis.raphauy.dev'

const prisma = new PrismaClient({ datasourceUrl: DB_URL })
const resend = new Resend(process.env.RESEND_API_KEY)
const fromEmail = process.env.EMAIL_FROM || 'Life Tenis <life-tenis@raphauy.dev>'

/**
 * Resend NO lanza ante un error de API: devuelve `{ data, error }`. Sin mirar `error`,
 * una key inválida o un dominio no verificado pasan por éxito silencioso.
 */
async function enviar(to: string, props: MailProps) {
  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to,
    subject: 'Falta cargar el resultado de tu partido - Life Tenis',
    react: AvisoEmail(props),
  })
  if (error) throw new Error(`${error.name ?? 'error'}: ${error.message ?? JSON.stringify(error)}`)
  return data?.id ?? '(sin id)'
}

interface MailProps {
  playerName: string
  rivalName: string
  matchLabel: string
  daysLate: number
  actionUrl: string
}

function AvisoEmail({ playerName, rivalName, matchLabel, daysLate, actionUrl }: MailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: theme.colors.background, fontFamily: theme.fonts.sans, padding: '20px 0' }}>
        <Container style={{ backgroundColor: theme.colors.cardBg, borderRadius: '8px', padding: '40px', maxWidth: '480px', margin: '0 auto', border: `1px solid ${theme.colors.border}` }}>
          <Section style={{ textAlign: 'center' as const, margin: '0 0 24px' }}>
            <Img src={`${APP_URL}/life-logo.png`} alt="Life Tenis" width="200" style={{ margin: '0 auto' }} />
          </Section>
          <Hr style={{ borderColor: theme.colors.border }} />
          <Text style={{ fontSize: '16px', color: theme.colors.text, margin: '24px 0 8px' }}>
            Hola {playerName},
          </Text>
          <Text style={{ fontSize: '14px', color: theme.colors.text, margin: '0 0 16px' }}>
            Estuve mirando La Escalera y quedaron varios partidos sin resultado. El tuyo contra{' '}
            <strong>{rivalName}</strong> ({matchLabel}) sigue sin cargar hace{' '}
            <strong>{daysLate} {daysLate === 1 ? 'día' : 'días'}</strong>.
          </Text>
          <Text style={{ fontSize: '14px', color: theme.colors.text, margin: '0 0 16px' }}>
            Cargarlo lleva menos de un minuto y lo puede hacer cualquiera de los dos. Mientras no
            esté, los puntos no se mueven y el partido <strong>no cuenta para tu mínimo del mes</strong>.
            Y si al final no llegaron a jugarlo, desde esa misma pantalla pueden cancelarlo y
            coordinar una fecha nueva: el reto sigue en pie, no hace falta volver a retarse.
          </Text>
          <Text style={{ fontSize: '14px', color: theme.colors.text, margin: '0 0 16px' }}>
            Aviso que desde ahora la app manda un recordatorio <strong>todos los días</strong> hasta
            que el partido se cargue o se cancele. Así que si no querés que te llegue todas las
            mañanas, ya sabés 🙂
          </Text>
          <Section style={{ textAlign: 'center' as const, margin: '0 0 16px' }}>
            <a href={actionUrl} style={{ display: 'inline-block', backgroundColor: theme.colors.primary, color: '#ffffff', textDecoration: 'none', padding: '10px 22px', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold' }}>
              Cargar el resultado
            </a>
          </Section>
          <Text style={{ fontSize: '14px', color: theme.colors.text, margin: '0 0 4px' }}>
            Gracias!
          </Text>
          <Text style={{ fontSize: '14px', color: theme.colors.text, margin: '0 0 16px' }}>
            Raphael
          </Text>
          <Hr style={{ borderColor: theme.colors.border, margin: '16px 0 0' }} />
          <Text style={{ fontSize: '12px', color: theme.colors.textMuted, margin: '16px 0 0' }}>
            Cualquier duda o problema con la app, escribile a{' '}
            <a href="https://wa.me/59899523201" style={{ color: theme.colors.primary, textDecoration: 'underline' }}>Mati</a>.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

async function main() {
  console.log(`BD:   ${DB_URL?.replace(/:[^:@/]+@/, ':****@')}`)
  console.log(`Modo: ${TEST_TO ? `prueba -> ${TEST_TO}` : SEND ? '*** ENVÍO REAL ***' : 'dry-run (agregá --send para enviar)'}\n`)

  const ladder = await prisma.ladder.findFirst({ where: { isActive: true }, select: { id: true, name: true } })
  if (!ladder) {
    console.log('No hay escalera activa.')
    return
  }

  const now = new Date()
  const nowUY = toZonedTime(now, TIMEZONE)
  const matches = await prisma.match.findMany({
    where: { ladderId: ladder.id, status: 'CONFIRMED', result: null, scheduledAt: { lt: now } },
    select: {
      id: true,
      scheduledAt: true,
      confirmedAt: true,
      player1Id: true,
      player2Id: true,
      player1: { select: { email: true, firstName: true, lastName: true } },
      player2: { select: { email: true, firstName: true, lastName: true } },
    },
  })

  // Mismo ancla que el cron: un partido autoagendado hacia atrás (hasta 5 días) no
  // arrastra ese atraso desde el día que se registró.
  const overdue = matches
    .map((m) => {
      const scheduledAt = m.scheduledAt!
      const since = m.confirmedAt && m.confirmedAt > scheduledAt ? m.confirmedAt : scheduledAt
      return { m, daysLate: differenceInCalendarDays(nowUY, toZonedTime(since, TIMEZONE)) }
    })
    .filter((r) => r.daysLate >= 1)
    .sort((a, b) => b.daysLate - a.daysLate)

  if (overdue.length === 0) {
    console.log('No hay partidos atrasados. Nada para mandar.')
    return
  }

  const userIds = overdue.flatMap(({ m }) => [m.player1Id, m.player2Id]).filter((id): id is string => !!id)
  const players = await prisma.player.findMany({
    where: { userId: { in: userIds }, isActive: true },
    select: { slug: true, userId: true },
  })
  const slugMap = new Map(players.map((p) => [p.userId!, p.slug]))

  console.log(`${overdue.length} partidos sin resultado en ${ladder.name}:\n`)
  const jobs: { to: string; props: MailProps }[] = []

  for (const { m, daysLate } of overdue) {
    const p1Name = fullName(m.player1?.firstName, m.player1?.lastName) || 'Jugador'
    const p2Name = fullName(m.player2?.firstName, m.player2?.lastName) || 'Jugador'
    const matchLabel = longDateTimeUY(m.scheduledAt!)
    console.log(`  ${String(daysLate).padStart(3)}d · ${matchLabel} · ${p1Name} vs ${p2Name}`)

    for (const [self, selfName, rivalName, selfId] of [
      [m.player1, p1Name, p2Name, m.player1Id],
      [m.player2, p2Name, p1Name, m.player2Id],
    ] as const) {
      if (!self?.email) {
        console.log(`        (sin email: ${selfName})`)
        continue
      }
      const slug = selfId ? slugMap.get(selfId) ?? null : null
      jobs.push({
        to: self.email,
        props: {
          playerName: self.firstName || selfName,
          rivalName,
          matchLabel,
          daysLate,
          actionUrl: slug ? `${APP_URL}/jugador/${slug}/partidos/${m.id}` : APP_URL,
        },
      })
    }
  }

  console.log(`\n${jobs.length} emails a enviar:`)
  for (const j of jobs) console.log(`  → ${j.to}`)
  if (jobs.length === 0) {
    console.log('\nNingún jugador de los partidos atrasados tiene email. Nada para mandar.')
    return
  }

  if (TEST_TO) {
    // Los props son los del partido más atrasado, sin tocar: la idea es ver exactamente
    // el mail que van a recibir ellos, no una versión de muestra.
    const id = await enviar(TEST_TO, jobs[0].props)
    console.log(`\nPrueba enviada a ${TEST_TO} (contenido: ${jobs[0].props.playerName} vs ${jobs[0].props.rivalName}) · id ${id}`)
    console.log('No se envió nada a los jugadores.')
    return
  }

  if (!SEND) {
    console.log('\n----- preview del primer mail (texto plano) -----')
    const html = await render(AvisoEmail(jobs[0].props))
    console.log(html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim())
    console.log('\nDry-run: no se envió nada. Agregá --send para enviar.')
    return
  }

  let ok = 0
  for (const j of jobs) {
    try {
      const id = await enviar(j.to, j.props)
      ok++
      console.log(`  ✓ ${j.to} · ${id}`)
    } catch (e) {
      console.error(`  ✗ ${j.to}: ${e instanceof Error ? e.message : e}`)
    }
    // Resend limita a 2 req/s; con 1 cada 600 ms sobra margen.
    await new Promise((r) => setTimeout(r, 600))
  }
  console.log(`\nEnviados: ${ok}/${jobs.length}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
