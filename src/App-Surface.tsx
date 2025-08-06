import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Widget, WeatherLocation, CalendarConfig, ChoreConfig, SportsConfig, AppState } from './types';
import { WeatherService } from './services/weatherService';
import { ChoreService } from './services/choreService';
import { SportsService } from './services/sportsService';
import { SettingsService } from './services/settingsService';
import WidgetComponent from './components/Widget';
import WeatherWidget from './components/WeatherWidget';
import CalendarWidget from './components/CalendarWidget';
import ChoreWidget from './components/ChoreWidget';
import SportsWidget from './components/SportsWidget';
import WidgetSelector from './components/WidgetSelector';
import Settings from './components/Settings';
import { FiPlus, FiSettings } from 'react-icons/fi';

const AppContainer = styled.div<{ background: string }>`
  min-height: 100vh;
  background: ${props => props.background};
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
`;

const Dashboard = styled.div`
  max-width: 1400px;
  margin: 0 auto;
  position: relative;
  min-height: calc(100vh - 40px);
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  color: white;
`;

const Title = styled.h1`
  margin: 0;
  font-size: 32px;
  font-weight: 700;
`;

const HeaderButton = styled.button<{ background: string }>`
  background: ${props => props.background};
  color: white;
  border: 2px solid rgba(255, 255, 255, 0.3);
  padding: 12px 20px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  transition: all 0.3s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.3);
    border-color: rgba(255, 255, 255, 0.5);
    transform: translateY(-2px);
  }
`;

const HeaderControls = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;
`;

const WidgetGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  min-height: 600px;
  align-items: start;
  grid-auto-rows: min-content;
  border-radius: 8px;
  position: relative;
  
  @media (max-width: 1200px) {
    grid-template-columns: repeat(3, 1fr);
  }
  
  @media (max-width: 900px) {
    grid-template-columns: repeat(2, 1fr);
  }
  
  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  color: white;
  padding: 60px 20px;
`;

const EmptyStateTitle = styled.h2`
  font-size: 24px;
  margin-bottom: 16px;
  opacity: 0.9;
`;

