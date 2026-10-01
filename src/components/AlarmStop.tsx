import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { alarmSnapshot, stopAlarm, subscribeAlarm } from '../services/alarm';

const Card = styled.div`
  position: fixed;
  z-index: 31000;
  left: 50%;
  bottom: 28px;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 16px;
  max-width: calc(100vw - 32px);
  padding: 12px 12px 12px 22px;
  border-radius: 999px;
  background: #1f2328;
  color: white;
  box-shadow: 0 12px 40px rgba(16, 24, 40, 0.28);
`;

const Name = styled.span`
  font-size: 18px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Stop = styled.button`
  min-height: 56px;
  padding: 0 22px;
  border: none;
  border-radius: 999px;
  background: white;
  color: #1f2328;
  font-size: 18px;
  font-weight: 700;
  cursor: pointer;
  flex: 0 0 auto;
`;

const AlarmStop: React.FC = () => {
  const [alarm, setAlarm] = useState(alarmSnapshot);

  useEffect(() => subscribeAlarm(() => setAlarm(alarmSnapshot())), []);

  if (!alarm.ringing) {
    return null;
  }

  return (
    <Card data-alarm-stop>
      <Name>{alarm.label}</Name>
      <Stop type="button" onClick={() => stopAlarm()}>Stop</Stop>
    </Card>
  );
};

export default AlarmStop;
