# Sports Widget for HomeBoard

## Overview
The Sports Widget is a comprehensive tool for tracking sports activities, schedules, and equipment for family members. It integrates seamlessly with the existing HomeBoard calendar system to display all sports events.

## Features

### 1. Family Member Management
- Add, edit, and remove family members
- Assign unique colors to each family member for easy identification
- View member statistics (number of sports, upcoming events)

### 2. Sports Management
- Add multiple sports for each family member
- Track equipment needed for each sport
- Organize sports by family member

### 3. Schedule Management
- **Practice Schedule**: Add and manage practice sessions
- **Game Schedule**: Add and manage game events
- Each event includes:
  - Date and time
  - Location
  - Equipment needed for that specific event
  - Notes and additional information
  - Event type (practice vs game)

### 4. Calendar Integration
- All sports events automatically appear in the calendar widget
- Events are color-coded (green for practice, red for games)
- Equipment lists and notes are included in calendar event descriptions
- Events show family member names and sport names

### 5. Equipment Tracking
- Track general equipment needed for each sport
- Specify equipment needed for individual events
- Equipment is displayed as tags for easy identification

## How to Use

### Adding a Sports Widget
1. Click the "Add Widget" button in HomeBoard
2. Select "Sports Tracker" from the widget options
3. The widget will appear on your dashboard

### Managing Family Members
1. Go to the "Members" tab in the Sports Widget
2. Click "Add Member" to create a new family member
3. Enter the member's name and choose a color
4. Use the edit/delete buttons to manage existing members

### Adding Sports
1. Go to the "Sports" tab in the Sports Widget
2. Click "Add Sport" to create a new sport
3. Select the family member who participates in this sport
4. Enter the sport name and list required equipment
5. Click "Add" to save the sport

### Adding Events
1. In the "Sports" tab, expand a sport section
2. Click "Add Practice" or "Add Game" in the respective section
3. Fill in the event details:
   - Event title
   - Date and time
   - Location
   - Equipment needed for this event
   - Notes (optional)
4. Click "Add" to save the event

### Viewing Schedule
1. Go to the "Schedule" tab to see upcoming events
2. Events are sorted by date and show the next 14 days
3. Each event displays:
   - Family member name
   - Sport name
   - Event type (practice/game)
   - Date, time, and location
   - Equipment needed
   - Notes

## Widget Tabs

### Sports Tab
- Overview of all sports organized by family member
- Collapsible sections for each sport
- Practice and game schedules for each sport
- Equipment lists
- Quick actions to add/edit/delete sports and events

### Schedule Tab
- Upcoming events for the next 14 days
- Comprehensive view of all sports activities
- Equipment requirements for each event
- Event details and notes

### Members Tab
- List of all family members
- Member statistics (sports count, upcoming events)
- Member management (add/edit/delete)

## Calendar Integration

Sports events automatically appear in the calendar widget with:
- **Event titles** including sport name and family member
- **Color coding**: Green for practice, red for games
- **Detailed descriptions** including equipment lists and notes
- **Location information** for each event

## Data Structure

The sports widget uses the following data structure:

```typescript
interface Sport {
  id: string;
  name: string;
  familyMemberId: string;
  equipment: string[];
  practiceSchedule: SportEvent[];
  gameSchedule: SportEvent[];
}

interface SportEvent {
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
```

## Technical Implementation

- **Service Layer**: `SportsService` handles all data operations
- **Component**: `SportsWidget` provides the user interface
- **Integration**: Sports events are converted to calendar events using `CalendarService.convertSportEventToCalendarEvent()`
- **State Management**: Integrated with the main AppState for persistence

## Future Enhancements

Potential improvements could include:
- Recurring event support
- Team management
- Statistics and analytics
- Export functionality
- Mobile notifications
- Integration with external sports apps 