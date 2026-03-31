'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { useSidebar } from '@/components/ui/sidebar'

export function SidebarCloseOnNav() {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()
  const isFirst = useRef(true)

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false
      return
    }
    setOpenMobile(false)
  }, [pathname, setOpenMobile])

  return null
}
