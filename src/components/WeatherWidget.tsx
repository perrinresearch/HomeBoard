import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { WeatherData, WeatherLocation } from '../types';
import { WeatherService } from '../services/weatherService';
import { FiMapPin, FiPlus, FiTrash2, FiRefreshCw } from 'react-icons/fi';
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
`;

const CurrentTime = styled.div`
  text-align: center;
  font-size: 24px;
  font-weight: bold;
  color: #333;
  margin-bottom: 8px;
`;

const CurrentDate = styled.div`
  text-align: center;
  font-size: 14px;
  color: #666;
  margin-bottom: 16px;
`;

const LocationList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  overflow-y: auto;
`;

const LocationCard = styled.div<{ isCurrent: boolean }>`
  background: ${props => props.isCurrent ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#f8f9fa'};
  color: ${props => props.isCurrent ? 'white' : '#333'};
  padding: 12px;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
  position: relative;
`;

const LocationHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
`;

const LocationName = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  font-size: 14px;
`;

const LocationControls = styled.div`
  display: flex;
  gap: 4px;
`;

const ControlButton = styled.button`
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    background-color: rgba(0, 0, 0, 0.1);
  }
`;

const WeatherInfo = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  font-size: 12px;
`;

const WeatherDetail = styled.div`
  display: flex;
  justify-content: space-between;
`;

const Temperature = styled.div`
  font-size: 24px;
  font-weight: bold;
  text-align: center;
  margin: 8px 0;
`;

const WeatherDescription = styled.div`
  text-align: center;
  font-size: 12px;
  margin-bottom: 8px;
`;

const AddLocationButton = styled.button`
  background: #4CAF50;
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  transition: background-color 0.2s ease;
  
  &:hover {
    background: #45a049;
  }
`;

const SearchContainer = styled.div`
  position: relative;
  margin-bottom: 12px;
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 12px;
`;

const SearchResults = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #ddd;
  border-radius: 6px;
  max-height: 150px;
  overflow-y: auto;
  z-index: 10;
`;

const SearchResult = styled.div`
  padding: 8px 12px;
  cursor: pointer;
  border-bottom: 1px solid #eee;
  font-size: 12px;
  
  &:hover {
    background: #f5f5f5;
  }
  
  &:last-child {
    border-bottom: none;
  }
`;

const LoadingSpinner = styled.div`
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid #f3f3f3;
  border-top: 2px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const WeatherWidget: React.FC<WeatherWidgetProps> = ({ locations, onLocationsChange }) => {
  const [weatherData, setWeatherData] = useState<WeatherData[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<WeatherLocation[]>([]);
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadWeatherData();
  }, [locations]);

  const loadWeatherData = async () => {
    const newWeatherData: WeatherData[] = [];
    
    for (const location of locations) {
      setLoading(prev => ({ ...prev, [location.id]: true }));
      try {
        const data = await WeatherService.getCurrentWeather(location);
        newWeatherData.push(data);
      } catch (error) {
        console.error(`Failed to load weather for ${location.name}:`, error);
      } finally {
        setLoading(prev => ({ ...prev, [location.id]: false }));
      }
    }
    
    setWeatherData(newWeatherData);
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
    if (locations.length >= 6) {
      alert('Maximum 6 locations allowed');
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

  return (
    <WeatherContainer>
      <CurrentTime>{format(currentTime, 'HH:mm:ss')}</CurrentTime>
      <CurrentDate>{format(currentTime, 'EEEE, MMMM do, yyyy')}</CurrentDate>
      
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

      <LocationList>
        {locations.map((location) => {
          const weather = getWeatherForLocation(location.id);
          const isLoading = loading[location.id];
          
          return (
            <LocationCard key={location.id} isCurrent={location.isCurrentLocation}>
              <LocationHeader>
                <LocationName>
                  <FiMapPin size={12} />
                  {location.name}
                  {location.isCurrentLocation && ' (Current)'}
                </LocationName>
                <LocationControls>
                  {isLoading && <LoadingSpinner />}
                  <ControlButton onClick={() => removeLocation(location.id)}>
                    <FiTrash2 size={12} />
                  </ControlButton>
                </LocationControls>
              </LocationHeader>
              
              {weather && !isLoading ? (
                <>
                  <Temperature>{weather.temperature}°F</Temperature>
                  <WeatherDescription>{weather.description}</WeatherDescription>
                  <WeatherInfo>
                    <WeatherDetail>
                      <span>Feels like:</span>
                      <span>{weather.feelsLike}°F</span>
                    </WeatherDetail>
                    <WeatherDetail>
                      <span>Humidity:</span>
                      <span>{weather.humidity}%</span>
                    </WeatherDetail>
                    <WeatherDetail>
                      <span>Wind:</span>
                      <span>{weather.windSpeed} mph</span>
                    </WeatherDetail>
                  </WeatherInfo>
                </>
              ) : isLoading ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <LoadingSpinner />
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: '#666' }}>
                  Weather data unavailable
                </div>
              )}
            </LocationCard>
          );
        })}
      </LocationList>

      {!showSearch && locations.length < 6 && (
        <AddLocationButton onClick={() => setShowSearch(true)}>
          <FiPlus size={12} />
          Add Location
        </AddLocationButton>
      )}
    </WeatherContainer>
  );
};

export default WeatherWidget; 