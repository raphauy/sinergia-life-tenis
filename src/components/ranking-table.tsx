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
import type { RankingEntry } from '@/services/ranking-service'

export function RankingTable({ entries }: { entries: RankingEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">Sin datos de ranking.</p>
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12 text-center">#</TableHead>
            <TableHead>Jugador</TableHead>
            <TableHead className="text-center w-14">PJ</TableHead>
            <TableHead className="text-center w-14">PG</TableHead>
            <TableHead className="text-center w-14">PP</TableHead>
            <TableHead className="text-center w-14">SF</TableHead>
            <TableHead className="text-center w-14">SC</TableHead>
            <TableHead className="text-center w-16">Pts</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((e) => (
            <TableRow key={e.player.id}>
              <TableCell className="text-center font-bold">{e.position}</TableCell>
              <TableCell>
                <Link
                  href={`/jugador/${e.player.id}`}
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
              <TableCell className="text-center text-sm">{e.pp}</TableCell>
              <TableCell className="text-center text-sm">{e.setsFor}</TableCell>
              <TableCell className="text-center text-sm">{e.setsAgainst}</TableCell>
              <TableCell className="text-center text-sm font-bold">{e.points}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
