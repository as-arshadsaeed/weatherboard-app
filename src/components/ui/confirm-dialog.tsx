import { useEffect, useId, useRef, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: ReactNode
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Accessible modal confirmation built on the native <dialog>: showModal() makes the rest of the page
 * inert, traps focus, closes on Escape and restores focus to the opener. It is an alertdialog, labelled
 * and described, and focus starts on the safe (cancel) action. A click on the backdrop cancels.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  // Keep the native dialog in sync with the `open` prop.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      cancelRef.current?.focus()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      // Escape: let our state own closing so the prop and the DOM never disagree.
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border bg-popover p-0 text-popover-foreground shadow-raised backdrop:bg-black/50"
    >
      <div className="p-6">
        <h2 id={titleId} className="text-lg font-semibold tracking-tight text-balance">
          {title}
        </h2>
        <p id={descriptionId} className="mt-2 text-sm text-muted-foreground">
          {description}
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button ref={cancelRef} variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  )
}
