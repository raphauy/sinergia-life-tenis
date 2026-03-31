import { z } from 'zod'

export const emailSchema = z.string().email('Email inválido')

export const otpSchema = z.string().regex(/^\d{6}$/, 'El código debe ser de 6 dígitos')
