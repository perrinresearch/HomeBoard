const WAKE_EVENT = 'homeboard-wake';

/** Wake the clock overlay. Touch and the HomeBoard wake word call this. */
export function wakeScreen(): void {
  window.dispatchEvent(new Event(WAKE_EVENT));
}

export function subscribeWake(listener: () => void): () => void {
  window.addEventListener(WAKE_EVENT, listener);
  return () => window.removeEventListener(WAKE_EVENT, listener);
}
