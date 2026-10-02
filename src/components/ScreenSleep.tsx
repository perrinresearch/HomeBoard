import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { BoardReminder, BoardTimer } from '../types';
import { alertViews } from '../services/alerts';
import { subscribeWake, wakeScreen } from '../services/screenWake';
import { subscribeVoice, voiceSnapshot } from '../services/voiceListen';

export { wakeScreen } from '../services/screenWake';

const Sleep = styled.button`
  position: fixed;
  inset: 0;
  z-index: 30000;
  margin: 0;
  padding: 24px;
  border: none;
  background: #05060a;
  color: #f4f1ea;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font: inherit;
`;

const Time = styled.div`
  font-size: clamp(72px, 14vw, 180px);
  font-weight: 600;
  letter-spacing: -0.045em;
  line-height: 0.95;
  font-variant-numeric: tabular-nums;
`;

const DateLine = styled.div`
  margin-top: 18px;
  font-size: clamp(22px, 3vw, 42px);
  font-weight: 500;
  opacity: 0.72;
`;

const Alerts = styled.div`
  margin-top: 36px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  width: min(640px, 100%);
`;

const AlertLine = styled.div<{ due: boolean }>`
  font-size: clamp(20px, 3vw, 32px);
  font-weight: 600;
  color: ${props => props.due ? '#f0c9a0' : '#f4f1ea'};
  opacity: ${props => props.due ? 1 : 0.8};
`;

interface ScreenSleepProps {
  timeoutMinutes: number;
  timers: BoardTimer[];
  reminders: BoardReminder[];
}

const ScreenSleep: React.FC<ScreenSleepProps> = ({ timeoutMinutes, timers, reminders }) => {
  const [asleep, setAsleep] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (timeoutMinutes <= 0) {
      setAsleep(false);
      return undefined;
    }
    let timer = 0;
    const arm = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setAsleep(true), timeoutMinutes * 60 * 1000);
    };
    const wake = (event?: Event) => {
      if (event?.target instanceof Element && event.target.closest('[data-alarm-stop]')) {
        return;
      }
      setAsleep(false);
      arm();
    };
    arm();
    window.addEventListener('pointerdown', wake, true);
    window.addEventListener('keydown', wake, true);
    const unsubWake = subscribeWake(() => wake());
    const unsubVoice = subscribeVoice(() => {
      const voice = voiceSnapshot();
      if (voice.woke || voice.listening) {
        wake();
      }
    });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointerdown', wake, true);
      window.removeEventListener('keydown', wake, true);
      unsubWake();
      unsubVoice();
    };
  }, [timeoutMinutes]);

  useEffect(() => {
    const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } };
    let lock: { release: () => Promise<void> } | null = null;
    const request = () => {
      void nav.wakeLock?.request('screen').then(next => {
        lock = next;
      }).catch(() => undefined);
    };
    request();
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        request();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      void lock?.release();
    };
  }, []);

  useEffect(() => {
    if (!asleep) {
      return undefined;
    }
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, [asleep]);

  if (!asleep) {
    return null;
  }

  const views = alertViews(timers, reminders, now.getTime());

  return (
    <Sleep type="button" aria-label="Screen is asleep. Touch or say HomeBoard to wake." onClick={() => wakeScreen()}>
      <Time>{now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Time>
      <DateLine>{now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</DateLine>
      {views.length > 0 && (
        <Alerts>
          {views.map(item => (
            <AlertLine key={`${item.kind}:${item.id}`} due={item.due}>
              {item.label} · {item.detail}
            </AlertLine>
          ))}
        </Alerts>
      )}
    </Sleep>
  );
};

export default ScreenSleep;
