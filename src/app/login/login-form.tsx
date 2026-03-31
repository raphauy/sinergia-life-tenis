'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from '@/components/ui/input-otp'
import { toast } from 'sonner'
import { sendOtpAction, verifyOtpAction } from './actions'

type Step = 'email' | 'otp'

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl')
  const prefilledEmail = searchParams.get('email') || ''

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState(prefilledEmail)
  const [otp, setOtp] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)

    try {
      const result = await sendOtpAction(email)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success(result.message)
      setStep('otp')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)

    try {
      const result = await verifyOtpAction(email, otp)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success('Acceso exitoso')
      const redirectTo = callbackUrl || result.data?.redirectUrl || '/'
      router.push(redirectTo)
      router.refresh()
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1 pb-6 pt-8">
        <CardTitle className="text-center text-2xl font-bold">
          {step === 'email' ? 'Iniciar sesión' : 'Verificar código'}
        </CardTitle>
        <CardDescription className="text-center">
          {step === 'email'
            ? 'Ingresa tu email para recibir un código de acceso'
            : `Ingresa el código de 6 dígitos enviado a ${email}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-8 pb-8">
        {step === 'email' ? (
          <form onSubmit={handleEmailSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="email"
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Enviando...' : 'Continuar'}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleOtpSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label className="text-center block">Código de verificación</Label>
              <InputOTP
                containerClassName="justify-center"
                maxLength={6}
                value={otp}
                onChange={setOtp}
                disabled={isLoading}
                autoFocus
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                </InputOTPGroup>
                <InputOTPSeparator />
                <InputOTPGroup>
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading || otp.length !== 6}>
              {isLoading ? 'Verificando...' : 'Verificar'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => { setStep('email'); setOtp('') }}
              disabled={isLoading}
            >
              Volver al email
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
