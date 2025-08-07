import { SportsConfig, Sport, SportEvent, FamilyMember } from '../types';

export class SportsService {
  static createDefaultSportsConfig(): SportsConfig {
    return {
      members: [],
      sports: []
    };
  }

  static addFamilyMember(config: SportsConfig, member: Omit<FamilyMember, 'id'>): SportsConfig {
    const newMember: FamilyMember = {
      ...member,
      id: Date.now().toString()
    };

    return {
      ...config,
      members: [...config.members, newMember]
    };
  }

  static updateFamilyMember(config: SportsConfig, memberId: string, updates: Partial<FamilyMember>): SportsConfig {
    return {
      ...config,
      members: config.members.map(member =>
        member.id === memberId ? { ...member, ...updates } : member
      )
    };
  }

  static removeFamilyMember(config: SportsConfig, memberId: string): SportsConfig {
    return {
      ...config,
      members: config.members.filter(member => member.id !== memberId),
      sports: config.sports.filter(sport => sport.familyMemberId !== memberId)
    };
  }

  static addSport(config: SportsConfig, sport: Omit<Sport, 'id' | 'practiceSchedule' | 'gameSchedule'>): SportsConfig {
    const newSport: Sport = {
      ...sport,
      id: Date.now().toString(),
      practiceSchedule: [],
      gameSchedule: []
    };

    return {
      ...config,
      sports: [...config.sports, newSport]
    };
  }

  static updateSport(config: SportsConfig, sportId: string, updates: Partial<Sport>): SportsConfig {
    return {
      ...config,
      sports: config.sports.map(sport =>
        sport.id === sportId ? { ...sport, ...updates } : sport
      )
    };
  }

  static removeSport(config: SportsConfig, sportId: string): SportsConfig {
    return {
      ...config,
      sports: config.sports.filter(sport => sport.id !== sportId)
    };
  }

  static addSportEvent(config: SportsConfig, sportId: string, event: Omit<SportEvent, 'id'>): SportsConfig {
    const newEvent: SportEvent = {
      ...event,
      id: Date.now().toString()
    };

    return {
      ...config,
      sports: config.sports.map(sport => {
        if (sport.id === sportId) {
          if (newEvent.type === 'practice') {
            return {
              ...sport,
              practiceSchedule: [...sport.practiceSchedule, newEvent]
            };
          } else {
            return {
              ...sport,
              gameSchedule: [...sport.gameSchedule, newEvent]
            };
          }
        }
        return sport;
      })
    };
  }

  static updateSportEvent(config: SportsConfig, sportId: string, eventId: string, updates: Partial<SportEvent>): SportsConfig {
    return {
      ...config,
      sports: config.sports.map(sport => {
        if (sport.id === sportId) {
          return {
            ...sport,
            practiceSchedule: sport.practiceSchedule.map(event =>
              event.id === eventId ? { ...event, ...updates } : event
            ),
            gameSchedule: sport.gameSchedule.map(event =>
              event.id === eventId ? { ...event, ...updates } : event
            )
          };
        }
        return sport;
      })
    };
  }

  static removeSportEvent(config: SportsConfig, sportId: string, eventId: string): SportsConfig {
    return {
      ...config,
      sports: config.sports.map(sport => {
        if (sport.id === sportId) {
          return {
            ...sport,
            practiceSchedule: sport.practiceSchedule.filter(event => event.id !== eventId),
            gameSchedule: sport.gameSchedule.filter(event => event.id !== eventId)
          };
        }
        return sport;
      })
    };
  }

  static getAllSportEvents(config: SportsConfig): SportEvent[] {
    const allEvents: SportEvent[] = [];
    
    config.sports.forEach(sport => {
      allEvents.push(...sport.practiceSchedule);
      allEvents.push(...sport.gameSchedule);
    });

    return allEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  static getUpcomingEvents(config: SportsConfig, days: number = 14): SportEvent[] {
    const allEvents = this.getAllSportEvents(config);
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(now.getDate() + days);

    return allEvents.filter(event => {
      const eventDate = new Date(event.date);
      return eventDate >= now && eventDate <= futureDate;
    });
  }

  static getMemberStats(config: SportsConfig, memberId: string) {
    const memberSports = config.sports.filter(sport => sport.familyMemberId === memberId);
    const allEvents = this.getAllSportEvents(config);
    const memberEvents = allEvents.filter(event => event.familyMemberId === memberId);
    const upcomingEvents = memberEvents.filter(event => {
      const eventDate = new Date(event.date);
      return eventDate >= new Date();
    });

    return {
      sportsCount: memberSports.length,
      upcomingEventsCount: upcomingEvents.length
    };
  }

  static convertSportEventToCalendarEvent(sportEvent: SportEvent, sport: Sport, member: FamilyMember) {
    const eventDate = new Date(sportEvent.date);
    const [startHour, startMinute] = sportEvent.startTime.split(':').map(Number);
    const [endHour, endMinute] = sportEvent.endTime.split(':').map(Number);
    
    const startTime = new Date(eventDate);
    startTime.setHours(startHour, startMinute, 0, 0);
    
    const endTime = new Date(eventDate);
    endTime.setHours(endHour, endMinute, 0, 0);

    const equipmentText = sportEvent.equipment.length > 0 
      ? `\nEquipment: ${sportEvent.equipment.join(', ')}` 
      : '';
    
    const notesText = sportEvent.notes ? `\nNotes: ${sportEvent.notes}` : '';

    return {
      id: sportEvent.id,
      title: `${sport.name} - ${member.name} (${sportEvent.type})`,
      start: startTime,
      end: endTime,
      description: `Location: ${sportEvent.location}${equipmentText}${notesText}`,
      location: sportEvent.location,
      color: sportEvent.type === 'practice' ? '#4CAF50' : '#F44336'
    };
  }
} 