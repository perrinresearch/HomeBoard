export interface Widget {
  id: string;
  type: 'weather' | 'calendar' | 'chores';
  title: string;
  position?: { x: number; y: number }; // Optional since we're using grid layout
  size: { width: number; height: number };
  columnSpan: number; // Number of grid columns this widget spans (1-4)
  config: any;
}

export interface WeatherLocation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  isCurrentLocation: boolean;
}

export interface WeatherData {
  location: WeatherLocation;
  temperature: number;
  description: string;
  icon: string;
  humidity: number;
  windSpeed: number;
  feelsLike: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  description?: string;
  location?: string;
  color?: string;
}

export interface CalendarConfig {
  sources: {
    google?: string;
    apple?: string;
    outlook?: string;
  };
  events: CalendarEvent[];
}

export interface Chore {
  id: string;
  title: string;
  description?: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'custom';
  frequencyValue: number;
  assignedTo: string;
  completed: boolean;
  lastCompleted?: Date;
  nextDue: Date;
}

export interface FamilyMember {
  id: string;
  name: string;
  color: string;
}

export interface ChoreConfig {
  members: FamilyMember[];
  chores: Chore[];
}

export interface AppState {
  widgets: Widget[];
  weatherLocations: WeatherLocation[];
  calendarConfig: CalendarConfig;
  choreConfig: ChoreConfig;
} 