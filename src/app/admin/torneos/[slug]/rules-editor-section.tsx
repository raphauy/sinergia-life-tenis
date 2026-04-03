'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TiptapEditor } from '@/components/tiptap-editor'
import { toast } from 'sonner'
import { Save, FileText } from 'lucide-react'
import { updateTournamentRulesAction } from '../actions'

interface Props {
  tournamentId: string
  initialRules: string
}

export function RulesEditorSection({ tournamentId, initialRules }: Props) {
  const [rules, setRules] = useState(initialRules)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    startTransition(async () => {
      const result = await updateTournamentRulesAction(tournamentId, rules)
      if (result.success) {
        toast.success('Reglamento guardado')
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Reglamento
        </CardTitle>
      </CardHeader>
      <CardContent>
        <TiptapEditor content={rules} onChange={setRules} disabled={isPending} />
        <div className="flex justify-end mt-4">
          <Button onClick={handleSave} disabled={isPending}>
            <Save className="h-4 w-4 mr-1" />
            {isPending ? 'Guardando...' : 'Guardar reglamento'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