const EmptyStateText = styled.p`
  font-size: 16px;
  opacity: 0.7;
  margin-bottom: 30px;
`;

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>({
    widgets: [],
    weatherLocations: [],
    calendarConfig: {
      sources: {},
      events: []
    },
    choreConfig: ChoreService.createDefaultChoreConfig(),
    sportsConfig: SportsService.createDefaultSportsConfig(),
    settings: SettingsService.createDefaultSettings()
  });

  const [showWidgetSelector, setShowWidgetSelector] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Load initial weather location (current location)
  useEffect(() => {
    const initializeCurrentLocation = async () => {
      try {
        const coords = await WeatherService.getCurrentLocation();
        const currentLocation: WeatherLocation = {
          id: 'current',
          name: 'Current Location',
          lat: coords.lat,
          lon: coords.lon,
          isCurrentLocation: true
        };
        
        setAppState(prev => ({
          ...prev,
          weatherLocations: [currentLocation]
        }));
      } catch (error) {
        console.error('Failed to get current location:', error);
        // Fallback to a default location
        const defaultLocation: WeatherLocation = {
          id: 'default',
          name: 'New York, US',
          lat: 40.7128,
          lon: -74.0060,
          isCurrentLocation: false
        };
        
        setAppState(prev => ({
          ...prev,
          weatherLocations: [defaultLocation]
        }));
      }
    };

    initializeCurrentLocation();
  }, []);

  const handleAddWidget = (widget: Widget) => {
    setAppState(prev => ({
      ...prev,
      widgets: [...prev.widgets, widget]
    }));
  };

  const handleRemoveWidget = (widgetId: string) => {
    setAppState(prev => ({
      ...prev,
      widgets: prev.widgets.filter(w => w.id !== widgetId)
    }));
  };

  const handleResizeWidget = (widgetId: string, size: { width: number; height: number }) => {
    setAppState(prev => ({
      ...prev,
      widgets: prev.widgets.map(w => 
        w.id === widgetId ? { ...w, size } : w
      )
    }));
  };

  const handleColumnSpanChange = (widgetId: string, columnSpan: number) => {
    setAppState(prev => ({
      ...prev,
      widgets: prev.widgets.map(w => 
        w.id === widgetId ? { ...w, columnSpan } : w
      )
    }));
  };



  const handleWeatherLocationsChange = (locations: WeatherLocation[]) => {
    setAppState(prev => ({
      ...prev,
      weatherLocations: locations
    }));
  };

  const handleCalendarConfigChange = (config: CalendarConfig) => {
    setAppState(prev => ({
      ...prev,
      calendarConfig: config
    }));
  };

  const handleChoreConfigChange = (config: ChoreConfig) => {
    setAppState(prev => ({
      ...prev,
      choreConfig: config
    }));
  };

  const handleSportsConfigChange = (config: SportsConfig) => {
    setAppState(prev => ({
      ...prev,
      sportsConfig: config
    }));
  };

  const handleSettingsChange = (settings: AppState['settings']) => {
    setAppState(prev => ({
      ...prev,
      settings
    }));
  };

  const renderWidgetContent = (widget: Widget) => {
    switch (widget.type) {
      case 'weather':
        return (
          <WeatherWidget
            locations={appState.weatherLocations}
            onLocationsChange={handleWeatherLocationsChange}
          />
        );
      case 'calendar':
        return (
          <CalendarWidget
            config={appState.calendarConfig}
            onConfigChange={handleCalendarConfigChange}
            sportsConfig={appState.sportsConfig}
          />
        );
      case 'chores':
        return (
          <ChoreWidget
            config={appState.choreConfig}
            onConfigChange={handleChoreConfigChange}
          />
        );
      case 'sports':
        return (
          <SportsWidget
            config={appState.sportsConfig}
            onConfigChange={handleSportsConfigChange}
          />
        );
      default:
        return <div>Unknown widget type</div>;
    }
  };

  const backgroundCSS = SettingsService.generateCSSBackground(appState.settings.theme.background);
  const headerCSS = SettingsService.generateCSSHeader(appState.settings.theme.header);
  const widgetHeaderCSS = SettingsService.generateCSSWidgetHeader(appState.settings.theme.widgetHeader);

  return (
    <AppContainer background={backgroundCSS}>
      <Dashboard>
        <Header>
          <Title>HomeBoard</Title>
          <HeaderControls>
            <HeaderButton 
              background={headerCSS}
              onClick={() => setShowSettings(true)}
            >
              <FiSettings size={20} />
              Settings
            </HeaderButton>
            <HeaderButton 
              background={headerCSS}
              onClick={() => setShowWidgetSelector(true)}
            >
              <FiPlus size={20} />
              Add Widget
            </HeaderButton>
          </HeaderControls>
        </Header>

        <WidgetGrid>
          {appState.widgets.length === 0 ? (
            <EmptyState>
              <EmptyStateTitle>Welcome to HomeBoard!</EmptyStateTitle>
              <EmptyStateText>
                Get started by adding your first widget to organize your family's daily activities.
              </EmptyStateText>
              <HeaderButton 
                background={headerCSS}
                onClick={() => setShowWidgetSelector(true)}
              >
                <FiPlus size={20} />
                Add Your First Widget
              </HeaderButton>
            </EmptyState>
          ) : (
                                appState.widgets.map((widget, index) => (
                      <WidgetComponent
                        key={widget.id}
                        widget={widget}
                        index={index}
                        onRemove={handleRemoveWidget}
                        onResize={handleResizeWidget}
                        onColumnSpanChange={handleColumnSpanChange}
                        widgetHeaderBackground={widgetHeaderCSS}
                      >
                        {renderWidgetContent(widget)}
                      </WidgetComponent>
                    ))
          )}
        </WidgetGrid>

        {showWidgetSelector && (
          <WidgetSelector
            onAddWidget={handleAddWidget}
            onClose={() => setShowWidgetSelector(false)}
          />
        )}

        {showSettings && (
          <Settings
            settings={appState.settings}
            onSettingsChange={handleSettingsChange}
            onClose={() => setShowSettings(false)}
          />
        )}
      </Dashboard>
    </AppContainer>
  );
};

export default App; 