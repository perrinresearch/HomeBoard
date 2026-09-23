import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import { addDays, format, isSameDay, isToday, startOfWeek } from 'date-fns';
import { CalendarEvent, Chore, DailyForecast, FamilyMember, ShoppingItem } from '../types';
import { WeatherIcon, describeDay } from './weatherIcons';
import { ChoreService } from '../services/choreService';
import { FiCheck, FiChevronLeft, FiChevronRight, FiHome, FiPlus, FiX } from 'react-icons/fi';

type View = 'month' | 'week' | 'day';
const HOUSEHOLD = 'household';
const NEUTRAL = '#9a9ea5';
const HOUSEHOLD_COLOR = '#5561d6';
const HOUR_START = 7;
const HOUR_END = 21;
const HOUR_PX = 52;

interface ScheduleBoardProps {
  members: FamilyMember[];
  events: CalendarEvent[];
  chores: Chore[];
  shopping: ShoppingItem[];
  forecast: DailyForecast[];
  onCompleteChore: (id: string) => void;
  onAddChore: (title: string, memberId: string) => void;
  onOpenChores: () => void;
  onChangeShopping: (items: ShoppingItem[]) => void;
  onAddEvent: (title: string, start: Date, memberId: string) => void;
}

function tint(color: string, alpha: number): string {
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (!match) {
    return 'var(--hb-paper)';
  }
  const value = parseInt(match[1], 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

const Board = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 18px;
  height: calc(100vh - 124px);
  min-height: 0;
  color: var(--hb-text);
`;

const Card = styled.section`
  background: var(--hb-card);
  border: 1px solid var(--hb-line);
  border-radius: var(--hb-radius);
  box-shadow: var(--hb-shadow);
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
`;

const Schedule = styled(Card)`
  padding: 18px 20px 16px;
`;

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
`;

const Title = styled.div`
  font-size: 24px;
  font-weight: 650;
  letter-spacing: -0.02em;
  margin: 0 8px;
  flex: 1;
`;

const Round = styled.button`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid var(--hb-line);
  background: var(--hb-card);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--hb-text);

  &:active {
    background: var(--hb-paper);
  }
`;

const Ghost = styled.button`
  height: 40px;
  padding: 0 16px;
  border-radius: 999px;
  border: 1px solid var(--hb-line);
  background: var(--hb-card);
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
`;

const Segmented = styled.div`
  display: flex;
  background: var(--hb-paper);
  border-radius: 999px;
  padding: 4px;
  gap: 2px;
`;

const Segment = styled.button<{ active: boolean }>`
  height: 36px;
  min-width: 76px;
  border: none;
  border-radius: 999px;
  background: ${props => props.active ? 'var(--hb-card)' : 'transparent'};
  box-shadow: ${props => props.active ? '0 1px 3px rgba(16, 24, 40, 0.1)' : 'none'};
  color: ${props => props.active ? 'var(--hb-text)' : 'var(--hb-muted)'};
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
`;

const Filters = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  flex-wrap: wrap;
`;

const Pill = styled.button<{ active: boolean; color: string }>`
  height: 38px;
  padding: 0 14px 0 10px;
  border-radius: 999px;
  border: 1px solid ${props => props.active ? 'transparent' : 'var(--hb-line)'};
  background: ${props => props.active ? tint(props.color, 0.16) : 'var(--hb-card)'};
  color: var(--hb-text);
  font-weight: 600;
  font-size: 14px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
`;

const Dot = styled.span<{ color: string }>`
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: ${props => props.color};
  flex: none;
`;

const Forecast = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: var(--hb-muted);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: none;
  font-variant-numeric: tabular-nums;
`;

const Rain = styled.span`
  color: #4f6fb0;
  margin-left: 4px;
`;

const CellHead = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: var(--hb-muted);
`;

const TitleWeather = styled.span`
  color: var(--hb-muted);
  font-weight: 500;
  font-size: 18px;
  letter-spacing: 0;
`;

const Scroll = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
`;

const WeekdayRow = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  margin-bottom: 6px;
`;

const Weekday = styled.div<{ today?: boolean }>`
  text-align: center;
  color: ${props => props.today ? 'var(--hb-accent)' : 'var(--hb-muted)'};
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 4px 0;
`;

const MonthGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  grid-template-rows: repeat(6, minmax(84px, 1fr));
  gap: 1px;
  background: var(--hb-line);
  border: 1px solid var(--hb-line);
  border-radius: 14px;
  overflow: hidden;
  height: calc(100% - 34px);
  box-sizing: border-box;
`;

const DayCell = styled.button<{ outside: boolean }>`
  text-align: left;
  border: none;
  background: ${props => props.outside ? 'var(--hb-paper)' : 'var(--hb-card)'};
  padding: 8px;
  cursor: pointer;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 3px;
`;

const DayNumber = styled.span<{ today: boolean; outside: boolean }>`
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  background: ${props => props.today ? 'var(--hb-accent)' : 'transparent'};
  color: ${props => props.today ? 'white' : props.outside ? 'var(--hb-muted)' : 'var(--hb-text)'};
  margin-bottom: 2px;
`;

const Chip = styled.div<{ color: string }>`
  font-size: 12px;
  font-weight: 500;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  background: ${props => tint(props.color, 0.14)};
  border-radius: 6px;
  padding: 2px 6px;
  display: flex;
  align-items: center;
  gap: 5px;
`;

const More = styled.div`
  font-size: 11px;
  color: var(--hb-muted);
  padding-left: 6px;
`;

const WeekHead = styled.div`
  display: grid;
  grid-template-columns: 56px repeat(7, 1fr);
  min-width: 760px;
  position: sticky;
  top: 0;
  background: var(--hb-card);
  z-index: 2;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--hb-line);
`;

const WeekDayHead = styled.div<{ today: boolean }>`
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  color: ${props => props.today ? 'var(--hb-accent)' : 'var(--hb-muted)'};
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
`;

const WeekDayNumber = styled.span<{ today: boolean }>`
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0;
  text-transform: none;
  background: ${props => props.today ? 'var(--hb-accent)' : 'transparent'};
  color: ${props => props.today ? 'white' : 'var(--hb-text)'};
`;

const AllDayCell = styled.div`
  padding: 4px 3px 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
`;

const WeekWrap = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100%;
  min-width: 760px;
`;

const WeekBody = styled.div`
  flex: 1;
  display: grid;
  grid-template-columns: 56px repeat(7, 1fr);
  min-height: ${(HOUR_END - HOUR_START) * HOUR_PX}px;
  padding-top: 8px;
`;

const TimeColumn = styled.div`
  display: flex;
  flex-direction: column;
`;

const TimeLabel = styled.div`
  flex: 1;
  font-size: 11px;
  color: var(--hb-muted);
  text-align: right;
  padding-right: 10px;
  transform: translateY(-7px);
`;

const DayColumn = styled.div<{ today: boolean }>`
  position: relative;
  border-left: 1px solid var(--hb-line);
  background-color: ${props => props.today ? 'var(--hb-accent-soft)' : 'transparent'};
  background-image: linear-gradient(to bottom, var(--hb-line) 1px, transparent 1px);
  background-size: 100% calc(100% / ${HOUR_END - HOUR_START});
`;

const Block = styled.button<{ color: string; top: number; height: number; lane: number; lanes: number }>`
  position: absolute;
  top: calc(${props => props.top}% + 1px);
  height: calc(${props => Math.max(props.height, 4)}% - 2px);
  left: calc(${props => (props.lane / props.lanes) * 100}% + 3px);
  width: calc(${props => 100 / props.lanes}% - 6px);
  border: none;
  border-left: 3px solid ${props => props.color};
  border-radius: 8px;
  background: ${props => tint(props.color, 0.16)};
  color: var(--hb-text);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.25;
  text-align: left;
  padding: 4px 22px 4px 6px;
  overflow: hidden;
  cursor: pointer;
`;

const BlockBadge = styled.span`
  position: absolute;
  top: 4px;
  right: 4px;
  display: inline-flex;
`;

const BlockTime = styled.div`
  font-size: 11px;
  color: var(--hb-muted);
`;

const DayGroups = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  grid-auto-rows: minmax(100%, auto);
  gap: 14px;
  height: 100%;
`;

const MemberCard = styled.section<{ color: string }>`
  border-radius: 16px;
  background: ${props => tint(props.color, 0.06)};
  border: 1px solid ${props => tint(props.color, 0.18)};
  padding: 14px;
  overflow: auto;
`;

const MemberHeading = styled.h3`
  margin: 0 0 10px;
  font-size: 15px;
  font-weight: 650;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Agenda = styled.div`
  display: flex;
  gap: 12px;
  padding: 10px 12px;
  background: var(--hb-card);
  border-radius: 12px;
  margin-top: 6px;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
`;

const AgendaTime = styled.div`
  min-width: 64px;
  font-size: 13px;
  font-weight: 600;
  color: var(--hb-muted);
`;

const AgendaTitle = styled.div`
  font-size: 15px;
  font-weight: 600;
`;

const AgendaMeta = styled.div`
  font-size: 13px;
  color: var(--hb-muted);
  margin-top: 2px;
`;

const Empty = styled.div`
  color: var(--hb-muted);
  font-size: 14px;
`;

const Rail = styled.aside`
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 0;
`;

const Panel = styled(Card)`
  padding: 18px;
  flex: 1;
`;

const PanelHead = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 12px;
`;

const PanelTitle = styled.h2`
  margin: 0;
  font-size: 18px;
  font-weight: 650;
  letter-spacing: -0.01em;
`;

const Count = styled.span`
  color: var(--hb-muted);
  font-weight: 500;
  margin-left: 6px;
`;

const Link = styled.button`
  border: none;
  background: none;
  color: var(--hb-accent);
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  padding: 4px 0;
`;

const List = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
`;

const Item = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 52px;
  border-bottom: 1px solid var(--hb-line);

  &:last-child {
    border-bottom: none;
  }
`;

const Check = styled.button<{ checked: boolean; color: string }>`
  width: 28px;
  height: 28px;
  flex: none;
  border-radius: 50%;
  border: 2px solid ${props => props.checked ? props.color : tint(props.color, 0.5)};
  background: ${props => props.checked ? props.color : 'transparent'};
  color: white;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
`;

const ItemText = styled.div<{ done?: boolean }>`
  flex: 1;
  font-size: 15px;
  font-weight: 500;
  color: ${props => props.done ? 'var(--hb-muted)' : 'var(--hb-text)'};
  text-decoration: ${props => props.done ? 'line-through' : 'none'};
`;

const ItemMeta = styled.div`
  font-size: 12px;
  color: var(--hb-muted);
  font-weight: 500;
  margin-top: 1px;
`;

const Remove = styled.button`
  border: none;
  background: none;
  color: var(--hb-muted);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
`;

const AddRow = styled.form`
  display: flex;
  gap: 8px;
  margin-top: 12px;
`;

const Field = styled.input`
  flex: 1;
  min-width: 0;
  box-sizing: border-box;
  height: 44px;
  border: 1px solid transparent !important;
  border-radius: 12px;
  padding: 0 14px;
  background: var(--hb-paper) !important;

  &::placeholder {
    color: var(--hb-muted);
  }

  &:focus {
    background: var(--hb-card) !important;
    border-color: var(--hb-accent) !important;
  }
`;

const AddButton = styled.button`
  width: 44px;
  height: 44px;
  flex: none;
  border: none;
  border-radius: 12px;
  background: var(--hb-accent);
  color: white;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
`;

function memberColor(members: FamilyMember[], id?: string): string {
  if (id === HOUSEHOLD) {
    return HOUSEHOLD_COLOR;
  }
  return members.find(member => member.id === id)?.color || NEUTRAL;
}

const IMPORTED = new Set(['google', 'microsoft', 'apple']);
const isHex = (value?: string) => !!value && /^#[0-9a-f]{6}$/i.test(value);

function eventColor(event: CalendarEvent, members: FamilyMember[]): string {
  if (event.source && IMPORTED.has(event.source) && isHex(event.color)) {
    return event.color!;
  }
  if (event.familyMemberId) {
    return memberColor(members, event.familyMemberId);
  }
  return isHex(event.color) ? event.color! : NEUTRAL;
}

const Badge = styled.span<{ color: string; size: number }>`
  width: ${props => props.size}px;
  height: ${props => props.size}px;
  flex: none;
  border-radius: 50%;
  background: ${props => props.color};
  color: white;
  font-size: ${props => Math.round(props.size * 0.5)}px;
  letter-spacing: -0.02em;
  font-weight: 700;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 0 1.5px var(--hb-card);
`;

const OwnerBadge: React.FC<{ event: CalendarEvent; members: FamilyMember[]; size?: number }> = ({ event, members, size = 16 }) => {
  if (!event.familyMemberId) {
    return null;
  }
  if (event.familyMemberId === HOUSEHOLD) {
    return (
      <Badge color={HOUSEHOLD_COLOR} size={size} title="Household">
        <FiHome size={Math.round(size * 0.6)} />
      </Badge>
    );
  }
  const member = members.find(item => item.id === event.familyMemberId);
  if (!member) {
    return null;
  }
  return (
    <Badge color={member.color} size={size} title={member.name}>
      {initialsFor(member, members)}
    </Badge>
  );
};

function initialsFor(member: FamilyMember, members: FamilyMember[]): string {
  const first = (name: string) => name.trim().charAt(0).toUpperCase();
  const clash = members.some(other => other.id !== member.id && first(other.name) === first(member.name));
  if (!clash) {
    return first(member.name);
  }
  const words = member.name.trim().split(/\s+/);
  const second = words.length > 1 ? words[1].charAt(0) : member.name.trim().charAt(1);
  return (first(member.name) + second).toUpperCase();
}

function visible(event: CalendarEvent, memberId: string): boolean {
  if (!memberId) {
    return true;
  }
  if (event.familyMemberId === HOUSEHOLD) {
    return true;
  }
  return event.familyMemberId === memberId;
}

function monthCells(cursor: Date): Date[] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

function minutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function layoutTimed(events: CalendarEvent[]) {
  const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
  const lanes: CalendarEvent[][] = [];
  const placed = sorted.map(event => {
    let lane = lanes.findIndex(group => group.every(other => other.end <= event.start || event.end <= other.start));
    if (lane < 0) {
      lane = lanes.length;
      lanes.push([]);
    }
    lanes[lane].push(event);
    return { event, lane };
  });
  const laneCount = Math.max(lanes.length, 1);
  return placed.map(item => ({ ...item, lanes: laneCount }));
}

const byStart = (a: CalendarEvent, b: CalendarEvent) => a.start.getTime() - b.start.getTime();

const ScheduleBoard: React.FC<ScheduleBoardProps> = ({
  members,
  events,
  chores,
  shopping,
  forecast,
  onCompleteChore,
  onAddChore,
  onOpenChores,
  onChangeShopping,
  onAddEvent
}) => {
  const [view, setView] = useState<View>('week');
  const [cursor, setCursor] = useState(() => new Date());
  const [memberId, setMemberId] = useState('');
  const [choreTitle, setChoreTitle] = useState('');
  const [shopTitle, setShopTitle] = useState('');
  const [eventTitle, setEventTitle] = useState('');

  const shown = useMemo(
    () => events.filter(event => visible(event, memberId)),
    [events, memberId]
  );

  const dueChores = useMemo(() => {
    const config = { members, chores };
    const due = [...ChoreService.getOverdueChores(config), ...ChoreService.getDueTodayChores(config)];
    const unique = due.filter((chore, index) => due.findIndex(item => item.id === chore.id) === index);
    return unique.filter(chore => !memberId || chore.assignedTo === memberId);
  }, [chores, memberId, members]);

  const forecastByDate = useMemo(() => new Map(forecast.map(day => [day.date, day])), [forecast]);
  const forecastFor = (date: Date) => forecastByDate.get(format(date, 'yyyy-MM-dd'));
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(cursor), index));
  const remaining = shopping.filter(item => !item.checked).length;

  const shift = (delta: number) => {
    const next = new Date(cursor);
    if (view === 'month') {
      next.setMonth(next.getMonth() + delta);
    } else if (view === 'week') {
      next.setDate(next.getDate() + delta * 7);
    } else {
      next.setDate(next.getDate() + delta);
    }
    setCursor(next);
  };

  const title = view === 'month'
    ? format(cursor, 'MMMM yyyy')
    : view === 'week'
      ? `${format(weekDays[0], 'MMM d')} – ${format(weekDays[6], weekDays[0].getMonth() === weekDays[6].getMonth() ? 'd' : 'MMM d')}`
      : format(cursor, 'EEEE, MMMM d');

  const openDay = (day: Date) => {
    setCursor(day);
    setView('day');
  };

  const addChore = (event: React.FormEvent) => {
    event.preventDefault();
    if (!choreTitle.trim()) {
      return;
    }
    onAddChore(choreTitle.trim(), memberId || members[0]?.id || '');
    setChoreTitle('');
  };

  const addShop = (event: React.FormEvent) => {
    event.preventDefault();
    if (!shopTitle.trim()) {
      return;
    }
    onChangeShopping([...shopping, { id: Date.now().toString(), title: shopTitle.trim(), checked: false }]);
    setShopTitle('');
  };

  const addBoardEvent = (event: React.FormEvent) => {
    event.preventDefault();
    if (!eventTitle.trim()) {
      return;
    }
    const start = new Date(cursor);
    start.setHours(9, 0, 0, 0);
    onAddEvent(eventTitle.trim(), start, memberId || HOUSEHOLD);
    setEventTitle('');
  };

  const renderAgenda = (list: CalendarEvent[]) => list.sort(byStart).map(event => (
    <Agenda key={event.id} style={{ borderLeft: `3px solid ${eventColor(event, members)}` }}>
      <AgendaTime>{event.allDay ? 'All day' : format(event.start, 'h:mm a')}</AgendaTime>
      <div style={{ flex: 1, minWidth: 0 }}>
        <AgendaTitle>{event.title}</AgendaTitle>
        {(event.location || event.calendarName) && (
          <AgendaMeta>{[event.location, event.calendarName].filter(Boolean).join(' · ')}</AgendaMeta>
        )}
      </div>
      <OwnerBadge event={event} members={members} size={22} />
    </Agenda>
  ));

  const dayEvents = shown.filter(event => isSameDay(event.start, cursor));
  const unassigned = dayEvents.filter(event => !event.familyMemberId);

  return (
    <Board>
      <Schedule>
        <Toolbar>
          <Round onClick={() => shift(-1)} aria-label="Previous"><FiChevronLeft size={20} /></Round>
          <Round onClick={() => shift(1)} aria-label="Next"><FiChevronRight size={20} /></Round>
          <Title>
            {title}
            {view === 'day' && forecastFor(cursor) && (
              <TitleWeather>
                {' · '}
                {[describeDay(forecastFor(cursor)!.summary, forecastFor(cursor)!.rainChance), `${forecastFor(cursor)!.high}° / ${forecastFor(cursor)!.low}°`].filter(Boolean).join(', ')}
              </TitleWeather>
            )}
          </Title>
          <Ghost onClick={() => setCursor(new Date())}>Today</Ghost>
          <Segmented>
            {(['month', 'week', 'day'] as View[]).map(item => (
              <Segment key={item} active={view === item} onClick={() => setView(item)}>
                {item[0].toUpperCase() + item.slice(1)}
              </Segment>
            ))}
          </Segmented>
        </Toolbar>

        <Filters>
          <Pill active={memberId === ''} color={HOUSEHOLD_COLOR} onClick={() => setMemberId('')}>
            <Dot color="var(--hb-text)" /> Everyone
          </Pill>
          {members.map(member => (
            <Pill key={member.id} active={memberId === member.id} color={member.color} onClick={() => setMemberId(member.id)}>
              <Dot color={member.color} /> {member.name}
            </Pill>
          ))}
        </Filters>

        <Scroll>
          {view === 'month' && (
            <>
              <WeekdayRow>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <Weekday key={day}>{day}</Weekday>)}
              </WeekdayRow>
              <MonthGrid>
                {monthCells(cursor).map(day => {
                  const list = shown.filter(event => isSameDay(event.start, day)).sort(byStart);
                  const outside = day.getMonth() !== cursor.getMonth();
                  return (
                    <DayCell key={day.toISOString()} outside={outside} onClick={() => openDay(day)}>
                      <CellHead>
                        <DayNumber today={isToday(day)} outside={outside}>{day.getDate()}</DayNumber>
                        {forecastFor(day) && <WeatherIcon code={forecastFor(day)!.icon} size={22} />}
                      </CellHead>
                      {list.slice(0, 3).map(event => (
                        <Chip key={event.id} color={eventColor(event, members)}>
                          <Dot color={eventColor(event, members)} />
                          {!event.allDay && <span style={{ color: 'var(--hb-muted)' }}>{format(event.start, 'h:mm')}</span>}
                          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{event.title}</span>
                          <OwnerBadge event={event} members={members} size={14} />
                        </Chip>
                      ))}
                      {list.length > 3 && <More>+{list.length - 3} more</More>}
                    </DayCell>
                  );
                })}
              </MonthGrid>
            </>
          )}

          {view === 'week' && (
            <WeekWrap>
              <WeekHead>
                <div />
                {weekDays.map(day => (
                  <WeekDayHead key={day.toISOString()} today={isToday(day)}>
                    {format(day, 'EEE')}
                    <WeekDayNumber today={isToday(day)}>{day.getDate()}</WeekDayNumber>
                    {forecastFor(day) && (
                      <Forecast>
                        <WeatherIcon code={forecastFor(day)!.icon} size={22} />
                        {forecastFor(day)!.high}° / {forecastFor(day)!.low}°
                        {forecastFor(day)!.rainChance >= 40 && <Rain>{forecastFor(day)!.rainChance}%</Rain>}
                      </Forecast>
                    )}
                  </WeekDayHead>
                ))}
                <div />
                {weekDays.map(day => (
                  <AllDayCell key={`all-${day.toISOString()}`}>
                    {shown.filter(event => event.allDay && isSameDay(event.start, day)).map(event => (
                      <Chip key={event.id} color={eventColor(event, members)}>
                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{event.title}</span>
                        <OwnerBadge event={event} members={members} size={14} />
                      </Chip>
                    ))}
                  </AllDayCell>
                ))}
              </WeekHead>
              <WeekBody>
                <TimeColumn>
                  {Array.from({ length: HOUR_END - HOUR_START }, (_, index) => (
                    <TimeLabel key={index}>{index === 0 ? '' : format(new Date(2000, 0, 1, HOUR_START + index), 'h a')}</TimeLabel>
                  ))}
                </TimeColumn>
                {weekDays.map(day => {
                  const placed = layoutTimed(shown.filter(event => !event.allDay && isSameDay(event.start, day)));
                  const span = (HOUR_END - HOUR_START) * 60;
                  return (
                    <DayColumn key={day.toISOString()} today={isToday(day)}>
                      {placed.map(({ event, lane, lanes }) => {
                        const start = Math.max(minutes(event.start), HOUR_START * 60);
                        const end = Math.min(Math.max(minutes(event.end), start + 30), HOUR_END * 60);
                        return (
                          <Block
                            key={event.id}
                            color={eventColor(event, members)}
                            top={((start - HOUR_START * 60) / span) * 100}
                            height={((end - start) / span) * 100}
                            lane={lane}
                            lanes={lanes}
                            onClick={() => openDay(day)}
                          >
                            <BlockBadge><OwnerBadge event={event} members={members} size={16} /></BlockBadge>
                            <BlockTime>{format(event.start, 'h:mm a')}</BlockTime>
                            {event.title}
                          </Block>
                        );
                      })}
                    </DayColumn>
                  );
                })}
              </WeekBody>
            </WeekWrap>
          )}

          {view === 'day' && (
            <DayGroups>
              {(memberId ? members.filter(member => member.id === memberId) : members).map(member => {
                const mine = dayEvents.filter(event => event.familyMemberId === member.id || event.familyMemberId === HOUSEHOLD);
                return (
                  <MemberCard key={member.id} color={member.color}>
                    <MemberHeading><Dot color={member.color} />{member.name}</MemberHeading>
                    {mine.length === 0 ? <Empty>Nothing scheduled</Empty> : renderAgenda(mine)}
                  </MemberCard>
                );
              })}
              {!memberId && unassigned.length > 0 && (
                <MemberCard color={NEUTRAL}>
                  <MemberHeading><Dot color={NEUTRAL} />Unassigned</MemberHeading>
                  {renderAgenda(unassigned)}
                </MemberCard>
              )}
            </DayGroups>
          )}
        </Scroll>

        <AddRow onSubmit={addBoardEvent}>
          <Field
            placeholder={`Add an event on ${format(cursor, 'EEE, MMM d')}`}
            value={eventTitle}
            onChange={event => setEventTitle(event.target.value)}
          />
          <AddButton type="submit" aria-label="Add event"><FiPlus size={20} /></AddButton>
        </AddRow>
      </Schedule>

      <Rail>
        <Panel>
          <PanelHead>
            <PanelTitle>Today’s chores<Count>{dueChores.length || ''}</Count></PanelTitle>
            <Link type="button" onClick={onOpenChores}>Manage</Link>
          </PanelHead>
          <List>
            {dueChores.length === 0 && <Empty>All caught up.</Empty>}
            {dueChores.map(chore => {
              const color = memberColor(members, chore.assignedTo);
              const member = members.find(item => item.id === chore.assignedTo);
              return (
                <Item key={chore.id}>
                  <Check checked={false} color={color} onClick={() => onCompleteChore(chore.id)} aria-label={`Complete ${chore.title}`} />
                  <ItemText>
                    {chore.title}
                    {member && <ItemMeta>{member.name}</ItemMeta>}
                  </ItemText>
                </Item>
              );
            })}
          </List>
          <AddRow onSubmit={addChore}>
            <Field placeholder="Add a chore" value={choreTitle} onChange={event => setChoreTitle(event.target.value)} />
            <AddButton type="submit" aria-label="Add chore"><FiPlus size={20} /></AddButton>
          </AddRow>
        </Panel>

        <Panel>
          <PanelHead>
            <PanelTitle>Shopping<Count>{remaining || ''}</Count></PanelTitle>
            {shopping.some(item => item.checked) && (
              <Link type="button" onClick={() => onChangeShopping(shopping.filter(item => !item.checked))}>Clear checked</Link>
            )}
          </PanelHead>
          <List>
            {shopping.length === 0 && <Empty>Nothing on the list.</Empty>}
            {shopping.map(item => (
              <Item key={item.id}>
                <Check
                  checked={item.checked}
                  color={HOUSEHOLD_COLOR}
                  onClick={() => onChangeShopping(shopping.map(entry => entry.id === item.id ? { ...entry, checked: !entry.checked } : entry))}
                  aria-label={item.checked ? `Uncheck ${item.title}` : `Check ${item.title}`}
                >
                  {item.checked && <FiCheck size={16} />}
                </Check>
                <ItemText done={item.checked}>
                  {item.title}
                  {item.quantity && <ItemMeta>{item.quantity}</ItemMeta>}
                </ItemText>
                <Remove onClick={() => onChangeShopping(shopping.filter(entry => entry.id !== item.id))} aria-label={`Remove ${item.title}`}>
                  <FiX size={18} />
                </Remove>
              </Item>
            ))}
          </List>
          <AddRow onSubmit={addShop}>
            <Field placeholder="Add an item" value={shopTitle} onChange={event => setShopTitle(event.target.value)} />
            <AddButton type="submit" aria-label="Add shopping item"><FiPlus size={20} /></AddButton>
          </AddRow>
        </Panel>
      </Rail>
    </Board>
  );
};

export default ScheduleBoard;
