# HomeBoard - Family Organization Dashboard

HomeBoard is a modern, modular web application designed to help families organize their daily activities, track chores, manage calendars, and stay informed about weather conditions across multiple locations.

## Features

### 🌤️ Weather & Time Widget
- **Real-time weather data** for current location and up to 5 additional locations
- **Current date and time** display with live updates
- **Weather details** including temperature, humidity, wind speed, and "feels like" temperature
- **Location search** with autocomplete functionality
- **Integration with OpenWeatherMap API**

### 📅 Calendar Widget
- **Interactive calendar view** with event indicators
- **External calendar integration**:
  - Google Calendar
  - Apple Calendar (iCal)
  - Microsoft Outlook Calendar
- **Event management** with upcoming events display
- **Customizable calendar sources**

### 🏠 Family Chores Widget
- **Family member management** with color-coded assignments
- **Chore tracking** with completion status
- **Frequency-based scheduling** (daily, weekly, monthly, custom)
- **Overdue and today's chores** filtering
- **Automatic chore regeneration** based on frequency settings

### 🎨 Modular Dashboard
- **Drag-and-drop widget positioning** (planned feature)
- **Resizable widgets** with expand/shrink controls
- **Customizable layout** with multiple widget types
- **Responsive design** for desktop and tablet use

## Technology Stack

- **Frontend**: React 18 with TypeScript
- **Styling**: Styled Components
- **Icons**: React Icons (Feather Icons)
- **Date handling**: date-fns
- **HTTP requests**: Axios
- **Calendar**: react-calendar
- **Weather API**: OpenWeatherMap

## Getting Started

### Prerequisites

- Node.js (version 16 or higher)
- npm or yarn package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd HomeBoard
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```env
   REACT_APP_OPENWEATHER_API_KEY=your_openweather_api_key_here
   ```

4. **Get an OpenWeatherMap API key**
   - Visit [OpenWeatherMap](https://openweathermap.org/api)
   - Sign up for a free account
   - Get your API key from the dashboard
   - Add it to your `.env` file

5. **Start the development server**
   ```bash
   npm start
   ```

6. **Open your browser**
   Navigate to `http://localhost:3000`

## Usage

### Adding Widgets
1. Click the "Add Widget" button in the header
2. Select from available widget types:
   - Weather & Time
   - Calendar
   - Family Chores
3. Widgets will be added to your dashboard

### Weather Widget
1. **Add locations**: Click "Add Location" and search for cities
2. **View weather**: Current weather data is displayed for each location
3. **Remove locations**: Click the trash icon next to any location
4. **Maximum 6 locations** can be added

### Calendar Widget
1. **Configure sources**: Click the settings icon to add calendar sources
2. **Add calendar IDs/URLs** for Google, Apple, or Outlook calendars
3. **View events**: Upcoming events are displayed below the calendar
4. **Navigate**: Use the calendar navigation to view different months

### Chores Widget
1. **Add family members**: Use the settings to manage family members
2. **Create chores**: Click "Add Chore" to create new tasks
3. **Assign chores**: Select family members for each chore
4. **Set frequency**: Choose how often chores should repeat
5. **Complete chores**: Click the checkmark to mark chores as done
6. **Filter view**: Use tabs to view all, overdue, or today's chores

### Widget Management
- **Resize widgets**: Use the expand/shrink buttons in widget headers
- **Remove widgets**: Click the X button in widget headers
- **Reposition widgets**: Drag widgets to new positions (planned feature)

## API Integration

### Weather API
The application uses OpenWeatherMap API for weather data:
- **Current weather**: Real-time temperature and conditions
- **Geocoding**: Location search and coordinates
- **Free tier**: 1000 requests per day

### Calendar APIs
The application supports integration with:
- **Google Calendar API**: Requires API key and calendar ID
- **Apple Calendar**: iCal format URLs
- **Microsoft Graph API**: For Outlook calendar integration

## Project Structure

```
src/
├── components/          # React components
│   ├── Widget.tsx      # Base widget component
│   ├── WeatherWidget.tsx
│   ├── CalendarWidget.tsx
│   ├── ChoreWidget.tsx
│   └── WidgetSelector.tsx
├── services/           # API and business logic
│   ├── weatherService.ts
│   ├── calendarService.ts
│   └── choreService.ts
├── types/              # TypeScript type definitions
│   └── index.ts
├── App.tsx             # Main application component
└── index.tsx           # Application entry point
```

## Customization

### Adding New Widget Types
1. Define the widget type in `src/types/index.ts`
2. Create a new widget component in `src/components/`
3. Add the widget to the `widgetTypes` array in `WidgetSelector.tsx`
4. Update the `renderWidgetContent` function in `App.tsx`

### Styling
The application uses Styled Components for styling. You can customize:
- Colors and themes in individual components
- Layout and spacing in the main App component
- Widget appearance in the base Widget component

## Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review the code comments

## Roadmap

- [ ] Drag-and-drop widget positioning
- [ ] Data persistence (localStorage/backend)
- [ ] User authentication
- [ ] Mobile app version
- [ ] Additional widget types
- [ ] Theme customization
- [ ] Export/import functionality
- [ ] Notifications system 