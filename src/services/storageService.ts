import { AppSettings, AppState, FamilyMember, Widget } from '../types';
import { ChoreService } from './choreService';
import { SportsService } from './sportsService';
import { SettingsService } from './settingsService';

const STORAGE_KEY = 'homeboard.appState.v1';

const DATE_KEYS = new Set(['start', 'end', 'nextDue', 'lastCompleted', 'date']);

export function createDefaultWidgets(): Widget[] {
  return [
    { id: 'weather-default', type: 'weather', title: 'Weather & Time', size: { width: 300, height: 440 }, columnSpan: 2, config: {} },
    { id: 'calendar-default', type: 'calendar', title: 'Calendar', size: { width: 350, height: 440 }, columnSpan: 2, config: {} },
    { id: 'chores-default', type: 'chores', title: 'Family Chores', size: { width: 320, height: 440 }, columnSpan: 2, config: {} },
    { id: 'sports-default', type: 'sports', title: 'Sports Tracker', size: { width: 350, height: 440 }, columnSpan: 2, config: {} }
  ];
}

export function createDefaultAppState(): AppState {
  const familyMembers = ChoreService.createDefaultChoreConfig().members;
  return {
    widgets: createDefaultWidgets(),
    weatherLocations: [],
    calendarConfig: {
      sources: {},
      events: []
    },
    familyMembers,
    choreConfig: {
      members: familyMembers,
      chores: []
    },
    sportsConfig: {
      members: familyMembers,
      sports: []
    },
    shoppingList: [],
    settings: SettingsService.createDefaultSettings()
  };
}

function reviveDates(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(reviveDates);
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (typeof child === 'string' && DATE_KEYS.has(key) && !Number.isNaN(Date.parse(child))) {
        result[key] = new Date(child);
      } else {
        result[key] = reviveDates(child);
      }
    }
    return result;
  }
  return value;
}

function upgradeTheme(settings: AppSettings | undefined): AppSettings {
  const defaults = SettingsService.createDefaultSettings();
  const background = settings?.theme?.background;
  const first = (background?.gradient?.colors?.[0] || '').toLowerCase();
  const legacyGradient = background?.type === 'gradient'
    && ['#667eea', '#1e2430', '#1e3c72', '#ff6b6b', '#2d5a27'].includes(first);
  const legacyMinimal = background?.type === 'color' && background.color === '#f8f9fa';
  if (!settings?.theme || legacyGradient || legacyMinimal) {
    return defaults;
  }
  return settings;
}

function mergeMembers(primary: FamilyMember[] = [], ...others: FamilyMember[][]): FamilyMember[] {
  const byId = new Map<string, FamilyMember>();
  for (const member of [...primary, ...others.flat()]) {
    if (member?.id && !byId.has(member.id)) {
      byId.set(member.id, member);
    }
  }
  return Array.from(byId.values());
}

export function normalizeAppState(raw: Partial<AppState> | null | undefined): AppState {
  const defaults = createDefaultAppState();
  if (!raw) {
    return defaults;
  }

  const familyMembers = mergeMembers(
    raw.familyMembers || [],
    raw.choreConfig?.members || [],
    raw.sportsConfig?.members || [],
    defaults.familyMembers
  );

  const choreConfig = ChoreService.refreshDueChores({
    members: familyMembers,
    chores: raw.choreConfig?.chores || []
  });

  return {
    widgets: raw.widgets?.length ? raw.widgets : defaults.widgets,
    weatherLocations: raw.weatherLocations || [],
    calendarConfig: {
      sources: raw.calendarConfig?.sources || {},
      events: raw.calendarConfig?.events || []
    },
    familyMembers,
    choreConfig,
    sportsConfig: {
      members: familyMembers,
      sports: raw.sportsConfig?.sports || SportsService.createDefaultSportsConfig().sports
    },
    shoppingList: raw.shoppingList || [],
    settings: upgradeTheme(raw.settings) || defaults.settings
  };
}

export function loadAppState(): AppState {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return createDefaultAppState();
    }
    const parsed = reviveDates(JSON.parse(stored)) as Partial<AppState>;
    return normalizeAppState(parsed);
  } catch (error) {
    console.error('Failed to load HomeBoard state:', error);
    return createDefaultAppState();
  }
}

export function saveAppState(state: AppState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Failed to save HomeBoard state:', error);
  }
}
