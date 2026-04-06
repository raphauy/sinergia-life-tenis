'use client'

import { useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Camera, Trash2 } from 'lucide-react'
import { uploadMatchPhotoAction, deleteMatchPhotoAction } from './actions'
import { resizeImage } from '@/lib/resize-image'

interface Props {
  matchId: string
  hasPhoto: boolean
}

export function MatchPhoto({ matchId, hasPhoto }: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    startTransition(async () => {
      try {
        const resized = await resizeImage(file)
        const formData = new FormData()
        formData.append('file', new File([resized], 'match-photo.jpg', { type: 'image/jpeg' }))
        const result = await uploadMatchPhotoAction(matchId, formData)
        if (result.success) {
          toast.success(hasPhoto ? 'Foto reemplazada' : 'Foto agregada')
          router.refresh()
        } else {
          toast.error(result.error)
        }
      } catch {
        toast.error('Error al subir la foto')
      }
      if (fileInputRef.current) fileInputRef.current.value = ''
    })
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteMatchPhotoAction(matchId)
      if (result.success) {
        toast.success('Foto eliminada')
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="flex gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => fileInputRef.current?.click()}
      >
        <Camera className="h-4 w-4 mr-1.5" />
        {isPending ? 'Subiendo...' : hasPhoto ? 'Cambiar foto' : 'Agregar foto'}
      </Button>
      {hasPhoto && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={handleDelete}
        >
          <Trash2 className="h-4 w-4 mr-1.5" />
          Eliminar
        </Button>
      )}
    </div>
  )
}
