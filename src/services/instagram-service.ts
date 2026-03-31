import { z } from 'zod'
import { getInstagramProfile as getInstagramProfileApi } from '@/lib/instagram-api'

const fetchProfileSchema = z.object({
  handle: z
    .string()
    .min(1, 'Handle requerido')
    .transform((val) => val.toLowerCase().replace('@', ''))
    .refine((val) => /^[a-zA-Z0-9._]+$/.test(val), 'Handle inválido'),
})

export async function getInstagramProfile(handle: string) {
  const validated = fetchProfileSchema.parse({ handle })
  const result = await getInstagramProfileApi(validated.handle)

  if (!result.success) {
    throw new Error(result.error)
  }

  if (result.data.is_private) {
    throw new Error('El perfil de Instagram es privado')
  }

  return result.data
}
