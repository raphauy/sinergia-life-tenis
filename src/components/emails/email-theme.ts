export const theme = {
  colors: {
    primary: '#ff7e5f',
    primaryDark: '#b35340',
    background: '#fff9f5',
    cardBg: '#ffffff',
    text: '#3d3436',
    textMuted: '#78716c',
    border: '#ffe0d6',
  },
  fonts: {
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
  },
  logoUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://life-tenis.raphauy.dev'}/life-logo.png`,
} as const
