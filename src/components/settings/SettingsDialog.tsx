import { useId, type ReactNode } from 'react'
import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'

interface SettingsDialogProps {
  open: boolean
  onClose: () => void
  children: ReactNode
}

/** Modal settings panel. Content is mounted only while open, so its listeners and state reset each time. */
export function SettingsDialog({ open, onClose, children }: SettingsDialogProps) {
  const titleId = useId()

  return (
    <Dialog
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      className="max-h-[calc(100dvh-2rem)] w-[min(34rem,calc(100vw-2rem))] overflow-y-auto"
    >
      <div className="p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 id={titleId} className="text-lg font-semibold tracking-tight">
            Settings
          </h2>
          <Button variant="ghost" size="icon" className="-mr-2" onClick={onClose} aria-label="Close settings">
            <X aria-hidden="true" />
          </Button>
        </div>
        {open && children}
      </div>
    </Dialog>
  )
}
