export interface Widget {
  id: string;
  type: 'weather' | 'time' | 'calendar' | 'chores' | 'sports';
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

export interface HourlyForecast {
  time: Date;
  temperature: number;
  description: string;
  icon: string;
  humidity: number;
  windSpeed: number;
}

export interface DailyForecast {
  date: Date;
  high: number;
  low: number;
  description: string;
  icon: string;
  humidity: number;
  windSpeed: number;
  precipitation: number;
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

export interface Sport {
  id: string;
  name: string;
  familyMemberId: string;
  equipment: string[];
  practiceSchedule: SportEvent[];
  gameSchedule: SportEvent[];
}

export interface SportEvent {
  id: string;
  title: string;
  date: Date;
  startTime: string;
  endTime: string;
  location: string;
  type: 'practice' | 'game';
  sportId: string;
  familyMemberId: string;
  equipment: string[];
  notes?: string;
}

export interface SportsConfig {
  members: FamilyMember[];
  sports: Sport[];
}

export interface ThemeConfig {
  background: {
    type: 'color' | 'gradient' | 'image';
    color?: string;
    gradient?: {
      direction: 'to right' | 'to bottom' | 'to bottom right' | 'to bottom left' | 'to top' | 'to top right' | 'to top left' | 'to left';
      colors: string[];
    };
    image?: {
      url: string;
      opacity: number;
    };
  };
  header: {
    type: 'color' | 'gradient';
    color?: string;
    gradient?: {
      direction: 'to right' | 'to bottom' | 'to bottom right' | 'to bottom left' | 'to top' | 'to top right' | 'to top left' | 'to left';
      colors: string[];
    };
  };
  widgetHeader: {
    type: 'color' | 'gradient';
    color?: string;
    gradient?: {
      direction: 'to right' | 'to bottom' | 'to bottom right' | 'to bottom left' | 'to top' | 'to top right' | 'to top left' | 'to left';
      colors: string[];
    };
  };
}

export interface AppSettings {
  theme: ThemeConfig;
}

export interface AppState {
  widgets: Widget[];
  weatherLocations: WeatherLocation[];
  calendarConfig: CalendarConfig;
  choreConfig: ChoreConfig;
  sportsConfig: SportsConfig;
  settings: AppSettings;
} 