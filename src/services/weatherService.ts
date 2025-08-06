import axios from 'axios';
import { WeatherData, WeatherLocation } from '../types';

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
} 