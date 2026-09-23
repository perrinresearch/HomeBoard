import { CalendarEvent, FamilyMember, Sport, SportEvent } from '../types';

export interface RemoteCalendar {
  id: string;
  name: string;
  enabled: boolean;
  familyMemberId?: string;
  familyMemberIds?: string[];
  color?: string;
}

export interface RemoteAccount {
  id: string;
  connected: boolean;
  email?: string;
  calendars: RemoteCalendar[];
}

export interface AppleFeed {
  id: string;
  name: string;
  familyMemberId?: string;
  familyMemberIds?: string[];
  color?: string;
}

export function calendarOwners(item: { familyMemberId?: string; familyMemberIds?: string[] }): string[] {
  const listed = (item.familyMemberIds || []).map(id => id.trim()).filter(Boolean);
  if (listed.length) {
    return Array.from(new Set(listed));
  }
  return item.familyMemberId ? [item.familyMemberId] : [];
}

export interface CalendarSources {
  google: RemoteAccount[];
  microsoft: RemoteAccount[];
  apple: AppleFeed[];
}

export interface RemoteEventsResponse {
  events: Array<Omit<CalendarEvent, 'start' | 'end'> & { start: string; end: string }>;
  errors: Array<{ provider: string; message: string }>;
}

export interface WifiStatus {
  connected: boolean;
  ssid: string;
  ip: string;
  signal: number | null;
  iface: string;
}

export interface WifiNetwork {
  ssid: string;
  signal: number | null;
  security: 'wpa' | 'open';
}

function accountList(value: RemoteAccount | RemoteAccount[] | undefined): RemoteAccount[] {
  if (!value) {
    return [];
  }
  const accounts = Array.isArray(value) ? value : [value];
  return accounts.filter(account => account && (account.connected || account.email || account.calendars?.length));
}

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
      google: accountList(body.google),
      microsoft: accountList(body.microsoft),
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

  static async disconnect(provider: 'google' | 'microsoft', accountId: string): Promise<CalendarSources> {
    const response = await fetch(`/api/${provider}?id=${encodeURIComponent(accountId)}`, { method: 'DELETE' });
    return readJson<CalendarSources>(response);
  }

  static async setCalendarEnabled(
    provider: 'google' | 'microsoft',
    id: string,
    enabled: boolean,
    accountId = ''
  ): Promise<CalendarSources> {
    const response = await fetch(`/api/${provider}/calendars`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, enabled, accountId })
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
    familyMemberId: string,
    accountId = '',
    action: 'set' | 'add' | 'remove' = 'set'
  ): Promise<CalendarSources> {
    const response = await fetch('/api/owner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, id, familyMemberId, accountId, action })
    });
    return readJson<CalendarSources>(response);
  }

  static async setOwners(
    provider: 'google' | 'microsoft' | 'apple',
    id: string,
    familyMemberIds: string[],
    accountId = ''
  ): Promise<CalendarSources> {
    const response = await fetch('/api/owner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, id, familyMemberIds, accountId })
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

  static async fetchWifi(): Promise<WifiStatus> {
    const response = await fetch('/api/wifi');
    const body = await readJson<Partial<WifiStatus> & { ok?: boolean }>(response);
    if (body.ok !== true) {
      throw new Error('Wi-Fi settings are unavailable');
    }
    return {
      connected: Boolean(body.connected),
      ssid: body.ssid || '',
      ip: body.ip || '',
      signal: typeof body.signal === 'number' ? body.signal : null,
      iface: body.iface || ''
    };
  }

  static async scanWifi(): Promise<WifiNetwork[]> {
    const response = await fetch('/api/wifi/scan');
    const body = await readJson<{ networks?: WifiNetwork[] }>(response);
    if (!Array.isArray(body.networks)) {
      throw new Error('Wi-Fi scan failed');
    }
    return body.networks.map(item => ({
      ssid: item.ssid,
      signal: typeof item.signal === 'number' ? item.signal : null,
      security: item.security === 'wpa' ? 'wpa' : 'open'
    }));
  }

  static async setWifi(ssid: string, password: string): Promise<WifiStatus> {
    const response = await fetch('/api/wifi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ssid, password })
    });
    return readJson<WifiStatus>(response);
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
