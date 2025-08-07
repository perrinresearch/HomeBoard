import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { WeatherData, WeatherLocation, HourlyForecast, DailyForecast } from '../types';
import { WeatherService } from '../services/weatherService';
import { FiMapPin, FiPlus, FiTrash2, FiRefreshCw, FiWind, FiThermometer, FiCloud } from 'react-icons/fi';
import { format } from 'date-fns';

interface WeatherWidgetProps {
  locations: WeatherLocation[];
  onLocationsChange: (locations: WeatherLocation[]) => void;
}

const WeatherContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  overflow-y: auto;
`;

const LocationCard = styled.div<{ isCurrent: boolean; weatherCondition?: string }>`
  background: ${props => {
    if (props.isCurrent) {
      // Weather-based gradients
      switch (props.weatherCondition) {
        case 'clear':
          return 'linear-gradient(135deg, #ff7e5f 0%, #feb47b 100%)';
        case 'clouds':
          return 'linear-gradient(135deg, #74b9ff 0%, #0984e3 100%)';
        case 'rain':
          return 'linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)';
        case 'snow':
          return 'linear-gradient(135deg, #dfe6e9 0%, #b2bec3 100%)';
        case 'thunderstorm':
          return 'linear-gradient(135deg, #2d3436 0%, #636e72 100%)';
        case 'drizzle':
          return 'linear-gradient(135deg, #74b9ff 0%, #0984e3 100%)';
        case 'mist':
        case 'fog':
          return 'linear-gradient(135deg, #b2bec3 0%, #dfe6e9 100%)';
        default:
          return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
      }
    }
    return '#f8f9fa';
  }};
  color: ${props => props.isCurrent ? 'white' : '#333'};
  padding: 16px;
  border-radius: 12px;
  border: 1px solid #e0e0e0;
  position: relative;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
  }
`;

const LocationHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
`;

const LocationName = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 16px;
`;

const LocationControls = styled.div`
  display: flex;
  gap: 6px;
`;

const ControlButton = styled.button`
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease;
  
  &:hover {
    background-color: rgba(255, 255, 255, 0.3);
  }
`;

const CurrentWeather = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
`;

const TemperatureSection = styled.div`
  text-align: center;
`;

const Temperature = styled.div`
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 4px;
`;

const WeatherDescription = styled.div`
  font-size: 14px;
  opacity: 0.9;
  text-transform: capitalize;
`;

const WeatherIcon = styled.div`
  font-size: 3rem;
  margin-right: 16px;
`;

const WeatherDetails = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 16px;
`;

const WeatherDetail = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
`;

const ForecastSection = styled.div`
  margin-top: 16px;
`;

const ForecastTitle = styled.h4`
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  opacity: 0.9;
`;

const HourlyForecastContainer = styled.div`
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 8px;
  margin-bottom: 16px;
`;

const HourlyItem = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 60px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  font-size: 12px;
`;

const DailyForecastContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const DailyItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  font-size: 14px;
`;

const DailyInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const DailyTemps = styled.div`
  display: flex;
  gap: 8px;
  font-weight: 600;
`;

const AddLocationButton = styled.button`
  background: #4CAF50;
  color: white;
  border: none;
  padding: 12px 16px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.3s ease;
  
  &:hover {
    background: #45a049;
    transform: translateY(-1px);
  }
`;

const SearchContainer = styled.div`
  position: relative;
  margin-bottom: 12px;
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  
  &:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
  }
`;

const SearchResults = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  max-height: 200px;
  overflow-y: auto;
  z-index: 10;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
`;

const SearchResult = styled.div`
  padding: 12px 16px;
  cursor: pointer;
  border-bottom: 1px solid #eee;
  font-size: 14px;
  
  &:hover {
    background: #f5f5f5;
  }
  
  &:last-child {
    border-bottom: none;
  }
