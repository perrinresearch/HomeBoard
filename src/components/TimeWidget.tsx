import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { format } from 'date-fns';

const TimeContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 12px;
  padding: 20px;
  text-align: center;
`;

const TimeDisplay = styled.div`
  font-size: 3rem;
  font-weight: 700;
  margin-bottom: 8px;
  font-family: 'Courier New', monospace;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
`;

const DateDisplay = styled.div`
  font-size: 1.2rem;
  font-weight: 500;
  opacity: 0.9;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);
`;

const TimeWidget: React.FC = () => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime12Hour = (date: Date) => {
    return format(date, 'h:mm:ss a');
  };

  const formatDate = (date: Date) => {
    return format(date, 'EEEE, MMMM do, yyyy');
  };

  return (
    <TimeContainer>
      <TimeDisplay>{formatTime12Hour(currentTime)}</TimeDisplay>
      <DateDisplay>{formatDate(currentTime)}</DateDisplay>
    </TimeContainer>
  );
};

export default TimeWidget;
