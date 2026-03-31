'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Papa from 'papaparse'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { Upload, Check, AlertCircle } from 'lucide-react'
import { uploadCsvAction, confirmImportAction } from './actions'

interface ParsedRow {
  name: string
  category: string
  whatsappNumber?: string
  email?: string
  isValid: boolean
  errors: string[]
  raw: Record<string, unknown>
}

interface Props {
  tournamentId: string
  validCategories: string[]
}

const COLUMN_ALIASES: Record<string, string[]> = {
  name: ['nombre', 'name', 'jugador', 'player'],
  category: ['categoria', 'categoría', 'category', 'cat'],
  whatsappNumber: ['whatsapp', 'telefono', 'teléfono', 'phone', 'celular', 'cel'],
  email: ['email', 'correo', 'mail', 'e-mail'],
}

function detectColumn(headers: string[], aliases: string[]): string | null {
  const lower = headers.map((h) => h.toLowerCase().trim())
  for (const alias of aliases) {
    const idx = lower.indexOf(alias)
    if (idx !== -1) return headers[idx]
  }
  return null
}

export function CsvImportClient({ tournamentId, validCategories }: Props) {
  const router = useRouter()
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload')
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{ processed: number; errors: number } | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || []
        const nameCol = detectColumn(headers, COLUMN_ALIASES.name)
        const catCol = detectColumn(headers, COLUMN_ALIASES.category)
        const whatsappCol = detectColumn(headers, COLUMN_ALIASES.whatsappNumber)
        const emailCol = detectColumn(headers, COLUMN_ALIASES.email)

        if (!nameCol) {
          toast.error('No se encontró la columna de nombre')
          return
        }
        if (!catCol) {
          toast.error('No se encontró la columna de categoría')
          return
        }

        const parsed: ParsedRow[] = (results.data as Record<string, string>[]).map((raw) => {
          const errors: string[] = []
          const name = raw[nameCol]?.trim() || ''
          const category = raw[catCol]?.trim().toUpperCase() || ''
          const whatsappNumber = whatsappCol ? raw[whatsappCol]?.trim() : undefined
          const email = emailCol ? raw[emailCol]?.trim().toLowerCase() : undefined

          if (!name) errors.push('Nombre vacío')
          if (!category) errors.push('Categoría vacía')
          if (category && !validCategories.map((c) => c.toUpperCase()).includes(category)) {
            errors.push(`Categoría "${category}" inválida`)
          }

          return {
            name,
            category,
            whatsappNumber: whatsappNumber || undefined,
            email: email || undefined,
            isValid: errors.length === 0,
            errors,
            raw: raw as Record<string, unknown>,
          }
        })

        setRows(parsed)
        setStep('preview')
      },
      error: () => {
        toast.error('Error al leer el archivo CSV')
      },
    })
  }

  function handleUpload() {
    const validRows = rows.filter((r) => r.isValid)
    if (validRows.length === 0) {
      toast.error('No hay filas válidas para importar')
      return
    }

    startTransition(async () => {
      const uploadResult = await uploadCsvAction(
        tournamentId,
        validRows.map((r) => ({
          name: r.name,
          category: r.category,
          whatsappNumber: r.whatsappNumber,
          email: r.email,
          data: r.raw,
        }))
      )

      if (!uploadResult.success) {
        toast.error(uploadResult.error)
        return
      }

      const confirmResult = await confirmImportAction(tournamentId)
      if (confirmResult.success && confirmResult.data) {
        setResult(confirmResult.data)
        setStep('done')
        toast.success(
          `Importación completada: ${confirmResult.data.processed} procesados, ${confirmResult.data.errors} errores`
        )
      } else if (!confirmResult.success) {
        toast.error(confirmResult.error)
      }
    })
  }

  if (step === 'done') {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border p-6 text-center">
          <Check className="h-12 w-12 text-green-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold">Importación completada</h2>
          <p className="text-muted-foreground">
            {result?.processed} jugadores procesados
            {result?.errors ? `, ${result.errors} con errores` : ''}
          </p>
        </div>
        <Button onClick={() => router.push(`/admin/torneos/${tournamentId}`)}>
          Volver al torneo
        </Button>
      </div>
    )
  }

  if (step === 'upload') {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border-2 border-dashed p-12 text-center">
          <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-4">
            Subí un archivo CSV con las columnas: nombre, categoría, whatsapp (opcional), email
            (opcional)
          </p>
          <label className="cursor-pointer">
            <Button variant="outline" render={<span />}>
              Seleccionar archivo
            </Button>
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
        </div>
      </div>
    )
  }

  // Preview
  const validCount = rows.filter((r) => r.isValid).length
  const errorCount = rows.filter((r) => !r.isValid).length

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Badge variant="default">{validCount} válidos</Badge>
        {errorCount > 0 && <Badge variant="destructive">{errorCount} con errores</Badge>}
      </div>

      <div className="rounded-md border max-h-96 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow key={i} className={!row.isValid ? 'bg-destructive/5' : undefined}>
                <TableCell>{row.name || '-'}</TableCell>
                <TableCell>{row.category || '-'}</TableCell>
                <TableCell className="text-sm">{row.whatsappNumber || '-'}</TableCell>
                <TableCell className="text-sm">{row.email || '-'}</TableCell>
                <TableCell>
                  {row.isValid ? (
                    <Badge variant="outline" className="text-green-600">OK</Badge>
                  ) : (
                    <div className="flex items-center gap-1 text-destructive text-xs">
                      <AlertCircle className="h-3 w-3" />
                      {row.errors.join(', ')}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex gap-2">
        <Button onClick={handleUpload} disabled={isPending || validCount === 0}>
          {isPending ? 'Importando...' : `Importar ${validCount} jugadores`}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setRows([])
            setStep('upload')
          }}
        >
          Cancelar
        </Button>
      </div>
    </div>
  )
}