`;

const LoadingSpinner = styled.div`
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const WeatherWidget: React.FC<WeatherWidgetProps> = ({ locations, onLocationsChange }) => {
  const [weatherData, setWeatherData] = useState<WeatherData[]>([]);
  const [hourlyForecasts, setHourlyForecasts] = useState<{ [key: string]: HourlyForecast[] }>({});
  const [dailyForecasts, setDailyForecasts] = useState<{ [key: string]: DailyForecast[] }>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<WeatherLocation[]>([]);
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    loadWeatherData();
  }, [locations]);

  const loadWeatherData = async () => {
    const newWeatherData: WeatherData[] = [];
    const newHourlyForecasts: { [key: string]: HourlyForecast[] } = {};
    const newDailyForecasts: { [key: string]: DailyForecast[] } = {};
    
    for (const location of locations) {
      setLoading(prev => ({ ...prev, [location.id]: true }));
      try {
        const [weather, hourly, daily] = await Promise.all([
          WeatherService.getCurrentWeather(location),
          WeatherService.getHourlyForecast(location),
          WeatherService.getDailyForecast(location)
        ]);
        
        newWeatherData.push(weather);
        newHourlyForecasts[location.id] = hourly;
        newDailyForecasts[location.id] = daily;
      } catch (error) {
        console.error(`Failed to load weather for ${location.name}:`, error);
      } finally {
        setLoading(prev => ({ ...prev, [location.id]: false }));
      }
    }
    
    setWeatherData(newWeatherData);
    setHourlyForecasts(newHourlyForecasts);
    setDailyForecasts(newDailyForecasts);
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length > 2) {
      const results = await WeatherService.searchLocation(query);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  };

  const addLocation = (location: WeatherLocation) => {
    if (locations.length >= 4) {
      alert('Maximum 4 locations allowed');
      return;
    }
    onLocationsChange([...locations, location]);
    setSearchQuery('');
    setSearchResults([]);
    setShowSearch(false);
  };

  const removeLocation = (locationId: string) => {
    onLocationsChange(locations.filter(loc => loc.id !== locationId));
  };

  const getWeatherForLocation = (locationId: string) => {
    return weatherData.find(w => w.location.id === locationId);
  };

  const getWeatherCondition = (description: string) => {
    const desc = description.toLowerCase();
    if (desc.includes('clear')) return 'clear';
    if (desc.includes('cloud')) return 'clouds';
    if (desc.includes('rain')) return 'rain';
    if (desc.includes('snow')) return 'snow';
    if (desc.includes('thunder')) return 'thunderstorm';
    if (desc.includes('drizzle')) return 'drizzle';
    if (desc.includes('mist') || desc.includes('fog')) return 'mist';
    return 'clear';
  };

  const getWeatherIcon = (iconCode: string) => {
    // Map OpenWeatherMap icon codes to emoji
    const iconMap: { [key: string]: string } = {
      '01d': '☀️', '01n': '🌙',
      '02d': '⛅', '02n': '☁️',
      '03d': '☁️', '03n': '☁️',
      '04d': '☁️', '04n': '☁️',
      '09d': '🌧️', '09n': '🌧️',
      '10d': '🌦️', '10n': '🌧️',
      '11d': '⛈️', '11n': '⛈️',
      '13d': '🌨️', '13n': '🌨️',
      '50d': '🌫️', '50n': '🌫️'
    };
    return iconMap[iconCode] || '🌤️';
  };

  return (
    <WeatherContainer>
      {showSearch && (
        <SearchContainer>
          <SearchInput
            type="text"
            placeholder="Search for a location..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
          />
          {searchResults.length > 0 && (
            <SearchResults>
              {searchResults.map((result) => (
                <SearchResult
                  key={result.id}
                  onClick={() => addLocation(result)}
                >
                  {result.name}
                </SearchResult>
              ))}
            </SearchResults>
          )}
        </SearchContainer>
      )}

      {locations.map((location) => {
        const weather = getWeatherForLocation(location.id);
        const hourly = hourlyForecasts[location.id] || [];
        const daily = dailyForecasts[location.id] || [];
        const isLoading = loading[location.id];
        const weatherCondition = weather ? getWeatherCondition(weather.description) : 'clear';
        
        return (
          <LocationCard key={location.id} isCurrent={location.isCurrentLocation} weatherCondition={weatherCondition}>
            <LocationHeader>
              <LocationName>
                <FiMapPin size={16} />
                {location.name}
                {location.isCurrentLocation && ' (Current)'}
              </LocationName>
              <LocationControls>
                {isLoading && <LoadingSpinner />}
                <ControlButton onClick={() => removeLocation(location.id)}>
                  <FiTrash2 size={14} />
                </ControlButton>
              </LocationControls>
            </LocationHeader>
            
            {weather && !isLoading ? (
              <>
                <CurrentWeather>
                  <WeatherIcon>{getWeatherIcon(weather.icon)}</WeatherIcon>
                  <TemperatureSection>
                    <Temperature>{weather.temperature}°F</Temperature>
                    <WeatherDescription>{weather.description}</WeatherDescription>
                  </TemperatureSection>
                </CurrentWeather>

                <WeatherDetails>
                  <WeatherDetail>
                    <FiThermometer size={14} />
                    <span>Feels like {weather.feelsLike}°F</span>
                  </WeatherDetail>
                  <WeatherDetail>
                    <FiCloud size={14} />
                    <span>{weather.humidity}%</span>
                  </WeatherDetail>
                  <WeatherDetail>
                    <FiWind size={14} />
                    <span>{weather.windSpeed} mph</span>
                  </WeatherDetail>
                </WeatherDetails>

                {hourly.length > 0 && (
                  <ForecastSection>
                    <ForecastTitle>Hourly Forecast</ForecastTitle>
                    <HourlyForecastContainer>
                      {hourly.slice(0, 12).map((hour, index) => (
                        <HourlyItem key={index}>
                          <div>{format(hour.time, 'h a')}</div>
                          <div style={{ fontSize: '16px' }}>{getWeatherIcon(hour.icon)}</div>
                          <div>{hour.temperature}°</div>
                        </HourlyItem>
                      ))}
                    </HourlyForecastContainer>
                  </ForecastSection>
                )}

                {daily.length > 0 && (
                  <ForecastSection>
                    <ForecastTitle>7-Day Forecast</ForecastTitle>
                    <DailyForecastContainer>
                      {daily.map((day, index) => (
                        <DailyItem key={index}>
                          <DailyInfo>
                            <div style={{ fontSize: '20px' }}>{getWeatherIcon(day.icon)}</div>
                            <div>
                              <div>{format(day.date, 'EEE')}</div>
                              <div style={{ fontSize: '12px', opacity: 0.8 }}>{day.description}</div>
                            </div>
                          </DailyInfo>
                          <DailyTemps>
                            <span>{day.high}°</span>
                            <span style={{ opacity: 0.6 }}>{day.low}°</span>
                          </DailyTemps>
                        </DailyItem>
                      ))}
                    </DailyForecastContainer>
                  </ForecastSection>
                )}
              </>
            ) : isLoading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <LoadingSpinner />
                <div style={{ marginTop: '12px', opacity: 0.8 }}>Loading weather data...</div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: 'inherit', opacity: 0.8 }}>
                Weather data unavailable
              </div>
            )}
          </LocationCard>
        );
      })}

      {!showSearch && locations.length < 4 && (
        <AddLocationButton onClick={() => setShowSearch(true)}>
          <FiPlus size={16} />
          Add Location
        </AddLocationButton>
      )}
    </WeatherContainer>
  );
};

export default WeatherWidget; 