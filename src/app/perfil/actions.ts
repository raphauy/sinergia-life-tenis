'use server'

import { auth } from '@/lib/auth'
import { updateUser, getUserById } from '@/services/user-service'
import { uploadImage, deleteImage, uploadImageFromBlob } from '@/services/upload-service'
import { getInstagramProfile } from '@/services/instagram-service'
import { updateProfileSchema } from '@/lib/validations/profile'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/action-types'
import { z } from 'zod'

export async function updateProfileAction(
  data: Record<string, unknown>
): Promise<ActionResult<{ name: string; image: string | null }>> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return { success: false, error: 'No autenticado' }
    }

    const validated = updateProfileSchema.safeParse(data)
    if (!validated.success) {
      return { success: false, error: 'Datos inválidos' }
    }

    const user = await getUserById(session.user.id)
    if (!user) return { success: false, error: 'Usuario no encontrado' }

    // Delete old image if replacing
    if (validated.data.image !== undefined && user.image && user.image !== validated.data.image) {
      await deleteImage(user.image).catch(() => {})
    }

    const updated = await updateUser(session.user.id, {
      name: validated.data.name,
      ...(validated.data.image !== undefined ? { image: validated.data.image } : {}),
    })

    revalidatePath('/perfil')
    return { success: true, data: { name: updated.name || '', image: updated.image } }
  } catch (error) {
    console.error('Error updating profile:', error)
    return { success: false, error: 'Error al actualizar el perfil' }
  }
}

export async function uploadProfileImageAction(
  formData: FormData
): Promise<ActionResult<{ url: string }>> {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'No autenticado' }

    const result = await uploadImage(formData)
    if (!result.success) return { success: false, error: result.error }

    return { success: true, data: { url: result.url } }
  } catch (error) {
    console.error('Error uploading image:', error)
    return { success: false, error: 'Error al subir la imagen' }
  }
}

export async function loadInstagramImageAction(
  handle: string
): Promise<ActionResult<{ url: string }>> {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'No autenticado' }

    const profile = await getInstagramProfile(handle)

    // Download profile image
    const strategies = [
      { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36' },
      { 'User-Agent': 'Googlebot-Image/1.0' },
      { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148' },
    ]

    let imageBlob: Blob | null = null
    for (const headers of strategies) {
      try {
        const response = await fetch(profile.profile_pic_url, { headers })
        if (response.ok) {
          imageBlob = await response.blob()
          break
        }
      } catch {
        continue
      }
    }

    if (!imageBlob) {
      return { success: false, error: 'No se pudo descargar la imagen de Instagram' }
    }

    const result = await uploadImageFromBlob(imageBlob, `instagram-${profile.username}.jpg`)
    if (!result.success) return { success: false, error: result.error }

    return { success: true, data: { url: result.url } }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al cargar imagen de Instagram'
    return { success: false, error: message }
  }
}
