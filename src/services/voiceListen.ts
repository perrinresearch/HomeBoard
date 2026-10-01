import { BoardReminder, BoardTimer } from '../types';
import { alarmSnapshot, stopAlarm } from './alarm';
import { wakeScreen } from '../components/ScreenSleep';
import { parseVoiceCommand, takeWake } from './voiceParse';

const LISTEN_MS = 8000;

interface VoiceHandlers {
  addTimer: (timer: BoardTimer) => void;
  addReminder: (reminder: BoardReminder) => void;
}

interface SpeechRec extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onstart: (() => void) | null;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

type VoiceState = {
  connected: boolean;
  listening: boolean;
  hearing: boolean;
  woke: boolean;
  level: number;
};

const listeners = new Set<() => void>();
const HEAR_MS = 450;
const WOKE_MS = 1800;
const SOUND_LEVEL = 0.05;

let listening = false;
let hearing = false;
let woke = false;
let connected = false;
let level = 0;
let hearTimer = 0;
let wokeTimer = 0;

function emit(): void {
  listeners.forEach(listener => listener());
}

export function voiceSnapshot(): VoiceState {
  return { connected, listening, hearing, woke, level };
}

export function subscribeVoice(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setConnected(next: boolean): void {
  if (connected === next) {
    return;
  }
  connected = next;
  emit();
}

function setListening(next: boolean): void {
  if (listening === next) {
    return;
  }
  listening = next;
  emit();
}

function noteLevel(next: number): void {
  const value = Math.max(0, Math.min(1, next));
  const hear = value >= SOUND_LEVEL;
  const changed = Math.abs(value - level) >= 0.02 || hear !== hearing;
  level = value;
  if (hear) {
    hearing = true;
    window.clearTimeout(hearTimer);
    hearTimer = window.setTimeout(() => {
      hearing = false;
      emit();
    }, HEAR_MS);
  }
  if (changed) {
    emit();
  }
}

function noteWake(): void {
  woke = true;
  window.clearTimeout(wokeTimer);
  wokeTimer = window.setTimeout(() => {
    woke = false;
    emit();
  }, WOKE_MS);
  emit();
}

function recognitionCtor(): (new () => SpeechRec) | null {
  const speech = window as Window & {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  return speech.SpeechRecognition || speech.webkitSpeechRecognition || null;
}

function speak(text: string): void {
  if (!window.speechSynthesis) {
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  window.speechSynthesis.speak(utterance);
}

/** Speak the wake word from a tap so the kiosk speakers can be checked. */
export function speakWakeWord(): void {
  speak('Home Board');
}

function apply(spoken: string, handlers: VoiceHandlers): boolean {
  const command = parseVoiceCommand(spoken);
  if (!command) {
    return false;
  }
  wakeScreen();
  if (command.kind === 'stop') {
    stopAlarm();
    return true;
  }
  if (command.kind === 'timer') {
    handlers.addTimer(command.timer);
    speak(`${command.timer.label} timer started`);
    return true;
  }
  handlers.addReminder(command.reminder);
  const when = new Date(command.reminder.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  speak(`Reminder ${command.reminder.label} at ${when}`);
  return true;
}

function attachHandlers(handlers: VoiceHandlers): {
  heard: (spoken: string) => void;
  openListen: () => void;
  closeListen: () => void;
  dispose: () => void;
} {
  let windowTimer = 0;

  const closeListen = () => {
    window.clearTimeout(windowTimer);
    setListening(false);
  };

  const openListen = () => {
    wakeScreen();
    noteWake();
    setListening(true);
    window.clearTimeout(windowTimer);
    windowTimer = window.setTimeout(closeListen, LISTEN_MS);
  };

  const heard = (spoken: string) => {
    const { woke, rest } = takeWake(spoken);
    if (woke && !listening) {
      openListen();
      if (rest && apply(rest, handlers)) {
        closeListen();
      }
      return;
    }
    if (listening && rest && apply(rest, handlers)) {
      closeListen();
      return;
    }
    if (listening && !woke && apply(spoken, handlers)) {
      closeListen();
      return;
    }
    if (alarmSnapshot().ringing && parseVoiceCommand(spoken)?.kind === 'stop') {
      apply(spoken, handlers);
    }
  };

  return {
    heard,
    openListen,
    closeListen,
    dispose: closeListen
  };
}

function listenKioskStream(handlers: VoiceHandlers): () => void {
  const runtime = attachHandlers(handlers);
  const source = new EventSource('/api/voice/');
  source.onopen = () => setConnected(true);
  source.onerror = () => setConnected(false);
  source.onmessage = event => {
    try {
      const payload = JSON.parse(event.data) as { text?: string; final?: boolean; level?: number };
      if (typeof payload.level === 'number') {
        noteLevel(payload.level);
      }
      const spoken = (payload.text || '').trim();
      if (!spoken) {
        return;
      }
      noteLevel(Math.max(level, 0.35));
      if (!payload.final) {
        if (!listening && takeWake(spoken).woke) {
          runtime.openListen();
        }
        return;
      }
      runtime.heard(spoken);
    } catch {
      // ignore a truncated frame
    }
  };
  return () => {
    source.close();
    setConnected(false);
    runtime.dispose();
  };
}

function listenWebSpeech(handlers: VoiceHandlers): () => void {
  const Ctor = recognitionCtor();
  if (!Ctor) {
    return () => undefined;
  }

  const runtime = attachHandlers(handlers);
  let stopped = false;
  let active: SpeechRec | null = null;
  let restart = 0;

  const begin = () => {
    if (stopped) {
      return;
    }
    try {
      active?.abort();
    } catch {
      // already stopped
    }
    const rec = new Ctor();
    active = rec;
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.onresult = event => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const spoken = result[0].transcript;
        if (spoken.trim()) {
          noteLevel(0.4);
        }
        if (!result.isFinal) {
          if (!listening && takeWake(spoken).woke) {
            runtime.openListen();
          }
          continue;
        }
        runtime.heard(spoken);
      }
    };
    rec.onerror = () => undefined;
    rec.onstart = () => setConnected(true);
    rec.onend = () => {
      if (!stopped) {
        restart = window.setTimeout(begin, 400);
      }
    };
    try {
      rec.start();
    } catch {
      restart = window.setTimeout(begin, 1500);
    }
  };

  begin();
  return () => {
    stopped = true;
    window.clearTimeout(restart);
    try {
      active?.abort();
    } catch {
      // already stopped
    }
    active = null;
    runtime.dispose();
  };
}

/** Wake word, then a command. Stop works anytime the alarm is ringing. */
export function listenForVoiceCommands(handlers: VoiceHandlers): () => void {
  let stopped = false;
  let stopCurrent: () => void = () => undefined;

  fetch('/api/voice/health', { cache: 'no-store' })
    .then(response => {
      if (stopped) {
        return;
      }
      stopCurrent = response.ok ? listenKioskStream(handlers) : listenWebSpeech(handlers);
    })
    .catch(() => {
      if (!stopped) {
        stopCurrent = listenWebSpeech(handlers);
      }
    });

  return () => {
    stopped = true;
    stopCurrent();
  };
}
