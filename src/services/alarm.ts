import { AlarmSound } from '../types';
import { ALERT_EVENT } from './alerts';

export const ALARM_OPTIONS: { id: AlarmSound; label: string; detail: string }[] = [
  { id: 'chime', label: 'Chime', detail: 'Two soft notes' },
  { id: 'bell', label: 'Bell', detail: 'A single strike' },
  { id: 'beeps', label: 'Beeps', detail: 'Three short beeps' },
  { id: 'pulse', label: 'Pulse', detail: 'A steady tone' },
  { id: 'off', label: 'Off', detail: 'No sound' }
];

interface AlarmSnapshot {
  ringing: boolean;
  label: string;
}

let audio: AudioContext | null = null;
let ringing = false;
let label = '';
let sound: AlarmSound = 'chime';
let loopTimer = 0;
const live: { osc: OscillatorNode; gain: GainNode }[] = [];
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach(listener => listener());
}

function context(): AudioContext {
  if (!audio) {
    audio = new AudioContext();
  }
  return audio;
}

/** Call from a tap so a later alarm can play without another gesture. */
export function unlockAlarm(): void {
  const current = context();
  if (current.state === 'suspended') {
    void current.resume();
  }
}

function silence(): void {
  if (!audio) {
    live.length = 0;
    return;
  }
  const now = audio.currentTime;
  live.forEach(({ osc, gain }) => {
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(0.0001, now);
    try {
      osc.stop(now + 0.05);
    } catch {
      // already stopped
    }
  });
  live.length = 0;
}

function tone(start: number, freq: number, duration: number, type: OscillatorType, peak: number): void {
  const current = context();
  const osc = current.createOscillator();
  const gain = current.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(current.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
  live.push({ osc, gain });
  osc.onended = () => {
    const index = live.findIndex(item => item.osc === osc);
    if (index >= 0) {
      live.splice(index, 1);
    }
  };
}

/** Schedule one phrase and return how long to wait before repeating it. */
function phrase(choice: AlarmSound, start: number): number {
  if (choice === 'bell') {
    tone(start, 660, 1.1, 'sine', 0.2);
    tone(start, 990, 0.8, 'sine', 0.07);
    tone(start, 1320, 0.45, 'triangle', 0.04);
    return 2000;
  }
  if (choice === 'beeps') {
    tone(start, 880, 0.12, 'square', 0.06);
    tone(start + 0.22, 880, 0.12, 'square', 0.06);
    tone(start + 0.44, 880, 0.12, 'square', 0.06);
    return 1600;
  }
  if (choice === 'pulse') {
    tone(start, 440, 0.35, 'sine', 0.18);
    return 1100;
  }
  tone(start, 784, 0.4, 'sine', 0.16);
  tone(start + 0.18, 1046, 0.65, 'sine', 0.14);
  return 2200;
}

function loop(choice: AlarmSound): void {
  if (!ringing || choice === 'off') {
    return;
  }
  const current = context();
  if (current.state !== 'running') {
    loopTimer = window.setTimeout(() => loop(choice), 400);
    return;
  }
  const wait = phrase(choice, current.currentTime);
  loopTimer = window.setTimeout(() => loop(choice), wait);
}

export function alarmSnapshot(): AlarmSnapshot {
  return { ringing, label };
}

export function subscribeAlarm(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setAlarmSound(next: AlarmSound): void {
  sound = next;
  if (next === 'off') {
    stopAlarm();
  }
}

export function previewAlarm(choice: AlarmSound): void {
  if (choice === 'off') {
    return;
  }
  const current = context();
  void current.resume().then(() => {
    phrase(choice, current.currentTime);
  });
}

export function startAlarm(choice: AlarmSound, nextLabel: string): void {
  label = nextLabel || 'Alarm';
  if (choice === 'off') {
    emit();
    return;
  }
  const starting = !ringing;
  ringing = true;
  emit();
  if (starting) {
    const current = context();
    void current.resume().finally(() => {
      if (ringing) {
        loop(choice);
      }
    });
  }
}

export function stopAlarm(): void {
  ringing = false;
  window.clearTimeout(loopTimer);
  silence();
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  emit();
}

/** Play the kiosk tone when a timer or reminder is due. Speech should listen to the same event. */
export function listenForAlerts(): () => void {
  const onAlert = (event: Event) => {
    const detail = (event as CustomEvent<{ label?: string }>).detail;
    startAlarm(sound, detail?.label || 'Alarm');
  };
  window.addEventListener(ALERT_EVENT, onAlert);
  return () => window.removeEventListener(ALERT_EVENT, onAlert);
}
