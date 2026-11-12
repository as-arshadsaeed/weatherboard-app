import { useEffect, useRef } from 'react'
import type { AnimationItem } from 'lottie-web'

import { loadLottiePlayer, loadWeatherAnimation } from '@/services/weatherAnimations'
import type { WeatherIconName } from '@/utils/weatherCodes'
import { cn } from '@/utils/cn'

interface WeatherAnimationProps {
  name: WeatherIconName
  /** Called once the animation is on screen, and with false if it could not be shown. */
  onStatusChange: (shown: boolean) => void
  className?: string
}

/**
 * Draws one Lottie animation into its own box and keeps it cheap: it plays only while on screen and the
 * tab is visible, and is destroyed when unmounted. Purely decorative (aria-hidden): the condition is always
 * stated in text beside it, so it adds nothing for screen readers to announce.
 */
export function WeatherAnimation({ name, onStatusChange, className }: WeatherAnimationProps) {
  const container = useRef<HTMLSpanElement>(null)
  const report = useRef(onStatusChange)
  useEffect(() => {
    report.current = onStatusChange
  })

  useEffect(() => {
    const box = container.current
    if (!box) return
    let cancelled = false
    let animation: AnimationItem | null = null
    let observer: IntersectionObserver | null = null
    let onScreen = true

    void (async () => {
      const [player, data] = await Promise.all([loadLottiePlayer(), loadWeatherAnimation(name)])
      if (cancelled) return
      if (!player || !data) return report.current(false)

      try {
        animation = player.loadAnimation({
          container: box,
          renderer: 'svg',
          loop: true,
          autoplay: false,
          // The player mutates what it is given, and the same data may be used by several icons.
          animationData: structuredClone(data),
          rendererSettings: { preserveAspectRatio: 'xMidYMid meet', focusable: false },
        })
      } catch {
        return report.current(false)
      }

      if (typeof IntersectionObserver === 'function') {
        observer = new IntersectionObserver((entries) => {
          onScreen = entries.some((entry) => entry.isIntersecting)
          sync()
        })
        observer.observe(box)
      }
      sync()
      report.current(true)
    })()

    // Play only while the icon is on screen and the tab is visible.
    function sync() {
      if (onScreen && !document.hidden) animation?.play()
      else animation?.pause()
    }
    const onVisibility = () => sync()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      observer?.disconnect()
      animation?.destroy()
    }
  }, [name])

  return <span ref={container} aria-hidden="true" className={cn('lottie-icon', className)} />
}
