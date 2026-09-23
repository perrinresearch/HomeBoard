import React from 'react';
import {
  WiCloud,
  WiCloudy,
  WiDayCloudy,
  WiDayRain,
  WiDaySunny,
  WiFog,
  WiNightAltCloudy,
  WiNightAltRain,
  WiNightClear,
  WiRain,
  WiShowers,
  WiSnow,
  WiThunderstorm
} from 'react-icons/wi';

type IconComponent = React.ComponentType<{ size?: number | string; color?: string; style?: React.CSSProperties }>;

// OpenWeather condition codes: https://openweathermap.org/weather-conditions
const ICONS: Record<string, IconComponent> = {
  '01d': WiDaySunny,
  '01n': WiNightClear,
  '02d': WiDayCloudy,
  '02n': WiNightAltCloudy,
  '03d': WiCloud,
  '03n': WiCloud,
  '04d': WiCloudy,
  '04n': WiCloudy,
  '09d': WiShowers,
  '09n': WiShowers,
  '10d': WiDayRain,
  '10n': WiNightAltRain,
  '11d': WiThunderstorm,
  '11n': WiThunderstorm,
  '13d': WiSnow,
  '13n': WiSnow,
  '50d': WiFog,
  '50n': WiFog
};

export const WeatherIcon: React.FC<{ code: string; size?: number; style?: React.CSSProperties }> = ({ code, size = 24, style }) => {
  const Icon = ICONS[code] || WiRain;
  return <Icon size={size} color="currentColor" style={{ flex: 'none', ...style }} />;
};

export function describeDay(summary: string, rainChance: number): string {
  if (rainChance >= 60) {
    return 'Rain likely';
  }
  if (!summary) {
    return '';
  }
  return summary.charAt(0).toUpperCase() + summary.slice(1);
}
