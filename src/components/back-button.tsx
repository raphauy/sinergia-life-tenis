'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export function BackButton() {
  const router = useRouter()

  return (
    <Button variant="ghost" size="sm" className="mb-4 -ml-2" onClick={() => router.back()}>
      <ArrowLeft className="h-4 w-4 mr-1" />
      Volver
    </Button>
  )
}
