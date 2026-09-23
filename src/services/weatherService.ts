import axios from 'axios';
import { DailyForecast, WeatherData, WeatherLocation } from '../types';

function localDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

interface ForecastSlot {
  dt: number;
  main: { temp_min: number; temp_max: number };
  weather: Array<{ icon: string; description: string }>;
  pop?: number;
}

const API_KEY = process.env.REACT_APP_OPENWEATHER_API_KEY || 'demo-key';
const BASE_URL = 'https://api.openweathermap.org/data/2.5';

export class WeatherService {
  static async getCurrentWeather(location: WeatherLocation): Promise<WeatherData> {
    try {
      const response = await axios.get(`${BASE_URL}/weather`, {
        params: {
          lat: location.lat,
          lon: location.lon,
          appid: API_KEY,
          units: 'imperial'
        }
      });

      const data = response.data;
      return {
        location,
        temperature: Math.round(data.main.temp),
        description: data.weather[0].description,
        icon: data.weather[0].icon,
        humidity: data.main.humidity,
        windSpeed: Math.round(data.wind.speed),
        feelsLike: Math.round(data.main.feels_like)
      };
    } catch (error) {
      console.error('Error fetching weather data:', error);
      throw new Error('Failed to fetch weather data');
    }
  }

  static async getForecast(location: WeatherLocation): Promise<DailyForecast[]> {
    const response = await axios.get(`${BASE_URL}/forecast`, {
      params: {
        lat: location.lat,
        lon: location.lon,
        appid: API_KEY,
        units: 'imperial'
      }
    });

    const byDay = new Map<string, ForecastSlot[]>();
    for (const slot of (response.data.list || []) as ForecastSlot[]) {
      const key = localDateKey(new Date(slot.dt * 1000));
      byDay.set(key, [...(byDay.get(key) || []), slot]);
    }

    return Array.from(byDay.entries()).map(([date, slots]) => {
      const midday = slots.reduce((best, slot) => {
        const distance = (s: ForecastSlot) => Math.abs(new Date(s.dt * 1000).getHours() - 13);
        return distance(slot) < distance(best) ? slot : best;
      });
      return {
        date,
        high: Math.round(Math.max(...slots.map(slot => slot.main.temp_max))),
        low: Math.round(Math.min(...slots.map(slot => slot.main.temp_min))),
        icon: midday.weather[0]?.icon || '01d',
        summary: midday.weather[0]?.description || '',
        rainChance: Math.round(Math.max(...slots.map(slot => slot.pop || 0)) * 100)
      };
    });
  }

  static async getCurrentLocation(): Promise<{ lat: number; lon: number }> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lon: position.coords.longitude
          });
        },
        (error) => {
          reject(new Error('Unable to retrieve your location'));
        }
      );
    });
  }

  static async searchLocation(query: string): Promise<WeatherLocation[]> {
    try {
      const response = await axios.get('https://api.openweathermap.org/geo/1.0/direct', {
        params: {
          q: query,
          limit: 5,
          appid: API_KEY
        }
      });

      return response.data.map((item: any, index: number) => ({
        id: `location-${index}`,
        name: `${item.name}, ${item.country}`,
        lat: item.lat,
        lon: item.lon,
        isCurrentLocation: false
      }));
    } catch (error) {
      console.error('Error searching location:', error);
      return [];
    }
  }
} 