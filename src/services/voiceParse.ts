import { BoardReminder, BoardTimer } from '../types';

export type VoiceCommand =
  | { kind: 'stop' }
  | { kind: 'timer'; timer: BoardTimer }
  | { kind: 'reminder'; reminder: BoardReminder };

const ONES: Record<string, number> = {
  zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19
};

const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90
};

function normalize(spoken: string): string {
  let text = spoken.toLowerCase().replace(/[^a-z0-9:\s]/g, ' ').replace(/\s+/g, ' ').trim();
  text = text.replace(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[\s-](one|two|three|four|five|six|seven|eight|nine)\b/g, (_, ten, one) => {
    return String(TENS[ten] + ONES[one]);
  });
  text = text.replace(/\b(an|a)\s+(hour|minute|second)s?\b/g, '1 $2');
  text = text.replace(/\b(zero|oh|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\b/g, (word) => {
    if (ONES[word] !== undefined) {
      return String(ONES[word]);
    }
    return String(TENS[word] ?? word);
  });
  return text.replace(/\s+/g, ' ').trim();
}

function durationMs(text: string): number | null {
  let hours = 0;
  let minutes = 0;
  let seconds = 0;
  const hour = text.match(/(\d+)\s*hours?/);
  const minute = text.match(/(\d+)\s*minutes?/);
  const second = text.match(/(\d+)\s*seconds?/);
  if (hour) {
    hours = Number(hour[1]);
  }
  if (minute) {
    minutes = Number(minute[1]);
  }
  if (second) {
    seconds = Number(second[1]);
  }
  if (!hour && !minute && !second) {
    const bare = text.match(/\b(\d+)\b/);
    if (!bare) {
      return null;
    }
    minutes = Number(bare[1]);
  }
  const ms = ((hours * 60 + minutes) * 60 + seconds) * 1000;
  return ms >= 1000 ? ms : null;
}

function timerLabel(text: string, ms: number): string {
  const named = text.match(/(?:called|named|for)\s+([a-z0-9 ]+?)(?:\s+\d|\s*$)/);
  if (named && !/^(a|an|the|timer|alarm|minutes?|hours?|seconds?)$/.test(named[1].trim())) {
    const label = named[1].trim();
    if (label && !/^\d/.test(label)) {
      return label.replace(/\b(minutes?|hours?|seconds?)\b/g, '').trim() || 'Timer';
    }
  }
  const total = Math.round(ms / 60000);
  if (total < 1) {
    return 'Timer';
  }
  return total === 1 ? '1 minute' : `${total} minutes`;
}

function nextClock(hour: number, minute: number, meridiem?: 'am' | 'pm'): Date | null {
  if (hour > 23 || minute > 59) {
    return null;
  }
  const now = Date.now();
  const build = (hours24: number, extraDays: number) => {
    const at = new Date();
    at.setSeconds(0, 0);
    at.setHours(hours24, minute, 0, 0);
    at.setDate(at.getDate() + extraDays);
    return at;
  };
  const candidates: Date[] = [];
  if (meridiem) {
    let hours24 = hour % 12;
    if (meridiem === 'pm') {
      hours24 += 12;
    }
    candidates.push(build(hours24, 0), build(hours24, 1));
  } else if (hour > 12) {
    candidates.push(build(hour, 0), build(hour, 1));
  } else {
    const twelve = hour % 12;
    candidates.push(build(twelve, 0), build(twelve + 12, 0), build(twelve, 1), build(twelve + 12, 1));
  }
  const future = candidates
    .filter(at => at.getTime() > now)
    .sort((a, b) => a.getTime() - b.getTime());
  return future[0] || null;
}

function parseClock(text: string): { at: Date; rest: string } | null {
  const tomorrow = /\btomorrow\b/.test(text);
  let rest = text.replace(/\b(tomorrow|today)\b/g, ' ');
  const match = rest.match(/\b(?:at|@)\s+(\d{1,2})(?:[:\s](\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/)
    || rest.match(/\b(\d{1,2})(?::(\d{2}))\s*(a\.?m\.?|p\.?m\.?)?/);
  if (!match) {
    const noon = rest.match(/\b(noon|midnight)\b/);
    if (!noon) {
      return null;
    }
    const at = nextClock(noon[1] === 'midnight' ? 0 : 12, 0, noon[1] === 'midnight' ? 'am' : 'pm');
    return at ? { at, rest: rest.replace(noon[0], ' ') } : null;
  }
  const hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const mer = match[3] ? (match[3].startsWith('p') ? 'pm' : 'am') : undefined;
  let at = nextClock(hour, minute, mer);
  if (!at) {
    return null;
  }
  if (tomorrow && at.getDate() === new Date().getDate()) {
    at = new Date(at.getTime());
    at.setDate(at.getDate() + 1);
  }
  rest = rest.replace(match[0], ' ');
  return { at, rest };
}

function reminderLabel(text: string): string {
  const cleaned = text
    .replace(/\b(set|a|an|the|please|remind(?:er| me)?|alarm|timer|to|for|at|today|tomorrow)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || 'Reminder';
}

const WAKE = /(?:^|\s)(?:(?:ok(?:ay)?|hey|hello)\s+)?(?:home\s*(?:board|bored|bard|broad)|homeboard|holm\s*board)\b[, ]*/;

/** Pull a HomeBoard wake word out of a phrase. */
export function takeWake(spoken: string): { woke: boolean; rest: string } {
  const text = normalize(spoken);
  const match = text.match(WAKE);
  if (!match) {
    return { woke: false, rest: text };
  }
  return { woke: true, rest: text.replace(WAKE, ' ').replace(/\s+/g, ' ').trim() };
}

function isStop(text: string): boolean {
  return /^(stop|silence|quiet|enough)(?:\s+(the\s+)?(alarm|timer|sound|it))?$/.test(text)
    || /\b(stop|silence)\s+(the\s+)?(alarm|timer|sound)\b/.test(text)
    || text === 'cancel alarm';
}

/** Turn a spoken phrase into a stop, timer, or reminder. */
export function parseVoiceCommand(spoken: string): VoiceCommand | null {
  const text = normalize(spoken);
  if (!text || isStop(text)) {
    return text && isStop(text) ? { kind: 'stop' } : null;
  }
  if (/\b(wifi|timezone|password|calendar|google|microsoft|apple)\b/.test(text)) {
    return null;
  }

  const wantsReminder = /\bremind/.test(text) || (/\balarm\b/.test(text) && /\b(at|tomorrow|noon|midnight)\b/.test(text));
  const wantsTimer = /\b(timer|alarm)\b/.test(text) && !wantsReminder;
  const clock = parseClock(text);

  if (wantsReminder || (clock && !wantsTimer)) {
    if (!clock) {
      return null;
    }
    return {
      kind: 'reminder',
      reminder: {
        id: Date.now().toString(),
        label: reminderLabel(clock.rest),
        at: clock.at.getTime()
      }
    };
  }

  if (wantsTimer || /\b(in|for)\s+\d/.test(text)) {
    const ms = durationMs(text);
    if (!ms) {
      return null;
    }
    return {
      kind: 'timer',
      timer: {
        id: `${Date.now()}`,
        label: timerLabel(text, ms),
        durationMs: ms,
        endsAt: Date.now() + ms
      }
    };
  }

  return null;
}
