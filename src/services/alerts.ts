import { BoardReminder, BoardTimer } from '../types';

const SOON_MS = 12 * 60 * 60 * 1000;
/** A timer finished or a reminder came due. The alarm listens today; speech can listen later. */
export const ALERT_EVENT = 'homeboard-alert';

export interface AlertView {
  id: string;
  kind: 'timer' | 'reminder';
  label: string;
  detail: string;
  due: boolean;
}

/** Fired once when a timer finishes or a reminder comes due. */
export function announceAlert(kind: 'timer' | 'reminder', id: string, label: string): void {
  window.dispatchEvent(new CustomEvent(ALERT_EVENT, { detail: { kind, id, label } }));
}

export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function alertViews(timers: BoardTimer[], reminders: BoardReminder[], now: number): AlertView[] {
  const timerViews = timers.map((timer) => {
    const remain = timer.endsAt - now;
    return {
      id: timer.id,
      kind: 'timer' as const,
      label: timer.label || 'Timer',
      detail: remain > 0 ? formatRemaining(remain) : 'Done',
      due: remain <= 0
    };
  });
  const reminderViews = reminders
    .filter((reminder) => reminder.at <= now + SOON_MS)
    .map((reminder) => ({
      id: reminder.id,
      kind: 'reminder' as const,
      label: reminder.label || 'Reminder',
      detail: reminder.at <= now
        ? 'Now'
        : new Date(reminder.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      due: reminder.at <= now
    }));
  return [...timerViews, ...reminderViews].sort((a, b) => Number(b.due) - Number(a.due));
}
