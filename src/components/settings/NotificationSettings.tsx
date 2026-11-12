import { useId, useState } from 'react'
import { BellOff, BellRing, CircleCheck, Info, Send, TriangleAlert } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useNow } from '@/hooks/useNow'
import { useNotificationPermission } from '@/hooks/useNotificationPermission'
import type { ActiveReminder } from '@/hooks/useReminders'
import { REMINDER_DELIVERY } from '@/services/notificationService'
import type { City } from '@/types/city'
import type { ReminderPreference } from '@/types/preferences'
import type { TemperatureUnit } from '@/types/weather'
import {
  REMINDER_PERMISSION_EXPLANATION,
  REMINDER_TIME_MAX,
  REMINDER_TIME_MIN,
} from '@/utils/constants'
import {
  describeNextReminder,
  formatReminderTime,
  isValidReminderTime,
  parseReminderTime,
} from '@/utils/reminder'
import { cn } from '@/utils/cn'

interface NotificationSettingsProps {
  preference: ReminderPreference
  onEnabledChange: (enabled: boolean) => void
  /** Returns false for an invalid time (nothing is saved). */
  onTimeChange: (time: string) => boolean
  onSendTest: () => Promise<void>
  /** The test reminder most recently shown, so its text can be previewed here (the page is behind the dialog). */
  testReminder: ActiveReminder | null
  /** What the next reminder will describe. */
  city: City | null
  unit: TemperatureUnit
}

const TIME_RANGE_MESSAGE = `Choose a morning time between ${formatReminderTime(REMINDER_TIME_MIN)} and ${formatReminderTime(REMINDER_TIME_MAX)}.`

/**
 * Daily weather reminder settings: switch, time, permission status and the honest limits of what a
 * browser-only app can deliver. Permission is requested only when the user presses "Allow notifications",
 * which is shown only after they have turned reminders on and read the explanation.
 */
