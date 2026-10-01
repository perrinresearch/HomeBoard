import { parseVoiceCommand, takeWake } from './voiceParse';

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
  });
});
