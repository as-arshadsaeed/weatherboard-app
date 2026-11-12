import { useEffect, useRef, type ReactNode, type RefObject } from 'react'

import { cn } from '@/utils/cn'

interface DialogProps {
  open: boolean
  onClose: () => void
  /** "alertdialog" for confirmations that interrupt; "dialog" for everything else. */
  role?: 'dialog' | 'alertdialog'
  labelledBy: string
  describedBy?: string
  /** Element to focus when it opens (default: the browser focuses the first focusable control). */
  initialFocusRef?: RefObject<HTMLElement | null>
  className?: string
  children: ReactNode
}

/**
 * Modal dialog on the native <dialog>: showModal() makes the page behind inert, closes on Escape and
 * restores focus to the opener, so no focus-trap library is needed. State, not the browser, owns
 * closing (Escape and a backdrop click both call `onClose`), so the `open` prop and the DOM never disagree.
 */
export function Dialog({
  open,
  onClose,
  role = 'dialog',
  labelledBy,
  describedBy,
  initialFocusRef,
  className,
  children,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      initialFocusRef?.current?.focus()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open, initialFocusRef])

  return (
    <dialog
      ref={dialogRef}
      role={role}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      className={cn(
        'm-auto rounded-2xl border bg-popover p-0 text-popover-foreground shadow-raised backdrop:bg-black/50',
        className,
      )}
    >
      {children}
    </dialog>
  )
}
