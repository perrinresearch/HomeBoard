import axios from 'axios';
import { WeatherData, WeatherLocation, HourlyForecast, DailyForecast } from '../types';

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
      const response = await axios.get('http://api.openweathermap.org/geo/1.0/direct', {
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

  static async getHourlyForecast(location: WeatherLocation): Promise<HourlyForecast[]> {
    try {
      const response = await axios.get(`${BASE_URL}/forecast`, {
        params: {
          lat: location.lat,
          lon: location.lon,
          appid: API_KEY,
          units: 'imperial'
        }
      });

      return response.data.list.slice(0, 24).map((item: any) => ({
        time: new Date(item.dt * 1000),
        temperature: Math.round(item.main.temp),
        description: item.weather[0].description,
        icon: item.weather[0].icon,
        humidity: item.main.humidity,
        windSpeed: Math.round(item.wind.speed)
      }));
    } catch (error) {
      console.error('Error fetching hourly forecast:', error);
      return [];
    }
  }

  static async getDailyForecast(location: WeatherLocation): Promise<DailyForecast[]> {
    try {
      const response = await axios.get(`${BASE_URL}/forecast`, {
        params: {
          lat: location.lat,
          lon: location.lon,
          appid: API_KEY,
          units: 'imperial'
        }
      });

      // Group by day and get daily data
      const dailyData = response.data.list.reduce((acc: any, item: any) => {
        const date = new Date(item.dt * 1000);
        const dayKey = date.toDateString();
        
        if (!acc[dayKey]) {
          acc[dayKey] = {
            date,
            temps: [],
            descriptions: [],
            icons: [],
            humidities: [],
            windSpeeds: [],
            precipitations: []
          };
        }
        
        acc[dayKey].temps.push(item.main.temp);
        acc[dayKey].descriptions.push(item.weather[0].description);
        acc[dayKey].icons.push(item.weather[0].icon);
        acc[dayKey].humidities.push(item.main.humidity);
        acc[dayKey].windSpeeds.push(item.wind.speed);
        acc[dayKey].precipitations.push(item.pop * 100); // Convert to percentage
        
        return acc;
      }, {});

      return Object.values(dailyData).slice(0, 7).map((day: any) => ({
        date: day.date,
        high: Math.round(Math.max(...day.temps)),
        low: Math.round(Math.min(...day.temps)),
        description: day.descriptions[Math.floor(day.descriptions.length / 2)], // Use middle of day
        icon: day.icons[Math.floor(day.icons.length / 2)],
        humidity: Math.round(day.humidities.reduce((a: number, b: number) => a + b, 0) / day.humidities.length),
        windSpeed: Math.round(day.windSpeeds.reduce((a: number, b: number) => a + b, 0) / day.windSpeeds.length),
        precipitation: Math.round(Math.max(...day.precipitations))
      }));
    } catch (error) {
      console.error('Error fetching daily forecast:', error);
      return [];
    }
  }
} 