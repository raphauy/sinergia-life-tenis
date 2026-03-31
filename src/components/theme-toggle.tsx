'use client'

import { useTheme } from 'next-themes'
import { Monitor, Sun, Moon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const options = [
    { value: 'system', icon: Monitor },
    { value: 'light', icon: Sun },
    { value: 'dark', icon: Moon },
  ] as const

  return (
    <div className="flex items-center gap-0.5 rounded-lg border bg-muted/50 p-0.5">
      {options.map(({ value, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          className={cn(
            'cursor-pointer rounded-md p-1.5 transition-colors',
            theme === value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  )
}
