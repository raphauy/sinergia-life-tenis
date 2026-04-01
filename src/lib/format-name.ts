export function fullName(first: string | null | undefined, last: string | null | undefined): string {
  return [first, last].filter(Boolean).join(' ')
}

export function initials(first: string | null | undefined, last: string | null | undefined): string {
  return [first?.[0], last?.[0]].filter(Boolean).join('').toUpperCase() || '?'
}
