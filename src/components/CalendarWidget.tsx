import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import Calendar from 'react-calendar';
import { CalendarEvent, CalendarConfig } from '../types';
import { CalendarService } from '../services/calendarService';
import { FiPlus, FiSettings, FiExternalLink, FiTrash2 } from 'react-icons/fi';
import { format, isToday, isTomorrow, isYesterday } from 'date-fns';

interface CalendarWidgetProps {
  config: CalendarConfig;
  onConfigChange: (config: CalendarConfig) => void;
  sportsEvents?: CalendarEvent[];
}

const CalendarContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 16px;
`;

const CalendarHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const CalendarTitle = styled.h3`
  margin: 0;
  font-size: 16px;
  color: #333;
`;

const CalendarControls = styled.div`
  display: flex;
  gap: 8px;
`;

const ControlButton = styled.button`
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    background-color: #f0f0f0;
  }
`;

const StyledCalendar = styled(Calendar)`
  width: 100%;
  max-width: none;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 12px;
  
  .react-calendar__tile {
    padding: 8px 4px;
    background: none;
    border: none;
    text-align: center;
    cursor: pointer;
    border-radius: 4px;
    
    &:hover {
      background-color: #f0f0f0;
    }
    
    &.react-calendar__tile--active {
      background: #667eea;
      color: white;
    }
    
    &.react-calendar__tile--now {
      background: #ffeb3b;
      color: #333;
    }
  }
  
  .react-calendar__navigation {
    display: flex;
    margin-bottom: 8px;
    
    button {
      background: none;
      border: none;
      padding: 8px;
      cursor: pointer;
      border-radius: 4px;
      
      &:hover {
        background-color: #f0f0f0;
      }
    }
  }
`;

const EventsSection = styled.div`
  flex: 1;
  overflow-y: auto;
`;

const EventsTitle = styled.h4`
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #333;
`;

const EventList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const EventCard = styled.div<{ color?: string }>`
  background: ${props => props.color || '#f8f9fa'};
  border-left: 4px solid ${props => props.color || '#667eea'};
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
`;

const EventTitle = styled.div`
  font-weight: 600;
  margin-bottom: 4px;
  color: #333;
`;

const EventDetails = styled.div`
  color: #666;
  font-size: 11px;
`;

const EventTime = styled.div`
  color: #999;
  font-size: 10px;
  margin-top: 4px;
`;

const SettingsModal = styled.div<{ isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: ${props => props.isOpen ? 'flex' : 'none'};
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background: white;
  padding: 24px;
  border-radius: 12px;
  width: 90%;
  max-width: 400px;
  max-height: 80vh;
  overflow-y: auto;
`;

const ModalTitle = styled.h3`
  margin: 0 0 16px 0;
  color: #333;
`;

const FormGroup = styled.div`
  margin-bottom: 16px;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 6px;
  font-weight: 600;
  color: #333;
  font-size: 14px;
`;

const Input = styled.input`
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  
  &:focus {
    outline: none;
    border-color: #667eea;
  }
`;

const Button = styled.button`
  background: #667eea;
  color: white;
  border: none;
  padding: 10px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  margin-right: 8px;
  
  &:hover {
    background: #5a6fd8;
  }
  
  &.secondary {
    background: #6c757d;
    
    &:hover {
      background: #5a6268;
    }
  }
`;

const NoEvents = styled.div`
  text-align: center;
  color: #666;
  font-style: italic;
  padding: 20px;
`;

