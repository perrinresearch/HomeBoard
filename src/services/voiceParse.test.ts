import { commandFromRemote, parseVoiceCommand, takeWake } from './voiceParse';

describe('takeWake', () => {
  it('hears HomeBoard and common mishears', () => {
    expect(takeWake('HomeBoard').woke).toBe(true);
    expect(takeWake('hey home board timer 10 minutes').rest).toContain('timer');
    expect(takeWake('home bored').woke).toBe(true);
    expect(takeWake('set a timer').woke).toBe(false);
  });
});

describe('parseVoiceCommand', () => {
  it('starts a timer and a reminder from a spoken phrase', () => {
    const timer = parseVoiceCommand('timer 10 minutes');
    expect(timer?.kind).toBe('timer');
    if (timer?.kind === 'timer') {
      expect(timer.timer.durationMs).toBe(600000);
    }
    const reminder = parseVoiceCommand('remind me at 7:30 pm to take out trash');
    expect(reminder?.kind).toBe('reminder');
    expect(parseVoiceCommand('stop')).toEqual({ kind: 'stop' });
    expect(parseVoiceCommand('add detergent to the shopping list')).toEqual({ kind: 'shop', item: 'detergent' });
  });
});

describe('commandFromRemote', () => {
  it('builds a timer and a reminder from model JSON', () => {
    const timer = commandFromRemote({ kind: 'timer', minutes: 10, label: 'oven' });
    expect(timer?.kind).toBe('timer');
    if (timer?.kind === 'timer') {
      expect(timer.timer.durationMs).toBe(600000);
      expect(timer.timer.label).toBe('oven');
    }
    const reminder = commandFromRemote({ kind: 'reminder', hour: 7, minute: 30, meridiem: 'pm', label: 'trash' });
    expect(reminder?.kind).toBe('reminder');
    if (reminder?.kind === 'reminder') {
      expect(reminder.reminder.label).toBe('trash');
    }
    expect(commandFromRemote({ kind: 'none' })).toBeNull();
    expect(commandFromRemote({ kind: 'stop' })).toEqual({ kind: 'stop' });
    expect(commandFromRemote({ kind: 'shop', label: 'detergent' })).toEqual({ kind: 'shop', item: 'detergent' });
  });
});
