import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { FiBell, FiClock, FiSettings } from 'react-icons/fi';
import { BoardReminder, BoardTimer } from '../types';
import { alertViews, announceAlert } from '../services/alerts';
import { stopAlarm } from '../services/alarm';

const Bar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  min-width: 0;
`;

const Chips = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  overflow: hidden;
`;

const Chip = styled.div<{ due: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  max-width: 240px;
  padding: 0 6px 0 14px;
  border-radius: 999px;
  background: ${props => props.due ? 'var(--hb-accent-dark)' : 'var(--hb-accent)'};
  color: white;
  border: none;
  font-size: 15px;
  font-weight: 650;
`;

const ChipLabel = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
`;

const TimeLeft = styled.span`
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: white;
  opacity: 0.92;
  flex: 0 0 auto;
`;

const Dismiss = styled.button`
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: white;
  cursor: pointer;
  font-size: 18px;
  flex: 0 0 auto;
`;

const IconButton = styled.button<{ chrome: string }>`
  width: 44px;
  height: 44px;
  padding: 0;
  border-radius: 999px;
  border: 1px solid var(--hb-line);
  background: ${props => props.chrome};
  color: var(--hb-text);
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex: 0 0 auto;
`;

const Scrim = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(31, 35, 40, 0.28);
  backdrop-filter: blur(6px);
  z-index: 1800;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
`;

const Sheet = styled.div`
  width: min(560px, 100%);
  max-height: 86vh;
  overflow: auto;
  background: var(--hb-card);
  color: var(--hb-text);
  border-radius: 24px;
  padding: 20px 22px 24px;
`;

const Title = styled.h2`
  margin: 0 0 16px;
  font-size: 22px;
`;

const Label = styled.label`
  display: block;
  margin: 12px 0 6px;
  font-size: 14px;
  font-weight: 650;
`;

const Input = styled.input`
  width: 100%;
  min-height: 52px;
  box-sizing: border-box;
  border: 1px solid var(--hb-line);
  border-radius: 12px;
  padding: 0 12px;
  font-size: 18px;
`;

const Row = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const Choice = styled.button<{ active: boolean }>`
  min-height: 48px;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid ${props => props.active ? 'var(--hb-accent)' : 'var(--hb-line)'};
  background: ${props => props.active ? 'var(--hb-accent)' : 'white'};
  color: ${props => props.active ? 'white' : 'var(--hb-text)'};
  font-weight: 700;
  cursor: pointer;
`;

const Primary = styled.button`
  min-height: 48px;
  margin-top: 14px;
  padding: 0 16px;
  border: none;
  border-radius: 12px;
  background: var(--hb-accent);
  color: white;
  font-weight: 700;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
  }
`;

const ErrorText = styled.p`
  margin: 8px 0 0;
  color: #b42318;
  font-size: 14px;