const CalendarWidget: React.FC<CalendarWidgetProps> = ({ config, onConfigChange, sportsEvents = [] }) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showSettings, setShowSettings] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadEvents();
  }, [config, sportsEvents]);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const allEvents: CalendarEvent[] = [];
      
      // Load events from different sources
      if (config.sources.google) {
        const googleEvents = await CalendarService.loadGoogleCalendar('demo-key', config.sources.google);
        allEvents.push(...googleEvents);
      }
      
      if (config.sources.apple) {
        const appleEvents = await CalendarService.loadAppleCalendar(config.sources.apple);
        allEvents.push(...appleEvents);
      }
      
      if (config.sources.outlook) {
        const outlookEvents = await CalendarService.loadOutlookCalendar('demo-token', config.sources.outlook);
        allEvents.push(...outlookEvents);
      }
      
      // Add local events
      allEvents.push(...config.events);
      
      // Add sports events
      allEvents.push(...sportsEvents);
      
      setEvents(allEvents);
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      const eventDate = new Date(event.start);
      return eventDate.toDateString() === date.toDateString();
    });
  };

  const getUpcomingEvents = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return events
      .filter(event => new Date(event.start) >= today)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      .slice(0, 5);
  };

  const formatEventTime = (date: Date) => {
    return format(date, 'h:mm a');
  };

  const formatEventDate = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMM d');
  };

  const handleDateChange = (date: Date) => {
    setSelectedDate(date);
  };

  const tileContent = ({ date }: { date: Date }) => {
    const dayEvents = getEventsForDate(date);
    if (dayEvents.length > 0) {
      return (
        <div style={{ fontSize: '8px', color: '#667eea', marginTop: '2px' }}>
          {dayEvents.length} event{dayEvents.length > 1 ? 's' : ''}
        </div>
      );
    }
    return null;
  };

  return (
    <CalendarContainer>
      <CalendarHeader>
        <CalendarTitle>Calendar</CalendarTitle>
        <CalendarControls>
          <ControlButton onClick={() => setShowSettings(true)}>
            <FiSettings size={14} />
          </ControlButton>
        </CalendarControls>
      </CalendarHeader>

      <StyledCalendar
        onChange={(value) => handleDateChange(value as Date)}
        value={selectedDate}
        tileContent={tileContent}
      />

      <EventsSection>
        <EventsTitle>Upcoming Events</EventsTitle>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            Loading events...
          </div>
        ) : getUpcomingEvents().length > 0 ? (
          <EventList>
            {getUpcomingEvents().map((event) => (
              <EventCard key={event.id} color={event.color}>
                <EventTitle>{event.title}</EventTitle>
                {event.location && (
                  <EventDetails>{event.location}</EventDetails>
                )}
                <EventTime>
                  {formatEventDate(new Date(event.start))} at {formatEventTime(new Date(event.start))}
                </EventTime>
              </EventCard>
            ))}
          </EventList>
        ) : (
          <NoEvents>No upcoming events</NoEvents>
        )}
      </EventsSection>

      <SettingsModal isOpen={showSettings}>
        <ModalContent>
          <ModalTitle>Calendar Settings</ModalTitle>
          
          <FormGroup>
            <Label>Google Calendar ID</Label>
            <Input
              type="text"
              placeholder="Enter Google Calendar ID"
              value={config.sources.google || ''}
              onChange={(e) => onConfigChange({
                ...config,
                sources: { ...config.sources, google: e.target.value }
              })}
            />
          </FormGroup>

          <FormGroup>
            <Label>Apple Calendar URL</Label>
            <Input
              type="text"
              placeholder="Enter Apple Calendar URL"
              value={config.sources.apple || ''}
              onChange={(e) => onConfigChange({
                ...config,
                sources: { ...config.sources, apple: e.target.value }
              })}
            />
          </FormGroup>

          <FormGroup>
            <Label>Outlook Calendar ID</Label>
            <Input
              type="text"
              placeholder="Enter Outlook Calendar ID"
              value={config.sources.outlook || ''}
              onChange={(e) => onConfigChange({
                ...config,
                sources: { ...config.sources, outlook: e.target.value }
              })}
            />
          </FormGroup>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button className="secondary" onClick={() => setShowSettings(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowSettings(false)}>
              Save
            </Button>
          </div>
        </ModalContent>
      </SettingsModal>
    </CalendarContainer>
  );
};

export default CalendarWidget; 