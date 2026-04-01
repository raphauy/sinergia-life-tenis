import { prisma } from '@/lib/prisma'
import { generateSlug } from '@/lib/utils'
import type { MatchFormat } from '@prisma/client'

export async function generateUniqueSlug(baseName: string, excludeId?: string): Promise<string> {
  const baseSlug = generateSlug(baseName) || 'torneo'
  let slug = baseSlug
  let suffix = 0

  while (true) {
    const existing = await prisma.tournament.findUnique({ where: { slug } })
    if (!existing || existing.id === excludeId) break
    suffix++
    slug = `${baseSlug}-${suffix}`
  }

  return slug
}

export async function createTournament(data: {
  name: string
  description?: string
  startDate: Date
  endDate: Date
  categories: string[]
  matchFormat?: MatchFormat
}) {
  const slug = await generateUniqueSlug(data.name)

  return prisma.tournament.create({
    data: {
      name: data.name,
      slug,
      description: data.description,
      startDate: data.startDate,
      endDate: data.endDate,
      matchFormat: data.matchFormat || 'SINGLE_SET',
      categories: {
        create: data.categories.map((name, index) => ({
          name,
          order: index,
        })),
      },
    },
    include: { categories: true },
  })
}

export async function getTournaments() {
  return prisma.tournament.findMany({
    include: {
      categories: { orderBy: { order: 'asc' } },
      _count: { select: { players: true, matches: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getTournamentById(id: string) {
  return prisma.tournament.findUnique({
    where: { id },
    include: {
      categories: { orderBy: { order: 'asc' } },
      _count: { select: { players: true, matches: true } },
    },
  })
}

export async function getTournamentBySlug(slug: string) {
  return prisma.tournament.findUnique({
    where: { slug },
    include: {
      categories: { orderBy: { order: 'asc' } },
      _count: { select: { players: true, matches: true } },
    },
  })
}

export async function updateTournament(
  id: string,
  data: {
    name?: string
    description?: string
    startDate?: Date
    endDate?: Date
    isActive?: boolean
  }
) {
  const updateData: Record<string, unknown> = { ...data }

  if (data.name) {
    updateData.slug = await generateUniqueSlug(data.name, id)
  }

  return prisma.tournament.update({
    where: { id },
    data: updateData,
    include: { categories: { orderBy: { order: 'asc' } } },
  })
}

export async function getTournamentStats(id: string) {
  const [players, matches, groups] = await Promise.all([
    prisma.player.count({ where: { tournamentId: id } }),
    prisma.match.count({ where: { tournamentId: id } }),
    prisma.group.count({ where: { category: { tournamentId: id } } }),
  ])
  return { players, matches, groups }
}

export async function deleteTournament(id: string) {
  await prisma.importedPlayer.deleteMany({ where: { tournamentId: id } })
  return prisma.tournament.delete({ where: { id } })
}

export async function getActiveTournament() {
  return prisma.tournament.findFirst({
    where: { isActive: true },
    include: {
      categories: { orderBy: { order: 'asc' } },
    },
  })
}
