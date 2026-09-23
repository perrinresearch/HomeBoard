import React from 'react';
import styled from 'styled-components';
import { DailyForecast, WeatherData } from '../types';
import { WeatherIcon, describeDay } from './weatherIcons';

interface WeatherNowProps {
  now: WeatherData | null;
  today?: DailyForecast;
  onOpen: () => void;
}

const Wrap = styled.button`
  display: flex;
  align-items: center;
  gap: 10px;
  border: none;
  background: transparent;
  color: inherit;
  padding: 4px 8px;
  border-radius: 14px;
  cursor: pointer;
  text-align: left;

  &:active {
    background: rgba(31, 35, 40, 0.05);
  }
`;

const Icon = styled.span`
  display: inline-flex;
  opacity: 0.55;
`;

const Temp = styled.div`
  font-size: 36px;
  font-weight: 500;
  letter-spacing: -0.03em;
  line-height: 1;
  font-variant-numeric: tabular-nums;
`;

const Detail = styled.div`
  font-size: 14px;
  font-weight: 500;
  opacity: 0.6;
  line-height: 1.35;
`;

const WeatherNow: React.FC<WeatherNowProps> = ({ now, today, onOpen }) => {
  if (!now) {
    return (
      <Wrap type="button" onClick={onOpen} aria-label="Set weather location">
        <Detail>Set weather location</Detail>
      </Wrap>
    );
  }
  const summary = describeDay(now.description, 0);
  const range = today ? `H ${today.high}°  L ${today.low}°` : `Feels ${now.feelsLike}°`;
  return (
    <Wrap type="button" onClick={onOpen} aria-label="Weather location">
      <Icon><WeatherIcon code={now.icon} size={44} /></Icon>
      <Temp>{now.temperature}°</Temp>
      <Detail>
        {summary}
        <br />
        {range}
      </Detail>
    </Wrap>
  );
};

export default WeatherNow;
