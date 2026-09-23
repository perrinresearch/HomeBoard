import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { WeatherLocation, CalendarConfig, ChoreConfig, SportsConfig, AppState, CalendarEvent, FamilyMember, AppSettings, WeatherData, DailyForecast } from './types';
import { WeatherService } from './services/weatherService';
import { ChoreService } from './services/choreService';
import { SportsService } from './services/sportsService';
import { CalendarService, WifiStatus, calendarOwners } from './services/calendarService';
import { SettingsService } from './services/settingsService';
import { loadAppState, saveAppState } from './services/storageService';
import { pushRemoteEvents, useHouseholdSync } from './services/householdService';
import ConfigShell, { ConfigSection } from './components/ConfigShell';
import ChoreWidget from './components/ChoreWidget';
import OnScreenKeyboard from './components/OnScreenKeyboard';
import ScheduleBoard from './components/ScheduleBoard';
import WeatherNow from './components/WeatherNow';
import WeatherWidget from './components/WeatherWidget';
import { FiSettings, FiWifi, FiWifiOff } from 'react-icons/fi';

const AppContainer = styled.div<{ background: string; light: boolean }>`
  min-height: 100vh;
  box-sizing: border-box;
  background: ${props => props.background};
  background-size: cover;
  background-position: center;
  padding: 20px 24px;
  color: ${props => props.light ? 'var(--hb-text)' : '#f5f6f8'};
`;

const Dashboard = styled.div`
  width: 100%;
  position: relative;
  min-height: calc(100vh - 40px);
`;

const Header = styled.header`
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 18px;
  gap: 16px;
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 18px;
`;

const Divider = styled.span`
  width: 1px;
  height: 36px;
  background: currentColor;
  opacity: 0.12;
`;

const todayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const Clock = styled.div`
  display: flex;
  align-items: baseline;
  gap: 14px;
`;

const Time = styled.div`
  font-size: 44px;
  font-weight: 600;
  letter-spacing: -0.04em;
  line-height: 1;
  font-variant-numeric: tabular-nums;
`;

const DateLine = styled.div`
  font-size: 17px;
  font-weight: 500;
  opacity: 0.6;
`;

const HeaderActions = styled.div`
  display: flex;
  gap: 8px;
`;

const HeaderButton = styled.button<{ chrome: string }>`
  background: ${props => props.chrome};
  color: var(--hb-text);
  border: 1px solid var(--hb-line);
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
  padding: 0 18px;
  min-height: 44px;
  border-radius: 999px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;

  &:active {
    background: var(--hb-paper);
  }
`;

const WifiChip = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  border: none;
  background: transparent;
  color: inherit;
  padding: 4px 8px;
  border-radius: 14px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 600;
  opacity: 0.72;
  max-width: 180px;

  &:active {
    background: rgba(31, 35, 40, 0.05);
  }
`;

const WifiName = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ModalScrim = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(31, 35, 40, 0.28);
  backdrop-filter: blur(6px);
  z-index: 1500;
  overflow: auto;
  padding: 40px 24px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
`;

const Sheet = styled.div`
  width: min(960px, 100%);
  background: var(--hb-card);
  color: var(--hb-text);
  border-radius: 24px;
  box-shadow: 0 24px 64px rgba(16, 24, 40, 0.16);
  padding: 20px 24px 24px;
`;

const SheetHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-size: 20px;
  font-weight: 650;
  letter-spacing: -0.01em;