`;

interface AlertsProps {
  timers: BoardTimer[];
  reminders: BoardReminder[];
  chrome: string;
  onChange: (timers: BoardTimer[], reminders: BoardReminder[]) => void;
  onOpenSettings: () => void;
}

const Alerts: React.FC<AlertsProps> = ({ timers, reminders, chrome, onChange, onOpenSettings }) => {
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState<'timer' | 'reminder' | null>(null);
  const announced = useRef(new Set<string>());
  const views = alertViews(timers, reminders, now);

  useEffect(() => {
    if (timers.length === 0 && reminders.length === 0) {
      return undefined;
    }
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [timers.length, reminders.length]);

  useEffect(() => {
    views.filter(item => item.due).forEach(item => {
      const key = `${item.kind}:${item.id}`;
      if (announced.current.has(key)) {
        return;
      }
      announced.current.add(key);
      announceAlert(item.kind, item.id, item.label);
    });
  }, [views]);

  const remove = (kind: 'timer' | 'reminder', id: string) => {
    const stillDue = views.some(item => item.due && !(item.kind === kind && item.id === id));
    if (!stillDue) {
      stopAlarm();
    }
    if (kind === 'timer') {
      onChange(timers.filter(item => item.id !== id), reminders);
    } else {
      onChange(timers, reminders.filter(item => item.id !== id));
    }
  };

  return (
    <>
      <Bar>
        <Chips>
          {views.map(item => (
            <Chip key={`${item.kind}:${item.id}`} due={item.due}>
              <ChipLabel>{item.label}</ChipLabel>
              <TimeLeft>{item.detail}</TimeLeft>
              <Dismiss type="button" aria-label={`Dismiss ${item.label}`} onClick={() => remove(item.kind, item.id)}>×</Dismiss>
            </Chip>
          ))}
        </Chips>
        <IconButton type="button" chrome={chrome} aria-label="Timer" onClick={() => setOpen('timer')}>
          <FiClock size={20} />
        </IconButton>
        <IconButton type="button" chrome={chrome} aria-label="Reminder" onClick={() => setOpen('reminder')}>
          <FiBell size={20} />
        </IconButton>
        <IconButton type="button" chrome={chrome} aria-label="Settings" onClick={onOpenSettings}>
          <FiSettings size={20} />
        </IconButton>
      </Bar>
      {open && (
        <Scrim onClick={() => setOpen(null)}>
          <Sheet onClick={(event) => event.stopPropagation()}>
            {open === 'timer' ? (
              <TimerForm
                onClose={() => setOpen(null)}
                onAdd={(timer) => {
                  onChange([...timers, timer], reminders);
                  setOpen(null);
                }}
              />
            ) : (
              <ReminderForm
                onClose={() => setOpen(null)}
                onAdd={(reminder) => {
                  onChange(timers, [...reminders, reminder]);
                  setOpen(null);
                }}
              />
            )}
          </Sheet>
        </Scrim>
      )}
    </>
  );
};

const TimerForm: React.FC<{ onAdd: (timer: BoardTimer) => void; onClose: () => void }> = ({ onAdd }) => {
  const [label, setLabel] = useState('');
  const [hours, setHours] = useState('0');
  const [minutes, setMinutes] = useState('5');
  const total = (Number(hours) || 0) * 60 + (Number(minutes) || 0);
  return (
    <form onSubmit={(event) => {
      event.preventDefault();
      if (total < 1) {
        return;
      }
      const durationMs = total * 60 * 1000;
      onAdd({
        id: Date.now().toString(),
        label: label.trim() || 'Timer',
        durationMs,
        endsAt: Date.now() + durationMs
      });
    }}>
      <Title>Timer</Title>
      <Label htmlFor="timer-label">Name</Label>
      <Input id="timer-label" value={label} placeholder="Timer" onChange={(event) => setLabel(event.target.value)} />
      <Row>
        <div style={{ flex: 1 }}>
          <Label htmlFor="timer-hours">Hours</Label>
          <Input id="timer-hours" type="number" min={0} max={23} value={hours} onChange={(event) => setHours(event.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <Label htmlFor="timer-minutes">Minutes</Label>
          <Input id="timer-minutes" type="number" min={0} max={59} value={minutes} onChange={(event) => setMinutes(event.target.value)} />
        </div>
      </Row>
      <Primary type="submit" disabled={total < 1}>Start</Primary>
    </form>
  );
};

const ReminderForm: React.FC<{ onAdd: (reminder: BoardReminder) => void; onClose: () => void }> = ({ onAdd }) => {
  const [label, setLabel] = useState('');
  const [hour, setHour] = useState('7');
  const [minute, setMinute] = useState('0');
  const [pm, setPm] = useState(true);
  const [tomorrow, setTomorrow] = useState(false);
  const [error, setError] = useState('');

  const when = () => {
    const rawHour = Math.min(12, Math.max(1, Number(hour) || 0));
    const rawMinute = Math.min(59, Math.max(0, Number(minute) || 0));
    let hours24 = rawHour % 12;
    if (pm) {
      hours24 += 12;
    }
    const at = new Date();
    at.setSeconds(0, 0);
    at.setHours(hours24, rawMinute, 0, 0);
    if (tomorrow) {
      at.setDate(at.getDate() + 1);
    }
    return at;
  };

  return (
    <form onSubmit={(event) => {
      event.preventDefault();
      if (!label.trim()) {
        setError('Add a name for the reminder');
        return;
      }
      const at = when();
      if (at.getTime() <= Date.now()) {
        setError('That time has already passed. Choose tomorrow.');
        return;
      }
      onAdd({ id: Date.now().toString(), label: label.trim(), at: at.getTime() });
    }}>
      <Title>Reminder</Title>
      <Label htmlFor="reminder-label">Name</Label>
      <Input id="reminder-label" value={label} placeholder="Take medicine" onChange={(event) => setLabel(event.target.value)} />
      <Row>
        <div style={{ flex: 1 }}>
          <Label htmlFor="reminder-hour">Hour</Label>
          <Input id="reminder-hour" type="number" min={1} max={12} value={hour} onChange={(event) => setHour(event.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <Label htmlFor="reminder-minute">Minute</Label>
          <Input id="reminder-minute" type="number" min={0} max={59} value={minute} onChange={(event) => setMinute(event.target.value)} />
        </div>
      </Row>
      <Row style={{ marginTop: 12 }}>
        <Choice type="button" active={!pm} onClick={() => setPm(false)}>AM</Choice>
        <Choice type="button" active={pm} onClick={() => setPm(true)}>PM</Choice>
        <Choice type="button" active={!tomorrow} onClick={() => setTomorrow(false)}>Today</Choice>
        <Choice type="button" active={tomorrow} onClick={() => setTomorrow(true)}>Tomorrow</Choice>
      </Row>
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Primary type="submit">Save reminder</Primary>
    </form>
  );
};

export default Alerts;
