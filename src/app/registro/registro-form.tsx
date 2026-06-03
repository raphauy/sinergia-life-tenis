'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { toast } from 'sonner'
import { submitPlayerRegistrationAction } from './actions'

export function RegistroForm() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [whatsappNumber, setWhatsappNumber] = useState('')
  const [cedula, setCedula] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !whatsappNumber.trim() || !cedula.trim()) {
      toast.error('Completá todos los campos')
      return
    }
    setIsLoading(true)
    try {
      const result = await submitPlayerRegistrationAction({ firstName, lastName, email, whatsappNumber, cedula })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success(result.message ?? 'Solicitud enviada')
      setDone(true)
    } finally {
      setIsLoading(false)
    }
  }

  if (done) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 pb-6 pt-8">
          <CardTitle className="text-center text-2xl font-bold">¡Solicitud enviada!</CardTitle>
          <CardDescription className="text-center">
            Tu registro quedó pendiente de aprobación. Te avisaremos por email cuando puedas ingresar a
            La Escalera.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <Button variant="outline" className="w-full" render={<Link href="/login" />}>
            Volver al inicio de sesión
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1 pb-6 pt-8">
        <CardTitle className="text-center text-2xl font-bold">Registrarse</CardTitle>
        <CardDescription className="text-center">
          Sumate a La Escalera. Un administrador revisará tu solicitud.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-8 pb-8">
        <div className="mb-5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          Tenés que ser <strong>socio del Club</strong> para que tu registro sea aceptado.
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="firstName">Nombre</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={isLoading}
                autoComplete="given-name"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Apellido</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={isLoading}
                autoComplete="family-name"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="whatsapp">WhatsApp</Label>
            <Input
              id="whatsapp"
              type="tel"
              inputMode="tel"
              placeholder="099 123 456"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              disabled={isLoading}
              autoComplete="tel"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cedula">Cédula de identidad</Label>
            <Input
              id="cedula"
              inputMode="numeric"
              placeholder="1.234.567-8"
              value={cedula}
              onChange={(e) => setCedula(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Enviando...' : 'Enviar solicitud'}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            ¿Ya tenés cuenta?{' '}
            <Link href="/login" className="text-primary font-medium hover:underline">
              Iniciá sesión
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
