import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { CalendarConfig, CalendarEvent, FamilyMember } from '../types';
import {
  AppleFeed,
  CalendarService,
  CalendarSources,
  RemoteAccount
} from '../services/calendarService';
import { FiPlus, FiSettings, FiTrash2, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { format, isSameDay, isToday } from 'date-fns';

interface CalendarWidgetProps {
  config: CalendarConfig;
  onConfigChange: (config: CalendarConfig) => void;
  sportsEvents?: CalendarEvent[];
  members?: FamilyMember[];
  accountsOnly?: boolean;
  onClose?: () => void;
}

const emptySources = (): CalendarSources => ({
  google: { connected: false, calendars: [] },
  microsoft: { connected: false, calendars: [] },
  apple: []
});

const Frame = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 14px;
`;

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

const MonthLabel = styled.div`
  font-size: 20px;
  font-weight: 650;
  letter-spacing: -0.02em;
`;

const IconButton = styled.button`
  min-width: var(--hb-touch);
  min-height: var(--hb-touch);
  border: none;
  border-radius: 14px;
  background: var(--hb-paper);
  color: var(--hb-text);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
`;

const Weekdays = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  color: var(--hb-muted);
  font-size: 13px;
  text-align: center;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
`;

const Day = styled.button<{ selected: boolean; outside: boolean; today: boolean }>`
  min-height: 52px;
  border: none;
  border-radius: 12px;
  background: ${props => props.selected ? 'var(--hb-accent)' : props.today ? 'var(--hb-paper)' : 'transparent'};
  color: ${props => props.selected ? 'white' : props.outside ? '#b7b1a8' : 'var(--hb-text)'};
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  font-weight: 600;
`;

const Dots = styled.span`
  display: flex;
  gap: 3px;
  min-height: 6px;
`;

const Dot = styled.span<{ color: string }>`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${props => props.color};
`;

const Agenda = styled.div`
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const AgendaTitle = styled.h3`
  margin: 4px 0 0;
  font-size: 16px;
  font-weight: 650;
`;

const EventCard = styled.div<{ color: string }>`
  background: var(--hb-paper);
  border-radius: 14px;
  padding: 12px 14px;
  border-left: 4px solid ${props => props.color};
`;

const EventTitle = styled.div`
  font-weight: 650;
`;

const EventMeta = styled.div`
  color: var(--hb-muted);
  font-size: 14px;
  margin-top: 2px;
`;

const Quiet = styled.div`
  color: var(--hb-muted);
  font-size: 15px;
`;

const ErrorText = styled.div`
  color: var(--hb-danger);
  font-size: 14px;
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(31, 35, 40, 0.28);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
`;

const Sheet = styled.div`
  background: var(--hb-card);
  border-radius: var(--hb-radius);
  width: min(560px, 100%);
  max-height: 86vh;
  overflow-y: auto;
  padding: 22px;
`;

const SheetTitle = styled.h2`
  margin: 0 0 16px;
  font-size: 24px;
`;

const ProviderBlock = styled.section`
  border-top: 1px solid var(--hb-line);
  padding: 14px 0;
`;

const Row = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
`;

const Button = styled.button`
  min-height: var(--hb-touch);
  border: none;
  border-radius: 14px;
  padding: 10px 16px;
  background: var(--hb-accent);
  color: white;
  font-weight: 650;
  cursor: pointer;

  &.quiet {
    background: var(--hb-paper);
    color: var(--hb-text);
  }
`;

const Field = styled.input`
  width: 100%;
  box-sizing: border-box;
  min-height: var(--hb-touch);
  border: 1px solid var(--hb-line);
  border-radius: 12px;
  padding: 8px 12px;
  background: white;
  margin-bottom: 8px;
`;

const Check = styled.label`
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 40px;
`;

const Swatch = styled.span<{ color: string }>`
  width: 14px;
  height: 14px;
  flex: none;
  border-radius: 4px;
  background: ${props => props.color};
  box-shadow: inset 0 0 0 1px rgba(31, 35, 40, 0.08);
`;

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parseWhen(value: string, allDay?: boolean): Date {
  if (allDay || /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.slice(0, 10).split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(value);
}

function monthCells(cursor: Date): Date[] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

const CalendarWidget: React.FC<CalendarWidgetProps> = ({ config, onConfigChange, sportsEvents = [], members = [], accountsOnly = false, onClose }) => {
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState(() => new Date());
  const [remote, setRemote] = useState<CalendarEvent[]>([]);
  const [sources, setSources] = useState<CalendarSources>(emptySources);
  const [errors, setErrors] = useState<string[]>([]);
  const [showSettings, setShowSettings] = useState(accountsOnly);
  const [appleUrl, setAppleUrl] = useState('');
  const [formError, setFormError] = useState('');
  const [draft, setDraft] = useState({ title: '', date: '', time: '', location: '' });

  const loadRemote = useCallback(async () => {
    try {
      const [eventBody, sourceBody] = await Promise.all([
        CalendarService.fetchEvents(),
        CalendarService.fetchSources()
      ]);
      setSources(sourceBody);
      setRemote(eventBody.events.map(event => ({
        ...event,
        start: parseWhen(event.start, event.allDay),
        end: parseWhen(event.end, event.allDay)
      })));
      setErrors(eventBody.errors.map(error => `${error.provider}: ${error.message}`));
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Calendar service is not available']);
    }
  }, []);

  useEffect(() => {
    loadRemote();
    const id = window.setInterval(loadRemote, 15 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [loadRemote]);

  const events = useMemo(() => {
    const local = config.events.map(event => ({
      ...event,
      start: new Date(event.start),
      end: new Date(event.end),
      source: event.source || 'local' as const,
      color: event.color || 'var(--hb-accent)'
    }));
    return [...remote, ...sportsEvents, ...local];
  }, [config.events, remote, sportsEvents]);

  const cells = monthCells(cursor);
  const selectedEvents = events
    .filter(event => isSameDay(event.start, selected))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const dotsFor = (day: Date) => {
    const colors: string[] = [];
    events.forEach(event => {
      if (isSameDay(event.start, day) && event.color && !colors.includes(event.color)) {
        colors.push(event.color);
      }
    });
    return colors.slice(0, 3);
  };

  const shiftMonth = (delta: number) => {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1);
    setCursor(next);
  };

  const addLocal = () => {
    if (!draft.title || !draft.date) {
      return;
    }
    const start = new Date(`${draft.date}T${draft.time || '09:00'}`);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    onConfigChange({
      ...config,
      events: [...config.events, {
        id: Date.now().toString(),
        title: draft.title,
        start,
        end,
        location: draft.location || undefined,
        color: '#3d4fdb',
        source: 'local'
      }]
    });
    setDraft({ title: '', date: '', time: '', location: '' });
  };

  const connect = async (provider: 'google' | 'microsoft') => {
    setFormError('');
    const url = CalendarService.connectUrl(provider);
    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
        window.location.assign(url);
        return;
      }
      if (response.status === 404) {
        setFormError('Sign-in is not available in this local preview. Connect from the dashboard on the Pi.');
        return;
      }
      const body = await response.json().catch(() => ({} as { error?: string }));
      setFormError(body.error || 'Calendar sign-in is not available.');
    } catch {
      setFormError('Sign-in is not available in this local preview. Connect from the dashboard on the Pi.');
    }
  };

  const toggleCalendar = async (provider: 'google' | 'microsoft', id: string, enabled: boolean) => {
    setFormError('');
    try {
      setSources(await CalendarService.setCalendarEnabled(provider, id, enabled));
      await loadRemote();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not update that calendar');
    }
  };

  const addApple = async () => {
    setFormError('');
    try {
      await CalendarService.addApple(appleUrl);
      setAppleUrl('');
      await loadRemote();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not add that Apple calendar');
    }
  };

  const removeApple = async (feed: AppleFeed) => {
    setSources(await CalendarService.removeApple(feed.id));
    await loadRemote();
  };

  const disconnect = async (provider: 'google' | 'microsoft') => {
    setSources(await CalendarService.disconnect(provider));
    await loadRemote();
  };

  const renderAccount = (provider: 'google' | 'microsoft', label: string, account: RemoteAccount) => (
    <ProviderBlock>
      <Row>
        <div>
          <strong>{label}</strong>
          {account.connected && account.email ? <EventMeta>{account.email}</EventMeta> : null}
        </div>
        {account.connected ? (
          <Button className="quiet" onClick={() => disconnect(provider)}>Disconnect</Button>
        ) : (
          <Button onClick={() => connect(provider)}>Connect</Button>
        )}
      </Row>
      {account.calendars.map(calendar => (
        <Check key={calendar.id}>
          <input
            type="checkbox"
            checked={calendar.enabled}
            onChange={(event) => toggleCalendar(provider, calendar.id, event.target.checked)}
          />
          <Swatch color={calendar.color || (provider === 'google' ? '#1a73e8' : '#0f6cbd')} />
          <span style={{ flex: 1 }}>{calendar.name}</span>
          <select
            value={calendar.familyMemberId || ''}
            onChange={async (event) => {
              setFormError('');
              try {
                setSources(await CalendarService.setOwner(provider, calendar.id, event.target.value));
                await loadRemote();
              } catch (error) {
                setFormError(error instanceof Error ? error.message : 'Could not assign that calendar');
              }
            }}
          >
            <option value="">Unassigned</option>
            <option value="household">Household</option>
            {members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
        </Check>
      ))}
    </ProviderBlock>
  );

  return (
    <Frame>
      {!accountsOnly && <Toolbar>
        <IconButton onClick={() => shiftMonth(-1)} aria-label="Previous month">
          <FiChevronLeft size={22} />
        </IconButton>
        <MonthLabel>{format(cursor, 'MMMM yyyy')}</MonthLabel>
        <div style={{ display: 'flex' }}>
          <IconButton onClick={() => shiftMonth(1)} aria-label="Next month">
            <FiChevronRight size={22} />
          </IconButton>
          <IconButton onClick={() => setShowSettings(true)} aria-label="Calendar settings">
            <FiSettings size={20} />
          </IconButton>
        </div>
      </Toolbar>}

      {!accountsOnly && <Weekdays>
        {weekdays.map(day => <div key={day}>{day}</div>)}
      </Weekdays>}
      {!accountsOnly && <Grid>
        {cells.map(day => (
          <Day
            key={day.toISOString()}
            selected={isSameDay(day, selected)}
            outside={day.getMonth() !== cursor.getMonth()}
            today={isToday(day)}
            onClick={() => setSelected(day)}
          >
            {day.getDate()}
            <Dots>
              {dotsFor(day).map(color => <Dot key={color} color={color} />)}
            </Dots>
          </Day>
        ))}
      </Grid>}

      {!accountsOnly && <Agenda>
        <AgendaTitle>{format(selected, 'EEEE, MMMM d')}</AgendaTitle>
        {errors.map(error => <ErrorText key={error}>{error}</ErrorText>)}
        {selectedEvents.length === 0 ? (
          <Quiet>Nothing scheduled.</Quiet>
        ) : selectedEvents.map(event => (
          <EventCard key={event.id} color={event.color || '#3d4fdb'}>
            <EventTitle>{event.title}</EventTitle>
            <EventMeta>
              {event.allDay ? 'All day' : format(event.start, 'h:mm a')}
              {event.calendarName ? ` · ${event.calendarName}` : ''}
              {event.location ? ` · ${event.location}` : ''}
            </EventMeta>
          </EventCard>
        ))}
      </Agenda>}

      {(showSettings || accountsOnly) && (
        <Overlay>
          <Sheet>
            <SheetTitle>Calendars</SheetTitle>
            {formError ? <ErrorText>{formError}</ErrorText> : null}
            {renderAccount('google', 'Google', sources.google)}
            {renderAccount('microsoft', 'Outlook', sources.microsoft)}
            <ProviderBlock>
              <strong>Apple</strong>
              <EventMeta>Paste the iCloud share link (webcal or https).</EventMeta>
              {sources.apple.map(feed => (
                <Row key={feed.id}>
                  <Swatch color={feed.color || '#6b6258'} />
                  <span style={{ flex: 1 }}>{feed.name}</span>
                  <select
                    value={feed.familyMemberId || ''}
                    onChange={async (event) => {
                      setFormError('');
                      try {
                        setSources(await CalendarService.setOwner('apple', feed.id, event.target.value));
                        await loadRemote();
                      } catch (error) {
                        setFormError(error instanceof Error ? error.message : 'Could not assign that calendar');
                      }
                    }}
                  >
                    <option value="">Unassigned</option>
                    <option value="household">Household</option>
                    {members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
                  </select>
                  <IconButton onClick={() => removeApple(feed)} aria-label={`Remove ${feed.name}`}>
                    <FiTrash2 size={18} />
                  </IconButton>
                </Row>
              ))}
              <Field
                value={appleUrl}
                placeholder="webcal://pXX-caldav.icloud.com/..."
                onChange={(event) => setAppleUrl(event.target.value)}
              />
              <Button onClick={addApple}>Add Apple calendar</Button>
            </ProviderBlock>
            <ProviderBlock>
              <strong>On this board</strong>
              <Field
                placeholder="Title"
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              />
              <Field
                type="date"
                value={draft.date}
                onChange={(event) => setDraft({ ...draft, date: event.target.value })}
              />
              <Field
                type="time"
                value={draft.time}
                onChange={(event) => setDraft({ ...draft, time: event.target.value })}
              />
              <Field
                placeholder="Location (optional)"
                value={draft.location}
                onChange={(event) => setDraft({ ...draft, location: event.target.value })}
              />
              <Button onClick={addLocal}><FiPlus /> Add event</Button>
              {config.events.map(event => (
                <Row key={event.id}>
                  <span>{event.title}</span>
                  <IconButton
                    aria-label={`Remove ${event.title}`}
                    onClick={() => onConfigChange({
                      ...config,
                      events: config.events.filter(item => item.id !== event.id)
                    })}
                  >
                    <FiTrash2 size={18} />
                  </IconButton>
                </Row>
              ))}
            </ProviderBlock>
            <Row>
              <span />
              <Button className="quiet" onClick={() => { setShowSettings(false); onClose?.(); }}>Close</Button>
            </Row>
          </Sheet>
        </Overlay>
      )}
    </Frame>
  );
};

export default CalendarWidget;
