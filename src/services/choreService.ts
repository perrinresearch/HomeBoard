import { Chore, FamilyMember, ChoreConfig } from '../types';
import { addDays, addWeeks, addMonths } from 'date-fns';

export class ChoreService {
  static createDefaultChoreConfig(): ChoreConfig {
    return {
      members: [
        { id: '1', name: 'Mom', color: '#FF6B6B' },
        { id: '2', name: 'Dad', color: '#4ECDC4' },
        { id: '3', name: 'Child 1', color: '#45B7D1' },
        { id: '4', name: 'Child 2', color: '#96CEB4' }
      ],
      chores: []
    };
  }

  static addFamilyMember(config: ChoreConfig, name: string, color: string): ChoreConfig {
    const newMember: FamilyMember = {
      id: Date.now().toString(),
      name,
      color
    };

    return {
      ...config,
      members: [...config.members, newMember]
    };
  }

  static removeFamilyMember(config: ChoreConfig, memberId: string): ChoreConfig {
    return {
      ...config,
      members: config.members.filter(member => member.id !== memberId),
      chores: config.chores.filter(chore => chore.assignedTo !== memberId)
    };
  }

  static addChore(
    config: ChoreConfig,
    title: string,
    description: string,
    assignedTo: string,
    frequency: 'daily' | 'weekly' | 'monthly' | 'custom',
    frequencyValue: number = 1
  ): ChoreConfig {
    const newChore: Chore = {
      id: Date.now().toString(),
      title,
      description,
      frequency,
      frequencyValue,
      assignedTo,
      completed: false,
      nextDue: new Date()
    };

    return {
      ...config,
      chores: [...config.chores, newChore]
    };
  }

  static completeChore(config: ChoreConfig, choreId: string): ChoreConfig {
    const chore = config.chores.find(c => c.id === choreId);
    if (!chore) return config;

    const now = new Date();
    let nextDue: Date;

    switch (chore.frequency) {
      case 'daily':
        nextDue = addDays(now, chore.frequencyValue);
        break;
      case 'weekly':
        nextDue = addWeeks(now, chore.frequencyValue);
        break;
      case 'monthly':
        nextDue = addMonths(now, chore.frequencyValue);
        break;
      case 'custom':
        nextDue = addDays(now, chore.frequencyValue);
        break;
      default:
        nextDue = addWeeks(now, 1);
    }

    const updatedChore: Chore = {
      ...chore,
      completed: true,
      lastCompleted: now,
      nextDue
    };

    return {
      ...config,
      chores: config.chores.map(c => c.id === choreId ? updatedChore : c)
    };
  }

  static resetChore(config: ChoreConfig, choreId: string): ChoreConfig {
    const chore = config.chores.find(c => c.id === choreId);
    if (!chore) return config;

    const updatedChore: Chore = {
      ...chore,
      completed: false,
      lastCompleted: undefined
    };

    return {
      ...config,
      chores: config.chores.map(c => c.id === choreId ? updatedChore : c)
    };
  }

  static deleteChore(config: ChoreConfig, choreId: string): ChoreConfig {
    return {
      ...config,
      chores: config.chores.filter(chore => chore.id !== choreId)
    };
  }

  static getChoresForMember(config: ChoreConfig, memberId: string): Chore[] {
    return config.chores.filter(chore => chore.assignedTo === memberId);
  }

  static getOverdueChores(config: ChoreConfig): Chore[] {
    const now = new Date();
    return config.chores.filter(chore => 
      !chore.completed && chore.nextDue < now
    );
  }

  static getDueTodayChores(config: ChoreConfig): Chore[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return config.chores.filter(chore => 
      !chore.completed && 
      chore.nextDue >= today && 
      chore.nextDue < tomorrow
    );
  }
} 