'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from 'sonner'
import {
  updateProfileAction,
  uploadProfileImageAction,
  loadInstagramImageAction,
  deleteProfileImageAction,
} from './actions'
import { resizeImage } from '@/lib/resize-image'

interface ProfileFormProps {
  user: {
    firstName: string
    lastName: string
    email: string
    image: string | null
    phone: string | null
    cedula: string
  }
}

export function ProfileForm({ user }: ProfileFormProps) {
  const router = useRouter()
  const { update: updateSession } = useSession()
  const [firstName, setFirstName] = useState(user.firstName)
  const [lastName, setLastName] = useState(user.lastName)
  const [cedula, setCedula] = useState(user.cedula)
  const [displayImage, setDisplayImage] = useState(user.image)
  const [instagramHandle, setInstagramHandle] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    startTransition(async () => {
      try {
        const resized = await resizeImage(file)
        const formData = new FormData()
        formData.append('file', new File([resized], 'profile.jpg', { type: 'image/jpeg' }))
        const result = await uploadProfileImageAction(formData)
        if (result.success && result.data) {
          setDisplayImage(result.data.displayUrl)
          await updateSession({ image: result.data.displayUrl })
          toast.success('Imagen subida')
        } else if (!result.success) {
          toast.error(result.error)
        }
      } catch {
        toast.error('Error al procesar la imagen')
      }
    })
  }

  function handleInstagramLoad() {
    if (!instagramHandle.trim()) return
    startTransition(async () => {
      const result = await loadInstagramImageAction(instagramHandle)
      if (result.success && result.data) {
        setDisplayImage(result.data.displayUrl)
        await updateSession({ image: result.data.displayUrl })
        setInstagramHandle('')
        toast.success('Imagen cargada desde Instagram')
      } else if (!result.success) {
        toast.error(result.error)
      }
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (!firstName.trim()) return
    startTransition(async () => {
      const result = await updateProfileAction({ firstName, lastName, cedula })
      if (result.success && result.data) {
        await updateSession({ firstName: result.data.firstName, lastName: result.data.lastName, image: result.data.image })
        toast.success('Perfil actualizado')
        router.back()
      } else if (!result.success) {
        toast.error(result.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Avatar */}
      <div className="flex flex-col items-center gap-4">
        <Avatar className="h-24 w-24">
          <AvatarImage src={displayImage || undefined} />
          <AvatarFallback className="text-2xl">
            {[firstName[0], lastName[0]].filter(Boolean).join('').toUpperCase() || '?'}
          </AvatarFallback>
        </Avatar>
        <div className="flex gap-2">
          <Label
            htmlFor="avatar-upload"
            className="cursor-pointer text-sm text-primary hover:underline"
          >
            Subir imagen
          </Label>
          <input
            id="avatar-upload"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />
          {displayImage && (
            <button
              type="button"
              className="cursor-pointer text-sm text-destructive hover:underline"
              onClick={() => {
                startTransition(async () => {
                  const result = await deleteProfileImageAction()
                  if (result.success) {
                    setDisplayImage(null)
                    await updateSession({ image: null })
                    toast.success('Imagen eliminada')
                  } else {
                    toast.error(result.error)
                  }
                })
              }}
            >
              Eliminar
            </button>
          )}
        </div>
      </div>

      {/* Instagram */}
      <div className="space-y-2">
        <Label>Cargar desde Instagram</Label>
        <div className="flex gap-2">
          <Input
            placeholder="usuario_instagram"
            value={instagramHandle}
            onChange={(e) => setInstagramHandle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleInstagramLoad()
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleInstagramLoad}
            disabled={isPending || !instagramHandle.trim()}
          >
            {isPending ? 'Cargando...' : 'Buscar'}
          </Button>
        </div>
      </div>

      {/* Name fields */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">Nombre</Label>
          <Input
            id="firstName"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          {!firstName.trim() && submitted && (
            <p className="text-xs text-destructive">Nombre requerido</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Apellido</Label>
          <Input
            id="lastName"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
      </div>

      {/* Cédula */}
      <div className="space-y-2">
        <Label htmlFor="cedula">Cédula de identidad</Label>
        <Input
          id="cedula"
          value={cedula}
          onChange={(e) => setCedula(e.target.value)}
          placeholder="Ej: 1.234.567-8"
        />
        <p className="text-xs text-muted-foreground">Se usa para reservar la cancha en la app de Sinergia Life</p>
      </div>

      {/* Email (readonly) */}
      <div className="space-y-2">
        <Label>Email</Label>
        <Input value={user.email} disabled />
        <p className="text-xs text-muted-foreground">El email no puede ser modificado</p>
      </div>

      {/* Phone (readonly) */}
      {user.phone && (
        <div className="space-y-2">
          <Label>Teléfono</Label>
          <Input value={user.phone} disabled />
        </div>
      )}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Guardando...' : 'Guardar cambios'}
      </Button>
    </form>
  )
}
