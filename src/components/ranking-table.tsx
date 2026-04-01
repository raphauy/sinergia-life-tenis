import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { RankingEntry } from '@/services/ranking-service'

function ColumnHeader({ abbr, full, className }: { abbr: string; full: string; className?: string }) {
  return (
    <TableHead className={className}>
      <Tooltip>
        <TooltipTrigger render={<span />} className="cursor-help">
          {abbr}
        </TooltipTrigger>
        <TooltipContent>{full}</TooltipContent>
      </Tooltip>
    </TableHead>
  )
}

export function RankingTable({ entries }: { entries: RankingEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">Sin datos de ranking.</p>
  }

  return (
    <TooltipProvider>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 text-center">#</TableHead>
              <TableHead>Jugador</TableHead>
              <ColumnHeader abbr="PJ" full="Partidos jugados" className="text-center w-14" />
              <ColumnHeader abbr="PG" full="Partidos ganados" className="text-center w-14" />
              <ColumnHeader abbr="GF" full="Games a favor" className="text-center w-14" />
              <ColumnHeader abbr="GC" full="Games en contra" className="text-center w-14" />
              <ColumnHeader abbr="DG" full="Diferencia de games" className="text-center w-14" />
              <ColumnHeader abbr="Pts" full="Puntos" className="text-center w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((e) => (
              <TableRow key={e.player.id}>
                <TableCell className="text-center font-bold">{e.position}</TableCell>
                <TableCell>
                  <Link
                    href={`/jugador/${e.player.slug}`}
                    className="flex items-center gap-2 hover:underline"
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={e.player.image || undefined} />
                      <AvatarFallback className="text-xs">
                        {(e.player.name[0] || '?').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-sm">{e.player.name}</span>
                  </Link>
                </TableCell>
                <TableCell className="text-center text-sm">{e.pj}</TableCell>
                <TableCell className="text-center text-sm font-medium">{e.pg}</TableCell>
                <TableCell className="text-center text-sm">{e.gamesFor}</TableCell>
                <TableCell className="text-center text-sm">{e.gamesAgainst}</TableCell>
                <TableCell className="text-center text-sm">{e.gamesDiff}</TableCell>
                <TableCell className="text-center text-sm font-bold">{e.points}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  )
}
