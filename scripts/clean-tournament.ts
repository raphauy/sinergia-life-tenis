/**
 * Script para limpiar todos los datos de torneos de la base de datos.
 * Elimina torneos, categorías, grupos, partidos, jugadores, imported players
 * y usuarios con rol PLAYER. Preserva usuarios SUPERADMIN y ADMIN.
 *
 * Uso:
 *   pnpm tsx scripts/clean-tournament.ts           # dry run (solo muestra conteos)
 *   pnpm tsx scripts/clean-tournament.ts --execute  # ejecuta la eliminación
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'
import * as readline from 'readline'

const prisma = new PrismaClient({
  datasourceUrl: process.env.DIRECT_DATABASE_URL,
})

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim().toLowerCase())
    })
  })
}

async function main() {
  const dryRun = !process.argv.includes('--execute')

  if (dryRun) {
    console.log('\n🔍 DRY RUN — no se eliminará nada. Usa --execute para ejecutar.')
  }

  // 1. Mostrar conteos actuales
  console.log('\nConteos actuales:')

  const [
    tournamentCount,
    categoryCount,
    groupCount,
    matchCount,
    resultCount,
    playerCount,
    importedCount,
    playerUserCount,
    adminUserCount,
  ] = await Promise.all([
    prisma.tournament.count(),
    prisma.tournamentCategory.count(),
    prisma.group.count(),
    prisma.match.count(),
    prisma.matchResult.count(),
    prisma.player.count(),
    prisma.importedPlayer.count(),
    prisma.user.count({ where: { role: 'PLAYER' } }),
    prisma.user.count({ where: { role: { in: ['SUPERADMIN', 'ADMIN'] } } }),
  ])

  console.log(`  - Torneos: ${tournamentCount}`)
  console.log(`  - Categorías: ${categoryCount}`)
  console.log(`  - Grupos: ${groupCount}`)
  console.log(`  - Partidos: ${matchCount}`)
  console.log(`  - Resultados: ${resultCount}`)
  console.log(`  - Jugadores: ${playerCount}`)
  console.log(`  - Imported players: ${importedCount}`)
  console.log(`  - Usuarios PLAYER (se eliminarán): ${playerUserCount}`)
  console.log(`  - Usuarios ADMIN/SUPERADMIN (se preservarán): ${adminUserCount}`)

  if (tournamentCount === 0 && playerCount === 0 && playerUserCount === 0) {
    console.log('\nNo hay datos para eliminar.')
    process.exit(0)
  }

  if (dryRun) {
    console.log('\nPara ejecutar la eliminación: pnpm tsx scripts/clean-tournament.ts --execute')
    process.exit(0)
  }

  // 2. Pedir confirmación
  console.log('\nEsta acción eliminará PERMANENTEMENTE todos los datos de torneos y usuarios PLAYER.')
  console.log('Se PRESERVARÁN: usuarios SUPERADMIN y ADMIN.\n')

  const answer = await ask('Escribe "eliminar" para confirmar: ')

  if (answer !== 'eliminar') {
    console.log('Operación cancelada.')
    process.exit(0)
  }

  // 3. Ejecutar eliminación en transacción
  console.log('\nEliminando datos...\n')

  const result = await prisma.$transaction(
    async (tx) => {
      const deleted: Record<string, number> = {}

      deleted.matchResults = (await tx.matchResult.deleteMany()).count
      console.log(`  1. Match results: ${deleted.matchResults}`)

      deleted.matches = (await tx.match.deleteMany()).count
      console.log(`  2. Matches: ${deleted.matches}`)

      deleted.importedPlayers = (await tx.importedPlayer.deleteMany()).count
      console.log(`  3. Imported players: ${deleted.importedPlayers}`)

      deleted.players = (await tx.player.deleteMany()).count
      console.log(`  4. Players: ${deleted.players}`)

      deleted.groups = (await tx.group.deleteMany()).count
      console.log(`  5. Groups: ${deleted.groups}`)

      deleted.categories = (await tx.tournamentCategory.deleteMany()).count
      console.log(`  6. Categories: ${deleted.categories}`)

      deleted.tournaments = (await tx.tournament.deleteMany()).count
      console.log(`  7. Tournaments: ${deleted.tournaments}`)

      // OTP tokens de usuarios PLAYER
      deleted.otpTokens = (
        await tx.otpToken.deleteMany({
          where: { user: { role: 'PLAYER' } },
        })
      ).count
      console.log(`  8. OTP tokens (PLAYER): ${deleted.otpTokens}`)

      deleted.playerUsers = (
        await tx.user.deleteMany({
          where: { role: 'PLAYER' },
        })
      ).count
      console.log(`  9. Users (PLAYER): ${deleted.playerUsers}`)

      return deleted
    },
    { timeout: 120000 },
  )

  // 4. Resumen
  console.log('\n=== RESUMEN ===')
  console.log(`Torneos eliminados: ${result.tournaments}`)
  console.log(`Partidos eliminados: ${result.matches}`)
  console.log(`Jugadores eliminados: ${result.players}`)
  console.log(`Usuarios PLAYER eliminados: ${result.playerUsers}`)
  console.log('\nOperación completada exitosamente.')
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
