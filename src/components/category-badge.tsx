import { cn } from '@/lib/utils'

const categoryStyles: Record<string, string> = {
  A: 'bg-primary/25 text-primary border-primary/40',
  B: 'bg-primary/15 text-primary/80 border-primary/25',
  C: 'bg-primary/8 text-primary/60 border-primary/15',
  D: 'bg-primary/5 text-primary/40 border-primary/10',
}

const fallbackStyle = 'bg-primary/10 text-primary/60 border-primary/20'

export function CategoryBadge({
  name,
  className,
}: {
  name: string
  className?: string
}) {
  const style = categoryStyles[name.toUpperCase()] ?? fallbackStyle

  return (
    <span
      className={cn(
        'inline-flex h-5 items-center justify-center rounded-full border px-2 text-xs font-semibold',
        style,
        className
      )}
    >
      {name}
    </span>
  )
}
