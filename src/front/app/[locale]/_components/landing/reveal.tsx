'use client'

import { useEffect, useRef, useState } from 'react'

type Props = {
  children: React.ReactNode
  delay?: number
  className?: string
  as?: 'div' | 'article' | 'section' | 'span'
}

/**
 * Reveal — wraps below-the-fold content and animates it once when it
 * enters the viewport. Uses IntersectionObserver + a CSS keyframe
 * defined in globals.css. Avoids the motion/RSC hydration issues we
 * hit with framer-motion on Next.js 16 + React Compiler + Turbopack.
 */
export function Reveal({
  children,
  delay = 0,
  className,
  as: Tag = 'div',
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '-60px 0px' },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const classes = ['reveal', visible ? 'is-visible' : '', className]
    .filter(Boolean)
    .join(' ')

  return (
    <Tag
      ref={ref as React.RefObject<HTMLDivElement>}
      className={classes}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  )
}