`;

const LiveClock: React.FC = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <Clock>
      <Time>{now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Time>
      <DateLine>{now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</DateLine>
    </Clock>
  );
};

const isLightBackground = (background: string) => {
  const hex = background.match(/#([0-9a-f]{6})/i)?.[1];
  if (!hex || background.includes('gradient') || background.includes('url(')) {
    return background.startsWith('#f') || background.startsWith('#e') || background === '#f8f9fa';
  }
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 180;
};

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(() => loadAppState());
  const [configSection, setConfigSection] = useState<ConfigSection | null>(null);
  const [showChores, setShowChores] = useState(false);
  const [showWeather, setShowWeather] = useState(false);
  const [wifi, setWifi] = useState<WifiStatus | null>(null);
  const [weatherNow, setWeatherNow] = useState<WeatherData | null>(null);
  const [forecast, setForecast] = useState<DailyForecast[]>([]);
  const [apiEvents, setApiEvents] = useState<CalendarEvent[] | null>(null);
  const [cloudEvents, setCloudEvents] = useState<CalendarEvent[]>([]);
  const remoteEvents = apiEvents ?? cloudEvents;
  const onCloudEvents = useCallback((events: CalendarEvent[]) => {
    setCloudEvents(events);
  }, []);

  useEffect(() => {
    saveAppState(appState);
  }, [appState]);

  useHouseholdSync(appState, setAppState, onCloudEvents);

  useEffect(() => {
    const tick = () => {
      setAppState(prev => {
        const refreshed = ChoreService.refreshDueChores(prev.choreConfig);
        if (refreshed === prev.choreConfig) {
          return prev;
        }
        const changed = refreshed.chores.some((chore, index) => chore.completed !== prev.choreConfig.chores[index]?.completed);
        return changed ? { ...prev, choreConfig: refreshed } : prev;
      });
    };
    const id = window.setInterval(tick, 60000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    if (connected !== 'google' && connected !== 'microsoft') {
      return;
    }
    const owner = sessionStorage.getItem('homeboard.pendingCalendarOwner');
    const accountId = params.get('account') || '';
    sessionStorage.removeItem('homeboard.pendingCalendarOwner');
    window.history.replaceState({}, '', window.location.pathname);
    setConfigSection('calendars');
    if (!owner) {
      return;
    }
    void (async () => {
      try {
        const sources = await CalendarService.fetchSources();
        const accounts = connected === 'google' ? sources.google : sources.microsoft;
        const targets = accountId ? accounts.filter(account => account.id === accountId) : accounts;
        for (const account of targets) {
          for (const calendar of account.calendars) {
            if (calendarOwners(calendar).length === 0) {
              await CalendarService.setOwner(connected, calendar.id, owner, account.id, 'add');
              await CalendarService.setCalendarEnabled(connected, calendar.id, true, account.id);
            }
          }
        }
      } catch (error) {
        console.error('Could not assign calendars after sign-in', error);
      }
    })();
  }, []);

  useEffect(() => {
    const parseWhen = (value: string, allDay?: boolean) => {
      if (allDay || /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [year, month, day] = value.slice(0, 10).split('-').map(Number);
        return new Date(year, month - 1, day);
      }
      return new Date(value);
    };
    let stop = false;
    const load = async () => {
      try {
        const body = await CalendarService.fetchEvents();
        if (stop) {
          return;
        }
        const events = body.events.map(event => ({
          ...event,
          start: parseWhen(event.start, event.allDay),
          end: parseWhen(event.end, event.allDay)
        }));
        setApiEvents(events);
        void pushRemoteEvents(events);
      } catch (error) {
        if (!stop) {
          setApiEvents(null);
        }
      }
    };
    load();
    const id = window.setInterval(load, 15 * 60 * 1000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const next = await CalendarService.fetchWifi();
        if (!stop) {
          setWifi(next);
        }
      } catch {
        if (!stop) {
          setWifi(null);
        }
      }
    };
    load();
    const id = window.setInterval(load, 15000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const location = appState.weatherLocations[0];
    if (!location) {
      return;
    }
    let stop = false;
    const load = () => {
      WeatherService.getCurrentWeather(location)
        .then(data => { if (!stop) setWeatherNow(data); })
        .catch(() => { if (!stop) setWeatherNow(null); });
      WeatherService.getForecast(location)
        .then(days => { if (!stop) setForecast(days); })
        .catch(() => { if (!stop) setForecast([]); });
    };
    load();
    const id = window.setInterval(load, 30 * 60 * 1000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [appState.weatherLocations]);

  useEffect(() => {
    const initializeCurrentLocation = async () => {
      if (appState.weatherLocations.length > 0) {
        return;
      }
      try {
        const coords = await WeatherService.getCurrentLocation();
        const currentLocation: WeatherLocation = {
          id: 'current',
          name: 'Current Location',
          lat: coords.lat,
          lon: coords.lon,
          isCurrentLocation: true
        };
        setAppState(prev => (
          prev.weatherLocations.length > 0
            ? prev
            : { ...prev, weatherLocations: [currentLocation] }
        ));
      } catch (error) {
        const defaultLocation: WeatherLocation = {
          id: 'default',
          name: 'New York, US',
          lat: 40.7128,
          lon: -74.0060,
          isCurrentLocation: false
        };
        setAppState(prev => (
          prev.weatherLocations.length > 0
            ? prev
            : { ...prev, weatherLocations: [defaultLocation] }
        ));
      }
    };

    initializeCurrentLocation();
  }, [appState.weatherLocations.length]);

  const syncFamilyMembers = (members: FamilyMember[], extra: Partial<AppState> = {}) => {
    setAppState(prev => {
      const nextChores = extra.choreConfig || prev.choreConfig;
      const nextSports = extra.sportsConfig || prev.sportsConfig;
      const memberIds = new Set(members.map(member => member.id));
      return {
        ...prev,
        ...extra,
        familyMembers: members,
        choreConfig: {
          ...nextChores,
          members,
          chores: nextChores.chores.filter(chore => memberIds.has(chore.assignedTo))
        },
        sportsConfig: {
          ...nextSports,
          members,
          sports: nextSports.sports.filter(sport => memberIds.has(sport.familyMemberId))
        }
      };
    });
  };

  const handleCalendarConfigChange = (config: CalendarConfig) => {
    setAppState(prev => ({
      ...prev,
      calendarConfig: config
    }));
  };

  const handleChoreConfigChange = (config: ChoreConfig) => {
    syncFamilyMembers(config.members, { choreConfig: config });
  };

  const handleSportsConfigChange = (config: SportsConfig) => {
    syncFamilyMembers(config.members, { sportsConfig: config });
  };

  const handleSettingsChange = (settings: AppSettings) => {
    setAppState(prev => ({
      ...prev,
      settings
    }));
  };

  const background = useMemo(
    () => SettingsService.generateCSSBackground(appState.settings.theme.background),
    [appState.settings.theme.background]
  );
  const headerChrome = useMemo(
    () => SettingsService.generateCSSHeader(appState.settings.theme.header),
    [appState.settings.theme.header]
  );
  const light = isLightBackground(background);
  const accentHex = appState.settings.theme.widgetHeader.type === 'color'
    ? appState.settings.theme.widgetHeader.color
    : appState.settings.theme.widgetHeader.gradient?.colors[0];
  const accentStyle = accentHex && /^#[0-9a-f]{6}$/i.test(accentHex)
    ? ({
      '--hb-accent': accentHex,
      '--hb-accent-dark': accentHex,
      '--hb-accent-soft': `${accentHex}0d`
    } as React.CSSProperties)
    : undefined;

  return (
    <AppContainer background={background} light={light} style={accentStyle}>
      <Dashboard>
        <Header>
          <HeaderLeft>
            <LiveClock />
            <Divider />
            <WeatherNow
              now={weatherNow}
              today={forecast.find(day => day.date === todayKey())}
              onOpen={() => setShowWeather(true)}
            />
            {wifi ? (
              <>
                <Divider />
                <WifiChip
                  type="button"
                  onClick={() => setConfigSection('board')}
                  aria-label={wifi.connected && wifi.ssid ? `Wi-Fi ${wifi.ssid}` : 'Wi-Fi disconnected'}
                >
                  {wifi.connected ? <FiWifi size={18} /> : <FiWifiOff size={18} />}
                  <WifiName>{wifi.connected && wifi.ssid ? wifi.ssid : 'No Wi-Fi'}</WifiName>
                </WifiChip>
              </>
            ) : null}
          </HeaderLeft>
          <HeaderActions>
            <HeaderButton chrome={headerChrome} onClick={() => setConfigSection('family')}>
              <FiSettings size={20} />
              Settings
            </HeaderButton>
          </HeaderActions>
        </Header>

        <ScheduleBoard
          members={appState.familyMembers}
          events={[
            ...remoteEvents,
            ...SportsService.getAllSportEvents(appState.sportsConfig).map(event => {
              const sport = appState.sportsConfig.sports.find(item => item.id === event.sportId);
              const member = appState.familyMembers.find(item => item.id === event.familyMemberId);
              if (!sport || !member) {
                return null;
              }
              return CalendarService.convertSportEventToCalendarEvent(event, sport, member);
            }).filter((event): event is CalendarEvent => Boolean(event)),
            ...appState.calendarConfig.events.map(event => ({
              ...event,
              start: new Date(event.start),
              end: new Date(event.end),
              source: event.source || 'local' as const
            }))
          ]}
          chores={appState.choreConfig.chores}
          shopping={appState.shoppingList}
          forecast={forecast}
          onCompleteChore={(id) => handleChoreConfigChange(ChoreService.completeChore(appState.choreConfig, id))}
          onAddChore={(title, memberId) => handleChoreConfigChange(ChoreService.addChore(appState.choreConfig, title, '', memberId, 'weekly', 1))}
          onOpenChores={() => setShowChores(true)}
          onChangeShopping={(shoppingList) => setAppState(prev => ({ ...prev, shoppingList }))}
          onAddEvent={(title, start, memberId) => handleCalendarConfigChange({
            ...appState.calendarConfig,
            events: [...appState.calendarConfig.events, {
              id: Date.now().toString(),
              title,
              start,
              end: new Date(start.getTime() + 60 * 60 * 1000),
              source: 'local',
              familyMemberId: memberId
            }]
          })}
        />

        {showChores && (
          <ModalScrim>
            <Sheet>
              <SheetHeader>
                Chores
                <HeaderButton chrome="var(--hb-card)" onClick={() => setShowChores(false)}>Done</HeaderButton>
              </SheetHeader>
              <ChoreWidget config={appState.choreConfig} onConfigChange={handleChoreConfigChange} />
            </Sheet>
          </ModalScrim>
        )}
        {showWeather && (
          <ModalScrim>
            <Sheet style={{ width: 'min(560px, 100%)' }}>
              <SheetHeader>
                Weather location
                <HeaderButton chrome="var(--hb-card)" onClick={() => setShowWeather(false)}>Done</HeaderButton>
              </SheetHeader>
              <WeatherWidget
                homeMode
                locations={appState.weatherLocations}
                onLocationsChange={(weatherLocations) => setAppState(prev => ({ ...prev, weatherLocations }))}
              />
            </Sheet>
          </ModalScrim>
        )}
        {configSection && (
          <ConfigShell
            section={configSection}
            appState={appState}
            onSection={setConfigSection}
            onClose={() => setConfigSection(null)}
            onSettingsChange={handleSettingsChange}
            onChoresChange={handleChoreConfigChange}
            onSportsChange={handleSportsConfigChange}
            onWifiChange={setWifi}
          />
        )}
        <OnScreenKeyboard />
      </Dashboard>
    </AppContainer>
  );
};

export default App;
