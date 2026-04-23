/**
 * Setea Tournament.finalsDate al torneo con el slug indicado.
 *
 * Uso:
 *   pnpm tsx scripts/set-finals-date.ts <slug> <YYYY-MM-DD>
 *
 * Ejemplo:
 *   pnpm tsx scripts/set-finals-date.ts singles-apertura-2026 2026-05-09
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'
import { fromZonedTime } from 'date-fns-tz'

const TIMEZONE = 'America/Montevideo'

const prisma = new PrismaClient({
  datasourceUrl: process.env.DIRECT_DATABASE_URL,
})

async function main() {
  const [slug, dateStr] = process.argv.slice(2)

  if (!slug || !dateStr) {
    console.error('Uso: pnpm tsx scripts/set-finals-date.ts <slug> <YYYY-MM-DD>')
    process.exit(1)
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    console.error(`Fecha inválida: ${dateStr}. Formato esperado: YYYY-MM-DD.`)
    process.exit(1)
  }

  // Anchor to noon UY to avoid timezone edge cases when formatting
  const finalsDate = fromZonedTime(`${dateStr}T12:00:00`, TIMEZONE)

  const tournament = await prisma.tournament.findUnique({ where: { slug } })
  if (!tournament) {
    console.error(`Torneo con slug "${slug}" no encontrado.`)
    process.exit(1)
  }

  const updated = await prisma.tournament.update({
    where: { slug },
    data: { finalsDate },
  })

  console.log(`Torneo "${updated.name}" actualizado. finalsDate = ${updated.finalsDate?.toISOString()}`)
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
