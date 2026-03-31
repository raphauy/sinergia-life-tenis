import { config } from 'dotenv'
config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const superadmin = await prisma.user.upsert({
    where: { email: 'rapha.uy@rapha.uy' },
    update: {},
    create: {
      email: 'rapha.uy@rapha.uy',
      name: 'Raphael',
      role: 'SUPERADMIN',
    },
  })

  console.log('Superadmin creado:', superadmin.email)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
