import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { DragDropContext, Droppable, DropResult } from 'react-beautiful-dnd';
import { Widget, WeatherLocation, CalendarConfig, ChoreConfig, AppState } from './types';
import { WeatherService } from './services/weatherService';
import { ChoreService } from './services/choreService';
import WidgetComponent from './components/Widget';
import WeatherWidget from './components/WeatherWidget';
import CalendarWidget from './components/CalendarWidget';
import ChoreWidget from './components/ChoreWidget';
import WidgetSelector from './components/WidgetSelector';
import { FiPlus } from 'react-icons/fi';

const AppContainer = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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

const AddWidgetButton = styled.button`
  background: rgba(255, 255, 255, 0.2);
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

const WidgetGrid = styled.div<{ isDraggingOver?: boolean }>`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  min-height: 600px;
  align-items: start;
  grid-auto-rows: min-content;
  background: ${props => props.isDraggingOver ? 'rgba(255, 255, 255, 0.05)' : 'transparent'};
  border-radius: 8px;
  transition: background-color 0.2s ease;
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
    choreConfig: ChoreService.createDefaultChoreConfig()
  });

  const [showWidgetSelector, setShowWidgetSelector] = useState(false);

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

  const handleDragEnd = (result: DropResult) => {
    console.log('Drag end result:', result);
    
    if (!result.destination) {
      console.log('No destination, drag cancelled');
      return;
    }

    if (result.destination.index === result.source.index) {
      console.log('Same position, no reordering needed');
      return;
    }

    const items = Array.from(appState.widgets);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    console.log('Reordering widgets:', items.map(w => w.title));
    
    setAppState(prev => ({
      ...prev,
      widgets: items
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
          />
        );
      case 'chores':
        return (
          <ChoreWidget
            config={appState.choreConfig}
            onConfigChange={handleChoreConfigChange}
          />
        );
      default:
        return <div>Unknown widget type</div>;
    }
  };

  return (
    <AppContainer>
      <Dashboard>
        <Header>
          <Title>HomeBoard</Title>
          <AddWidgetButton onClick={() => setShowWidgetSelector(true)}>
            <FiPlus size={20} />
            Add Widget
          </AddWidgetButton>
        </Header>

        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="widgets" type="WIDGET">
            {(provided, snapshot) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                style={{ minHeight: '600px' }}
              >
                <WidgetGrid isDraggingOver={snapshot.isDraggingOver}>
                  {appState.widgets.length === 0 ? (
                    <EmptyState>
                      <EmptyStateTitle>Welcome to HomeBoard!</EmptyStateTitle>
                      <EmptyStateText>
                        Get started by adding your first widget to organize your family's daily activities.
                      </EmptyStateText>
                      <AddWidgetButton onClick={() => setShowWidgetSelector(true)}>
                        <FiPlus size={20} />
                        Add Your First Widget
                      </AddWidgetButton>
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
                      >
                        {renderWidgetContent(widget)}
                      </WidgetComponent>
                    ))
                  )}
                </WidgetGrid>
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        {showWidgetSelector && (
          <WidgetSelector
            onAddWidget={handleAddWidget}
            onClose={() => setShowWidgetSelector(false)}
          />
        )}
      </Dashboard>
    </AppContainer>
  );
};

export default App; 