export function NotificationSettings({
  preference,
  onEnabledChange,
  onTimeChange,
  onSendTest,
  testReminder,
  city,
  unit,
}: NotificationSettingsProps) {
  const { permission, serviceWorkerAvailable, request } = useNotificationPermission()
  const now = useNow(60_000)
  const ids = {
    switchLabel: useId(),
    switchHint: useId(),
    time: useId(),
    timeHint: useId(),
    timeError: useId(),
  }

  const [timeDraft, setTimeDraft] = useState(preference.time)
  const [timeError, setTimeError] = useState<string | null>(null)
  const [requesting, setRequesting] = useState(false)
  const [asked, setAsked] = useState<'dismissed' | null>(null)
  const [sending, setSending] = useState(false)

  const unitLabel = unit === 'fahrenheit' ? '°F' : '°C'
  const delivery = REMINDER_DELIVERY

  const handleTimeChange = (value: string) => {
    setTimeDraft(value)
    if (value === '' || parseReminderTime(value) === null) {
      setTimeError('Enter a time for your reminder.')
    } else if (!isValidReminderTime(value)) {
      setTimeError(TIME_RANGE_MESSAGE)
    } else {
      setTimeError(null)
      onTimeChange(value)
    }
  }

  const handleAllow = async () => {
    setRequesting(true)
    setAsked(null)
    const result = await request()
    setRequesting(false)
    if (result === 'default') setAsked('dismissed')
  }

  const handleSendTest = async () => {
    setSending(true)
    await onSendTest()
    setSending(false)
  }

  const nextReminder = preference.enabled ? describeNextReminder(now, preference) : null

  return (
    <div className="space-y-6">
      <section aria-labelledby={ids.switchLabel} className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 id={ids.switchLabel} className="text-sm font-semibold tracking-tight">
              Daily weather reminder
            </h3>
            <p id={ids.switchHint} className="mt-1 text-sm text-muted-foreground">
              A short weather summary each morning for the city you’re viewing.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-sm font-medium" aria-hidden="true">
              {preference.enabled ? 'On' : 'Off'}
            </span>
            <Switch
              checked={preference.enabled}
              onCheckedChange={onEnabledChange}
              labelledBy={ids.switchLabel}
              describedBy={ids.switchHint}
            />
          </div>
        </div>

        <p role="status" className="text-sm text-muted-foreground">
          {nextReminder
            ? `Reminder on. Next reminder: ${nextReminder}${delivery.backgroundDelivery ? '.' : ', if WeatherBoard is open.'}`
            : 'Reminder off.'}
        </p>
      </section>

      <section className="space-y-2">
        <label htmlFor={ids.time} className="block text-sm font-semibold tracking-tight">
          Reminder time
        </label>
        <input
          id={ids.time}
          type="time"
          value={timeDraft}
          min={REMINDER_TIME_MIN}
          max={REMINDER_TIME_MAX}
          required
          onChange={(event) => handleTimeChange(event.target.value)}
          onBlur={() => {
            // Leaving the field with a rejected value shows what is actually saved.
            if (timeError) {
              setTimeDraft(preference.time)
              setTimeError(null)
            }
          }}
          aria-invalid={timeError ? true : undefined}
          aria-describedby={cn(ids.timeHint, timeError && ids.timeError)}
          className={cn(
            'h-11 w-40 rounded-lg border bg-card px-3 text-base shadow-xs md:h-10 md:text-sm',
            timeError ? 'border-destructive' : 'border-input',
          )}
        />
        <p id={ids.timeHint} className="text-sm text-muted-foreground">
          Morning reminders only, between {formatReminderTime(REMINDER_TIME_MIN)} and {formatReminderTime(REMINDER_TIME_MAX)}.
        </p>
        {timeError && (
          <p id={ids.timeError} role="alert" className="flex items-center gap-2 text-sm text-destructive">
            <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
            {timeError}
          </p>
        )}
      </section>

      <section aria-label="Notification permission" className="space-y-2 rounded-xl border bg-muted/40 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          {permission === 'granted' ? (
            <CircleCheck className="size-4 text-success" aria-hidden="true" />
          ) : permission === 'denied' || permission === 'unsupported' ? (
            <BellOff className="size-4 text-warning" aria-hidden="true" />
          ) : (
            <BellRing className="size-4 text-muted-foreground" aria-hidden="true" />
          )}
          <span>
            Notifications:{' '}
            {permission === 'granted' && 'Allowed'}
            {permission === 'denied' && 'Blocked'}
            {permission === 'default' && 'Not asked yet'}
            {permission === 'unsupported' && 'Not supported'}
          </span>
        </div>

        {permission === 'granted' && (
          <p className="text-sm text-muted-foreground">
            A system notification also appears when WeatherBoard is open in a background tab or window.
            While you’re looking at it, the reminder shows inside the page.
          </p>
        )}

        {permission === 'denied' && (
          <p className="text-sm text-muted-foreground">
            Your browser is blocking notifications for WeatherBoard, so reminders appear inside WeatherBoard while
            it’s open. To allow notifications, change this site’s notification permission in your browser’s settings.
          </p>
        )}

        {permission === 'unsupported' && (
          <p className="text-sm text-muted-foreground">
            This browser can’t show system notifications. Reminders still appear inside WeatherBoard while it’s open.
          </p>
        )}

        {permission === 'default' && !preference.enabled && (
          <p className="text-sm text-muted-foreground">
            WeatherBoard asks for permission only after you turn the reminder on.
          </p>
        )}

        {permission === 'default' && preference.enabled && (
          <div className="space-y-3">
            <p className="text-sm">{REMINDER_PERMISSION_EXPLANATION}</p>
            <p className="text-sm text-muted-foreground">
              You can also skip this: reminders will still appear inside WeatherBoard while it’s open.
            </p>
            <Button onClick={() => void handleAllow()} disabled={requesting}>
              <BellRing aria-hidden="true" />
              {requesting ? 'Waiting for your browser…' : 'Allow notifications'}
            </Button>
            {asked === 'dismissed' && (
              <p role="status" className="text-sm text-muted-foreground">
                No answer was given, so nothing has changed. You can try again whenever you like.
              </p>
            )}
          </div>
        )}

        {permission === 'granted' && !serviceWorkerAvailable && (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
            System notifications use WeatherBoard’s background component, which isn’t running here (for example in
            development), so they may not appear. Reminders still show inside the app.
          </p>
        )}
      </section>

      <section aria-label="What reminders can do" className="flex items-start gap-3 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="space-y-1.5 text-muted-foreground">
          {delivery.backgroundDelivery ? (
            <p>Reminders are delivered by a server, so they can arrive even when WeatherBoard is closed.</p>
          ) : (
            <>
              <p>
                <span className="font-medium text-foreground">Reminders only appear while WeatherBoard is open</span> in
                a browser tab or an installed app window. WeatherBoard can’t send a reminder when it’s closed —
                reliable background notifications need a server to send them.
              </p>
              <p>If it isn’t open at your reminder time (or within 30 minutes after), you won’t get that day’s reminder.</p>
            </>
          )}
          <p>
            {city
              ? `Your reminder will show the weather for ${city.name} in ${unitLabel}.`
              : 'Choose a city to get a weather summary in your reminder.'}
          </p>
        </div>
      </section>

      <section className="space-y-2">
        <Button variant="outline" onClick={() => void handleSendTest()} disabled={sending}>
          <Send aria-hidden="true" />
          Send a test reminder
        </Button>
        {testReminder?.kind === 'test' && (
          <p role="status" className="rounded-lg border bg-card p-3 text-sm">
            <span className="font-medium">{testReminder.message.title}</span>
            <span className="mt-0.5 block text-muted-foreground">{testReminder.message.body}</span>
          </p>
        )}
      </section>
    </div>
  )
}
