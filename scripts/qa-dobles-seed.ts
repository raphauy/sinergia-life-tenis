/**
 * QA: 32 jugadores inventados para la Copa Summum en la base de prueba (branch Neon `dobles`).
 * Crea/actualiza los User (rol PLAYER) y, para la mitad, una ficha de singles en el torneo
 * de singles activo (sin grupo) para ejercitar la regla del slug canónico. Escribe el JSON
 * de carga en scripts/dobles/copa-summum.qa.json (o la ruta que se pase).
 * Solo para la base de prueba: nunca contra producción.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { PrismaClient } from '@prisma/client'
import { writeFileSync } from 'fs'

const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_DATABASE_URL })
const OUT = process.argv[2] ?? 'scripts/dobles/copa-summum.qa.json'

const FIRST = ['Martín','Sebastián','Nicolás','Federico','Santiago','Francisco','Alejandro','Gonzalo','Agustín','Maximiliano','Guillermo','Rodrigo','Facundo','Ignacio','Leonardo','Fernando','Joaquín','Mauricio','Marcelo','Gabriel','Daniel','Eduardo','Patricio','Valentina','Florencia','Carolina','Victoria','Natalia','Cecilia','María Noel','Javier','Raphael']
const LAST = ['Pereira','Silveira','Techera','Acosta','Olivera','Cabrera','Larrosa','Ferreira','Sosa','Machado','Núñez','Barboza','Rocha','Viera','Méndez','Píriz','Castro','Da Silva','Fernández','Gómez','Ríos','Pintos','Suárez','Correa','Martínez','Hernández','Blanco','Rodríguez Villamil','Lemos','de los Santos','Benítez','Aguirre']

async function main() {
  const singles = await prisma.tournament.findFirst({
    where: { modality: 'SINGLES', isActive: true },
    select: { id: true, slug: true, categories: { select: { id: true }, orderBy: { order: 'asc' }, take: 1 } },
  })
  const emails: string[] = []
  for (let i = 0; i < 32; i++) {
    const email = `qa.dobles.${String(i + 1).padStart(2, '0')}@life-tenis.test`
    const firstName = FIRST[i], lastName = LAST[i]
    const user = await prisma.user.upsert({
      where: { email },
      update: { firstName, lastName, role: 'PLAYER', isActive: true },
      create: { email, firstName, lastName, role: 'PLAYER', isActive: true },
    })
    // La mitad con ficha de singles (sin grupo): su slug canónico debe ser el de singles.
    if (i % 2 === 0 && singles?.categories[0]) {
      const slug = `${firstName} ${lastName}`.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      const exists = await prisma.player.findFirst({ where: { userId: user.id, categoryId: singles.categories[0].id } })
      if (!exists) {
        await prisma.player.create({
          data: { tournamentId: singles.id, categoryId: singles.categories[0].id, userId: user.id, email, firstName, lastName, slug: `${slug}-qa`, acceptedAt: new Date() },
        })
      }
    }
    emails.push(email)
  }
  const groups = ['A', 'B', 'C', 'D'].map((name, g) => ({
    name,
    startTime: `${String(8 + g).padStart(2, '0')}:00`,
    pairs: [0, 1, 2, 3].map((p) => [emails[g * 8 + p * 2], emails[g * 8 + p * 2 + 1]]),
  }))
  const json = {
    tournament: { name: 'Copa Summum', slug: 'copa-summum', date: '2026-11-14', description: 'Torneo de dobles por grupos con Copa de Oro y Copa de Plata.' },
    groups,
    finals: { semis: ['12:00', '12:30'], final: '13:00', courts: [1, 2] },
    matchMinutes: 20,
  }
  writeFileSync(OUT, JSON.stringify(json, null, 2))
  console.log(`32 usuarios QA listos (16 con ficha de singles en ${singles?.slug ?? 'ningún torneo'}); JSON en ${OUT}`)
}
main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
