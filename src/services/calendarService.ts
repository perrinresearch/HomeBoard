import { CalendarEvent, FamilyMember, Sport, SportEvent } from '../types';

export interface RemoteCalendar {
  id: string;
  name: string;
  enabled: boolean;
  familyMemberId?: string;
  color?: string;
}

export interface RemoteAccount {
  connected: boolean;
  email?: string;
  calendars: RemoteCalendar[];
}

export interface AppleFeed {
  id: string;
  name: string;
  familyMemberId?: string;
  color?: string;
}

export interface CalendarSources {
  google: RemoteAccount;
  microsoft: RemoteAccount;
  apple: AppleFeed[];
}

export interface RemoteEventsResponse {
  events: Array<Omit<CalendarEvent, 'start' | 'end'> & { start: string; end: string }>;
  errors: Array<{ provider: string; message: string }>;
}

const emptyAccount = (): RemoteAccount => ({ connected: false, calendars: [] });

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (body as { error?: string }).error || 'Calendar service is not available';
    throw new Error(message);
  }
  return body as T;
}

export class CalendarService {
  static async fetchSources(): Promise<CalendarSources> {
    const response = await fetch('/api/sources');
    const body = await readJson<Partial<CalendarSources>>(response);
    return {
      google: body.google || emptyAccount(),
      microsoft: body.microsoft || emptyAccount(),
      apple: body.apple || []
    };
  }

  static async fetchEvents(): Promise<RemoteEventsResponse> {
    const response = await fetch('/api/events');
    return readJson<RemoteEventsResponse>(response);
  }

  static connectUrl(provider: 'google' | 'microsoft'): string {
    return `/api/${provider}/start`;
  }

  static async disconnect(provider: 'google' | 'microsoft'): Promise<CalendarSources> {
    const response = await fetch(`/api/${provider}`, { method: 'DELETE' });
    return readJson<CalendarSources>(response);
  }

  static async setCalendarEnabled(
    provider: 'google' | 'microsoft',
    id: string,
    enabled: boolean
  ): Promise<CalendarSources> {
    const response = await fetch(`/api/${provider}/calendars`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, enabled })
    });
    return readJson<CalendarSources>(response);
  }

  static async addApple(url: string): Promise<AppleFeed> {
    const response = await fetch('/api/apple', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    return readJson<AppleFeed>(response);
  }

  static async setOwner(
    provider: 'google' | 'microsoft' | 'apple',
    id: string,
    familyMemberId: string
  ): Promise<CalendarSources> {
    const response = await fetch('/api/owner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, id, familyMemberId })
    });
    return readJson<CalendarSources>(response);
  }

  static async fetchTimezone(): Promise<string> {
    const response = await fetch('/api/timezone');
    const body = await readJson<{ timezone?: string }>(response);
    if (!body.timezone) {
      throw new Error('Timezone settings are unavailable');
    }
    return body.timezone;
  }

  static async fetchTimezones(): Promise<string[]> {
    const response = await fetch('/api/timezones');
    const body = await readJson<{ timezones?: string[] }>(response);
    if (!Array.isArray(body.timezones) || body.timezones.length === 0) {
      throw new Error('Timezone settings are unavailable');
    }
    return body.timezones;
  }

  static async setTimezone(timezone: string): Promise<string> {
    const response = await fetch('/api/timezone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timezone })
    });
    const body = await readJson<{ timezone: string }>(response);
    return body.timezone;
  }

  static async removeApple(id: string): Promise<CalendarSources> {
    const response = await fetch(`/api/apple?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    return readJson<CalendarSources>(response);
  }

  static convertSportEventToCalendarEvent(sportEvent: SportEvent, sport: Sport, member: FamilyMember): CalendarEvent {
    const eventDate = new Date(sportEvent.date);
    const [startHour, startMinute] = sportEvent.startTime.split(':').map(Number);
    const [endHour, endMinute] = sportEvent.endTime.split(':').map(Number);

    const startTime = new Date(eventDate);
    startTime.setHours(startHour, startMinute, 0, 0);

    const endTime = new Date(eventDate);
    endTime.setHours(endHour, endMinute, 0, 0);

    const equipmentText = sportEvent.equipment.length > 0
      ? `\nEquipment: ${sportEvent.equipment.join(', ')}`
      : '';
    const notesText = sportEvent.notes ? `\nNotes: ${sportEvent.notes}` : '';

    return {
      id: sportEvent.id,
      title: `${sport.name} - ${member.name} (${sportEvent.type})`,
      start: startTime,
      end: endTime,
      description: `Location: ${sportEvent.location}${equipmentText}${notesText}`,
      location: sportEvent.location,
      color: member.color,
      source: 'sports',
      calendarName: member.name,
      familyMemberId: member.id
    };
  }
}
