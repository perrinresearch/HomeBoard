import { BoardReminder, BoardTimer } from '../types';
import { alarmSnapshot, stopAlarm } from './alarm';
import { wakeScreen } from './screenWake';
import { parseVoiceCommand, takeWake, VoiceCommand } from './voiceParse';
import { interpretRemote } from './voiceRemote';

const LISTEN_MS = 16000;
const COMMIT_MS = 1700;

interface VoiceHandlers {
  addTimer: (timer: BoardTimer) => void;
  addReminder: (reminder: BoardReminder) => void;
  addShopping?: (item: string) => void;
  boardContext?: () => string;
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
let ignoreUntil = 0;

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
  wakeScreen();
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

function speakingNow(): boolean {
  return Date.now() < ignoreUntil;
}

function ignoreMicFor(text: string): void {
  ignoreUntil = Date.now() + Math.min(8000, 800 + text.length * 70);
}

function speak(text: string): void {
  const spoken = text.trim();
  if (!spoken) {
    return;
  }
  ignoreMicFor(spoken);
  void fetch('/api/voice/speak', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: spoken })
  }).then(response => {
    if (response.ok || !window.speechSynthesis) {
      return;
    }
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(spoken));
  }).catch(() => {
    if (!window.speechSynthesis) {
      return;
    }
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(spoken));
  });
}

/** Speak the wake word from a tap so the kiosk speakers can be checked. */
export function speakWakeWord(): void {
  speak('Home Board');
}

function applyCommand(command: VoiceCommand, handlers: VoiceHandlers, reply?: string): boolean {
  wakeScreen();
  if (command.kind === 'stop') {
    stopAlarm();
    if (reply) {
      speak(reply);
    }
    return true;
  }
  if (command.kind === 'timer') {
    handlers.addTimer(command.timer);
    speak(reply || `${command.timer.label} timer started`);
    return true;
  }
  if (command.kind === 'shop') {
    handlers.addShopping?.(command.item);
    speak(reply || `Added ${command.item} to the shopping list`);
    return true;
  }
  handlers.addReminder(command.reminder);
  const when = new Date(command.reminder.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  speak(reply || `Reminder ${command.reminder.label} at ${when}`);
  return true;
}

function apply(spoken: string, handlers: VoiceHandlers): boolean {
  const command = parseVoiceCommand(spoken);
  if (!command) {
    return false;
  }
  return applyCommand(command, handlers);
}

function tryRemote(spoken: string, handlers: VoiceHandlers, closeListen: () => void): void {
  void interpretRemote(spoken, handlers.boardContext?.()).then(remote => {
    if (!remote) {
      speak("I didn't catch that.");
      closeListen();
      return;
    }
    if (remote.command) {
      applyCommand(remote.command, handlers, remote.reply);
      closeListen();
      return;
    }
    speak(remote.reply || "I didn't catch that.");
    closeListen();
  });
}

function joinUtterance(pending: string, next: string): string {
  const added = next.trim();
  if (!added) {
    return pending;
  }
  if (!pending) {
    return added;
  }
  if (added.startsWith(pending)) {
    return added;
  }
  if (pending.endsWith(added)) {
    return pending;
  }
  return `${pending} ${added}`;
}

function attachHandlers(handlers: VoiceHandlers): {
  heard: (spoken: string) => void;
  noteOngoing: () => void;
  openListen: () => void;
  closeListen: () => void;
  dispose: () => void;
} {
  let windowTimer = 0;
  let commitTimer = 0;
  let pending = '';
  let busy = false;

  const closeListen = () => {
    window.clearTimeout(windowTimer);
    window.clearTimeout(commitTimer);
    pending = '';
    busy = false;
    setListening(false);
  };

  const finish = (spoken: string) => {
    busy = true;
    const command = parseVoiceCommand(spoken);
    if (command) {
      applyCommand(command, handlers);
      closeListen();
      return;
    }
    tryRemote(spoken, handlers, closeListen);
  };

  const commit = () => {
    window.clearTimeout(commitTimer);
    if (busy) {
      return;
    }
    if (hearing) {
      commitTimer = window.setTimeout(commit, COMMIT_MS);
      return;
    }
    const spoken = pending.trim();
    pending = '';
    if (!spoken) {
      return;
    }
    finish(spoken);
  };

  const armCommit = () => {
    window.clearTimeout(commitTimer);
    commitTimer = window.setTimeout(commit, COMMIT_MS);
  };

  const openListen = () => {
    wakeScreen();
    noteWake();
    setListening(true);
    window.clearTimeout(windowTimer);
    windowTimer = window.setTimeout(() => {
      if (pending.trim()) {
        commit();
        return;
      }
      closeListen();
    }, LISTEN_MS);
  };

  const noteOngoing = () => {
    if (!listening || busy || speakingNow()) {
      return;
    }
    armCommit();
  };

  const heard = (spoken: string) => {
    if (speakingNow() || busy) {
      return;
    }
    const { woke, rest } = takeWake(spoken);
    if (alarmSnapshot().ringing && parseVoiceCommand(rest || spoken)?.kind === 'stop') {
      apply(spoken, handlers);
      closeListen();
      return;
    }
    if (woke && !listening) {
      openListen();
    }
    if (!listening) {
      return;
    }
    const piece = woke ? rest : spoken;
    if (!piece) {
      return;
    }
    pending = joinUtterance(pending, piece);
    armCommit();
  };

  return {
    heard,
    noteOngoing,
    openListen,
    closeListen,
    dispose: closeListen
  };
}

function listenKioskStream(handlers: VoiceHandlers): () => void {
  const runtime = attachHandlers(handlers);
  let stopped = false;
  let source: EventSource | null = null;
  let retry = 0;

  const open = () => {
    if (stopped) {
      return;
    }
    source?.close();
    source = new EventSource('/api/voice/');
    source.onopen = () => setConnected(true);
    source.onerror = () => {
      setConnected(false);
      source?.close();
      source = null;
      if (!stopped) {
        retry = window.setTimeout(open, 1500);
      }
    };
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
          runtime.noteOngoing();
          return;
        }
        runtime.heard(spoken);
      } catch {
        // ignore a truncated frame
      }
    };
  };

  open();
  return () => {
    stopped = true;
    window.clearTimeout(retry);
    source?.close();
    source = null;
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
          runtime.noteOngoing();
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
  let mode: 'none' | 'kiosk' | 'web' = 'none';
  let retry = 0;

  const probe = () => {
    if (stopped || mode === 'kiosk') {
      return;
    }
    fetch('/api/voice/health', { cache: 'no-store' })
      .then(response => {
        if (stopped || mode === 'kiosk') {
          return;
        }
        if (response.ok) {
          stopCurrent();
          mode = 'kiosk';
          stopCurrent = listenKioskStream(handlers);
          return;
        }
        if (mode !== 'web') {
          stopCurrent();
          mode = 'web';
          stopCurrent = listenWebSpeech(handlers);
        }
        retry = window.setTimeout(probe, 3000);
      })
      .catch(() => {
        if (stopped || mode === 'kiosk') {
          return;
        }
        if (mode !== 'web') {
          stopCurrent();
          mode = 'web';
          stopCurrent = listenWebSpeech(handlers);
        }
        retry = window.setTimeout(probe, 3000);
      });
  };

  probe();
  return () => {
    stopped = true;
    window.clearTimeout(retry);
    stopCurrent();
  };
}
