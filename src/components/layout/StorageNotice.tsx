import { useState, useSyncExternalStore } from 'react'
import { TriangleAlert, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { isStoragePersistent, subscribeToStorageStatus } from '@/services/storageService'

/**
 * Non-blocking notice shown only when the browser will not let us save anything. Everything keeps
 * working in memory for the session; this just says that favourites and settings will reset.
 */
export function StorageNotice() {
  const persistent = useSyncExternalStore(subscribeToStorageStatus, isStoragePersistent, () => true)
  const [dismissed, setDismissed] = useState(false)

  if (persistent || dismissed) return null

  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-xl border bg-card px-4 py-3 text-sm shadow-card"
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
      <p className="min-w-0 flex-1">
        <span className="font-medium">Settings can&rsquo;t be saved.</span>{' '}
        <span className="text-muted-foreground">
          Your browser is blocking local storage, so favourites and your unit and theme choices will be
          lost when you close this tab.
        </span>
      </p>
      <Button
        variant="ghost"
        size="icon"
        className="-my-2 -mr-2 shrink-0"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss storage notice"
      >
        <X aria-hidden="true" />
      </Button>
    </div>
  )
}
