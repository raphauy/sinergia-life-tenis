/**
 * Backfill de User.displayName (#11): a cada User sin nombre para mostrar y con
 * nombre cargado le pone el sugerido por suggestDisplayName ("Rapha C.").
 * Los que ya tienen displayName no se tocan.
 *
 * Es un script de UNA SOLA VEZ (al deployar el #11). No volver a correrlo: un
 * displayName null también significa que el usuario lo vació a propósito en
 * /perfil para mostrar su nombre completo, y una segunda corrida se lo rellena.
 *
 * Uso:
 *   pnpm tsx scripts/backfill-display-name.ts            # escribe
 *   pnpm tsx scripts/backfill-display-name.ts --dry-run  # solo muestra
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
config()

import { PrismaClient } from '@prisma/client'
import { DISPLAY_NAME_MIN, suggestDisplayName } from '../src/lib/display-name'

const prisma = new PrismaClient()
const dryRun = process.argv.includes('--dry-run')

async function main() {
  const host = (process.env.DATABASE_URL ?? '').match(/@([^/]+)/)?.[1] ?? '?'
  console.log(`Base: ${host}${dryRun ? ' (dry-run)' : ''}\n`)

  const users = await prisma.user.findMany({
    where: { displayName: null },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      // Fallback: hay usuarios con el nombre solo en su inscripción (Player).
      players: { select: { firstName: true, lastName: true }, orderBy: { createdAt: 'asc' }, take: 1 },
    },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  })

  const updated: { name: string; displayName: string }[] = []
  const skipped: { email: string; reason: string }[] = []

  for (const u of users) {
    const source = u.firstName?.trim() || u.lastName?.trim() ? u : (u.players[0] ?? u)
    const name = [source.firstName, source.lastName].map((s) => s?.trim()).filter(Boolean).join(' ')
    if (!name) {
      skipped.push({ email: u.email, reason: 'sin nombre' })
      continue
    }
    const displayName = suggestDisplayName({ firstName: source.firstName, lastName: source.lastName })
    if (!displayName || displayName.length < DISPLAY_NAME_MIN) {
      skipped.push({ email: u.email, reason: `sugerencia inválida (${JSON.stringify(displayName)})` })
      continue
    }
    if (!dryRun) {
      // displayName: null en el where → no pisa uno cargado entre la lectura y la escritura.
      const { count } = await prisma.user.updateMany({ where: { id: u.id, displayName: null }, data: { displayName } })
      if (count === 0) continue
    }
    updated.push({ name, displayName })
  }

  if (updated.length) console.table(updated)
  console.log(`\n${dryRun ? 'A actualizar' : 'Actualizados'}: ${updated.length}`)
  const total = await prisma.user.count()
  console.log(`Ya tenían displayName (no se tocan): ${total - users.length}`)
  if (skipped.length) {
    console.log(`No se pudo: ${skipped.length}`)
    console.table(skipped)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
