import { BellRing, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { ActiveReminder } from '@/hooks/useReminders'

/**
 * The in-app reminder: shown when a daily reminder fires while WeatherBoard is open (and for a test).
 * It stays until dismissed, so it is still there if the user was away from the screen.
 */
export function ReminderBanner({ reminder, onDismiss }: { reminder: ActiveReminder; onDismiss: () => void }) {
  return (
    <div
      role="status"
      aria-label={reminder.kind === 'test' ? 'Test reminder' : 'Daily weather reminder'}
      className="flex items-start gap-3 rounded-xl border border-brand/40 bg-card px-4 py-3 text-sm shadow-card"
    >
      <BellRing className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {reminder.kind === 'test' ? 'Test reminder · ' : 'Daily weather reminder · '}
          {reminder.message.title}
        </p>
        <p className="mt-0.5 text-muted-foreground">{reminder.message.body}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="-my-2 -mr-2 shrink-0"
        onClick={onDismiss}
        aria-label="Dismiss reminder"
      >
        <X aria-hidden="true" />
      </Button>
    </div>
  )
}
