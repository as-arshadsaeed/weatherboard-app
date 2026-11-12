import { Settings } from 'lucide-react'

import { Button } from '@/components/ui/button'

/** Header entry point to the settings dialog (tablet and up; phones use the bottom bar). */
export function SettingsButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={onClick}
      aria-haspopup="dialog"
      aria-label="Settings"
      title="Settings"
      className="hidden md:inline-flex"
    >
      <Settings className="size-[1.125rem]" aria-hidden="true" />
    </Button>
  )
}
