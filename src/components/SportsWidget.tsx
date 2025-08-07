import React, { useState } from 'react';
import styled from 'styled-components';
import { SportsConfig, Sport, SportEvent, FamilyMember } from '../types';
import { SportsService } from '../services/sportsService';
import { FiUsers, FiCalendar, FiActivity, FiPlus, FiEdit2, FiTrash2, FiChevronDown, FiChevronRight } from 'react-icons/fi';

interface SportsWidgetProps {
  config: SportsConfig;
  onConfigChange: (config: SportsConfig) => void;
}

const WidgetContainer = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  overflow: hidden;
`;

const Header = styled.div`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const HeaderTitle = styled.h3`
  margin: 0;
  font-size: 18px;
  font-weight: 600;
`;

const TabContainer = styled.div`
  display: flex;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
`;

const Tab = styled.button<{ active: boolean }>`
  flex: 1;
  padding: 12px 16px;
  background: ${props => props.active ? 'white' : 'transparent'};
  border: none;
  border-bottom: 2px solid ${props => props.active ? '#667eea' : 'transparent'};
  color: ${props => props.active ? '#667eea' : '#6c757d'};
  font-weight: ${props => props.active ? '600' : '500'};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s ease;

  &:hover {
    background: ${props => props.active ? 'white' : '#e9ecef'};
  }
`;

const Content = styled.div`
  flex: 1;
  padding: 20px;
  overflow-y: auto;
`;

const Section = styled.div`
  margin-bottom: 24px;
`;

const SectionTitle = styled.h4`
  margin: 0 0 16px 0;
  color: #333;
  font-size: 16px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Button = styled.button`
  background: #667eea;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: background-color 0.2s ease;

  &:hover {
    background: #5a6fd8;
  }

  &.secondary {
    background: #6c757d;
    
    &:hover {
      background: #5a6268;
    }
  }

  &.danger {
    background: #dc3545;
    
    &:hover {
      background: #c82333;
    }
  }
`;

const Card = styled.div`
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
`;

const MemberCard = styled(Card)`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const MemberInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const MemberColor = styled.div<{ color: string }>`
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: ${props => props.color};
`;

const MemberStats = styled.div`
  font-size: 12px;
  color: #6c757d;
`;

const SportCard = styled(Card)`
  border-left: 4px solid #667eea;
`;

const SportHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
`;

const SportTitle = styled.div`
  font-weight: 600;
  color: #333;
`;

const SportMember = styled.div`
  font-size: 14px;
  color: #6c757d;
`;

const EquipmentTags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
`;

const EquipmentTag = styled.span`
  background: #e9ecef;
  color: #495057;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
`;

const EventSection = styled.div`
  margin-top: 12px;
`;

const EventHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
`;

const EventTitle = styled.div`
  font-weight: 600;
  color: #333;
  font-size: 14px;
`;

const EventList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const EventItem = styled.div`
  background: #f8f9fa;
  border-radius: 6px;
  padding: 12px;
  border-left: 3px solid #28a745;
`;

const GameEventItem = styled(EventItem)`
  border-left-color: #dc3545;
`;

const EventDetails = styled.div`
  font-size: 13px;
  color: #6c757d;
  margin-top: 4px;
`;

const EventEquipment = styled.div`
  font-size: 12px;
  color: #6c757d;
  margin-top: 4px;
  font-style: italic;
`;

const Modal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background: white;
  padding: 24px;
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  overflow-y: auto;
`;

const ModalTitle = styled.h3`
  margin: 0 0 20px 0;
  color: #333;
`;

const FormGroup = styled.div`
  margin-bottom: 16px;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: #333;
`;

const Input = styled.input`
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 6px;
  font-size: 14px;

  &:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.25);
  }
`;

const Textarea = styled.textarea`
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 6px;
  font-size: 14px;
  resize: vertical;
  min-height: 80px;

  &:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.25);
  }
`;

const Select = styled.select`
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 6px;
  font-size: 14px;

  &:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.25);
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
`;

const EmptyState = styled.div`
  text-align: center;
  color: #6c757d;
  padding: 40px 20px;
`;

const EmptyStateText = styled.p`
  margin: 0;
  font-size: 14px;
`;

const CollapsibleHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 8px 0;
`;

const CollapsibleContent = styled.div<{ isOpen: boolean }>`
  display: ${props => props.isOpen ? 'block' : 'none'};
  margin-left: 20px;
`;

type TabType = 'sports' | 'schedule' | 'members';

const SportsWidget: React.FC<SportsWidgetProps> = ({ config, onConfigChange }) => {
  const [activeTab, setActiveTab] = useState<TabType>('sports');
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showAddSportModal, setShowAddSportModal] = useState(false);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [editingSport, setEditingSport] = useState<Sport | null>(null);
  const [selectedSportForEvent, setSelectedSportForEvent] = useState<Sport | null>(null);
  const [collapsedSports, setCollapsedSports] = useState<Set<string>>(new Set());

  // Form states
  const [memberForm, setMemberForm] = useState({ name: '', color: '#667eea' });
  const [sportForm, setSportForm] = useState({ 
    name: '', 
    familyMemberId: '', 
    equipment: '' 
  });
  const [eventForm, setEventForm] = useState({
    title: '',
    date: '',
    startTime: '',
    endTime: '',
    location: '',
    type: 'practice' as 'practice' | 'game',
    equipment: '',
    notes: ''
  });

  const toggleSportCollapse = (sportId: string) => {
    const newCollapsed = new Set(collapsedSports);
    if (newCollapsed.has(sportId)) {
      newCollapsed.delete(sportId);
    } else {
      newCollapsed.add(sportId);
    }
    setCollapsedSports(newCollapsed);
  };

  const handleAddMember = () => {
    if (memberForm.name.trim()) {
      const newConfig = SportsService.addFamilyMember(config, {
        name: memberForm.name.trim(),
        color: memberForm.color
      });
      onConfigChange(newConfig);
      setMemberForm({ name: '', color: '#667eea' });
      setShowAddMemberModal(false);
    }
  };

  const handleUpdateMember = () => {
    if (editingMember && memberForm.name.trim()) {
      const newConfig = SportsService.updateFamilyMember(config, editingMember.id, {
        name: memberForm.name.trim(),
        color: memberForm.color
      });
      onConfigChange(newConfig);
      setMemberForm({ name: '', color: '#667eea' });
      setEditingMember(null);
      setShowAddMemberModal(false);
    }
  };

  const handleDeleteMember = (memberId: string) => {
    if (window.confirm('Are you sure you want to delete this family member? This will also remove all their sports.')) {
      const newConfig = SportsService.removeFamilyMember(config, memberId);
      onConfigChange(newConfig);
    }
  };

  const handleAddSport = () => {
    if (sportForm.name.trim() && sportForm.familyMemberId) {
      const equipment = sportForm.equipment.trim() 
        ? sportForm.equipment.split(',').map(item => item.trim()).filter(Boolean)
        : [];

      const newConfig = SportsService.addSport(config, {
        name: sportForm.name.trim(),
        familyMemberId: sportForm.familyMemberId,
        equipment
      });
      onConfigChange(newConfig);
      setSportForm({ name: '', familyMemberId: '', equipment: '' });
      setShowAddSportModal(false);
    }
  };

  const handleUpdateSport = () => {
    if (editingSport && sportForm.name.trim() && sportForm.familyMemberId) {
      const equipment = sportForm.equipment.trim() 
        ? sportForm.equipment.split(',').map(item => item.trim()).filter(Boolean)
        : [];

      const newConfig = SportsService.updateSport(config, editingSport.id, {
        name: sportForm.name.trim(),
        familyMemberId: sportForm.familyMemberId,
        equipment
      });
      onConfigChange(newConfig);
      setSportForm({ name: '', familyMemberId: '', equipment: '' });
      setEditingSport(null);
      setShowAddSportModal(false);
    }
  };

  const handleDeleteSport = (sportId: string) => {
    if (window.confirm('Are you sure you want to delete this sport? This will also remove all its events.')) {
      const newConfig = SportsService.removeSport(config, sportId);
      onConfigChange(newConfig);
    }
  };

  const handleAddEvent = () => {
    if (selectedSportForEvent && eventForm.title.trim() && eventForm.date && eventForm.startTime && eventForm.endTime && eventForm.location) {
      const equipment = eventForm.equipment.trim() 
        ? eventForm.equipment.split(',').map(item => item.trim()).filter(Boolean)
        : [];

      const newConfig = SportsService.addSportEvent(config, selectedSportForEvent.id, {
        title: eventForm.title.trim(),
        date: new Date(eventForm.date),
        startTime: eventForm.startTime,
        endTime: eventForm.endTime,
        location: eventForm.location,
        type: eventForm.type,
        sportId: selectedSportForEvent.id,
        familyMemberId: selectedSportForEvent.familyMemberId,
        equipment,
        notes: eventForm.notes.trim() || undefined
      });
      onConfigChange(newConfig);
      setEventForm({
        title: '',
        date: '',
        startTime: '',
        endTime: '',
        location: '',
        type: 'practice',
        equipment: '',
        notes: ''
      });
      setSelectedSportForEvent(null);
      setShowAddEventModal(false);
    }
  };

  const handleDeleteEvent = (sportId: string, eventId: string) => {
    if (window.confirm('Are you sure you want to delete this event?')) {
      const newConfig = SportsService.removeSportEvent(config, sportId, eventId);
      onConfigChange(newConfig);
    }
  };

  const openEditMemberModal = (member: FamilyMember) => {
    setEditingMember(member);
    setMemberForm({ name: member.name, color: member.color });
    setShowAddMemberModal(true);
  };

  const openEditSportModal = (sport: Sport) => {
    setEditingSport(sport);
    setSportForm({ 
      name: sport.name, 
      familyMemberId: sport.familyMemberId, 
      equipment: sport.equipment.join(', ') 
    });
    setShowAddSportModal(true);
  };

  const openAddEventModal = (sport: Sport) => {
    setSelectedSportForEvent(sport);
    setShowAddEventModal(true);
  };

  const upcomingEvents = SportsService.getUpcomingEvents(config);

  const renderSportsTab = () => (
    <Content>
      <Section>
        <SectionTitle>
          <FiActivity />
          Sports Overview
          <Button onClick={() => setShowAddSportModal(true)}>
            <FiPlus />
            Add Sport
          </Button>
        </SectionTitle>
        
        {config.sports.length === 0 ? (
          <EmptyState>
            <EmptyStateText>No sports added yet. Add your first sport to get started!</EmptyStateText>
          </EmptyState>
        ) : (
          config.sports.map(sport => {
            const member = config.members.find(m => m.id === sport.familyMemberId);
            const isCollapsed = collapsedSports.has(sport.id);
            
            return (
              <SportCard key={sport.id}>
                <SportHeader>
                  <div>
                    <SportTitle>{sport.name}</SportTitle>
                    <SportMember>{member?.name}</SportMember>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Button 
                       
                      onClick={() => toggleSportCollapse(sport.id)}
                    >
                      {isCollapsed ? <FiChevronRight /> : <FiChevronDown />}
                    </Button>
                    <Button 
                       
                      className="secondary"
                      onClick={() => openEditSportModal(sport)}
                    >
                      <FiEdit2 />
                    </Button>
                    <Button 
                       
                      className="danger"
                      onClick={() => handleDeleteSport(sport.id)}
                    >
                      <FiTrash2 />
                    </Button>
                  </div>
                </SportHeader>
                
                {sport.equipment.length > 0 && (
                  <EquipmentTags>
                    {sport.equipment.map((item, index) => (
                      <EquipmentTag key={index}>{item}</EquipmentTag>
                    ))}
                  </EquipmentTags>
                )}
                
                <CollapsibleContent isOpen={!isCollapsed}>
                  <EventSection>
                    <EventHeader>
                      <EventTitle>Practice Schedule</EventTitle>
                      <Button onClick={() => openAddEventModal(sport)}>
                        <FiPlus />
                        Add Practice
                      </Button>
                    </EventHeader>
                    <EventList>
                      {sport.practiceSchedule.map(event => (
                        <EventItem key={event.id}>
                          <div><strong>{event.title}</strong></div>
                          <EventDetails>
                            {new Date(event.date).toLocaleDateString()} • {event.startTime} - {event.endTime} • {event.location}
                          </EventDetails>
                          {event.equipment.length > 0 && (
                            <EventEquipment>
                              Equipment: {event.equipment.join(', ')}
                            </EventEquipment>
                          )}
                          {event.notes && (
                            <EventDetails>Notes: {event.notes}</EventDetails>
                          )}
                          <Button 
                             
                            className="danger"
                            onClick={() => handleDeleteEvent(sport.id, event.id)}
                            style={{ marginTop: '8px' }}
                          >
                            <FiTrash2 />
                          </Button>
                        </EventItem>
                      ))}
                    </EventList>
                  </EventSection>
                  
                  <EventSection>
                    <EventHeader>
                      <EventTitle>Game Schedule</EventTitle>
                      <Button onClick={() => openAddEventModal(sport)}>
                        <FiPlus />
                        Add Game
                      </Button>
                    </EventHeader>
                    <EventList>
                      {sport.gameSchedule.map(event => (
                        <GameEventItem key={event.id}>
                          <div><strong>{event.title}</strong></div>
                          <EventDetails>
                            {new Date(event.date).toLocaleDateString()} • {event.startTime} - {event.endTime} • {event.location}
                          </EventDetails>
                          {event.equipment.length > 0 && (
                            <EventEquipment>
                              Equipment: {event.equipment.join(', ')}
                            </EventEquipment>
                          )}
                          {event.notes && (
                            <EventDetails>Notes: {event.notes}</EventDetails>
                          )}
                          <Button 
                             
                            className="danger"
                            onClick={() => handleDeleteEvent(sport.id, event.id)}
                            style={{ marginTop: '8px' }}
                          >
                            <FiTrash2 />
                          </Button>
                        </GameEventItem>
                      ))}
                    </EventList>
                  </EventSection>
                </CollapsibleContent>
              </SportCard>
            );
          })
        )}
      </Section>
    </Content>
  );

  const renderScheduleTab = () => (
    <Content>
      <Section>
        <SectionTitle>
          <FiCalendar />
          Upcoming Events (Next 14 Days)
        </SectionTitle>
        
        {upcomingEvents.length === 0 ? (
          <EmptyState>
            <EmptyStateText>No upcoming events. Add some sports events to see them here!</EmptyStateText>
          </EmptyState>
        ) : (
          upcomingEvents.map(event => {
            const sport = config.sports.find(s => s.id === event.sportId);
            const member = config.members.find(m => m.id === event.familyMemberId);
            const EventComponent = event.type === 'practice' ? EventItem : GameEventItem;
            
            return (
              <EventComponent key={event.id}>
                <div><strong>{event.title}</strong></div>
                <EventDetails>
                  {sport?.name} • {member?.name} • {new Date(event.date).toLocaleDateString()} • {event.startTime} - {event.endTime} • {event.location}
                </EventDetails>
                {event.equipment.length > 0 && (
                  <EventEquipment>
                    Equipment: {event.equipment.join(', ')}
                  </EventEquipment>
                )}
                {event.notes && (
                  <EventDetails>Notes: {event.notes}</EventDetails>
                )}
              </EventComponent>
            );
          })
        )}
      </Section>
    </Content>
  );

  const renderMembersTab = () => (
    <Content>
      <Section>
        <SectionTitle>
          <FiUsers />
          Family Members
          <Button onClick={() => setShowAddMemberModal(true)}>
            <FiPlus />
            Add Member
          </Button>
        </SectionTitle>
        
        {config.members.length === 0 ? (
          <EmptyState>
            <EmptyStateText>No family members added yet. Add your first family member to get started!</EmptyStateText>
          </EmptyState>
        ) : (
          config.members.map(member => {
            const stats = SportsService.getMemberStats(config, member.id);
            
            return (
              <MemberCard key={member.id}>
                <MemberInfo>
                  <MemberColor color={member.color} />
                  <div>
                    <div style={{ fontWeight: '600' }}>{member.name}</div>
                    <MemberStats>
                      {stats.sportsCount} sports • {stats.upcomingEventsCount} upcoming events
                    </MemberStats>
                  </div>
                </MemberInfo>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button 
                     
                    className="secondary"
                    onClick={() => openEditMemberModal(member)}
                  >
                    <FiEdit2 />
                  </Button>
                  <Button 
                     
                    className="danger"
                    onClick={() => handleDeleteMember(member.id)}
                  >
                    <FiTrash2 />
                  </Button>
                </div>
              </MemberCard>
            );
          })
        )}
      </Section>
    </Content>
  );

  return (
    <WidgetContainer>
      <Header>
        <FiActivity size={20} />
        <HeaderTitle>Sports Tracker</HeaderTitle>
      </Header>
      
      <TabContainer>
        <Tab 
          active={activeTab === 'sports'} 
          onClick={() => setActiveTab('sports')}
        >
          <FiActivity />
          Sports
        </Tab>
        <Tab 
          active={activeTab === 'schedule'} 
          onClick={() => setActiveTab('schedule')}
        >
          <FiCalendar />
          Schedule
        </Tab>
        <Tab 
          active={activeTab === 'members'} 
          onClick={() => setActiveTab('members')}
        >
          <FiUsers />
          Members
        </Tab>
      </TabContainer>
      
      {activeTab === 'sports' && renderSportsTab()}
      {activeTab === 'schedule' && renderScheduleTab()}
      {activeTab === 'members' && renderMembersTab()}
      
      {/* Add Member Modal */}
      {showAddMemberModal && (
        <Modal>
          <ModalContent>
            <ModalTitle>
              {editingMember ? 'Edit Family Member' : 'Add Family Member'}
            </ModalTitle>
            <FormGroup>
              <Label>Name</Label>
              <Input
                type="text"
                value={memberForm.name}
                onChange={(e) => setMemberForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter member name"
              />
            </FormGroup>
            <FormGroup>
              <Label>Color</Label>
              <Input
                type="color"
                value={memberForm.color}
                onChange={(e) => setMemberForm(prev => ({ ...prev, color: e.target.value }))}
              />
            </FormGroup>
            <ButtonGroup>
              <Button className="secondary" onClick={() => {
                setShowAddMemberModal(false);
                setEditingMember(null);
                setMemberForm({ name: '', color: '#667eea' });
              }}>
                Cancel
              </Button>
              <Button onClick={editingMember ? handleUpdateMember : handleAddMember}>
                {editingMember ? 'Update' : 'Add'}
              </Button>
            </ButtonGroup>
          </ModalContent>
        </Modal>
      )}
      
      {/* Add Sport Modal */}
      {showAddSportModal && (
        <Modal>
          <ModalContent>
            <ModalTitle>
              {editingSport ? 'Edit Sport' : 'Add Sport'}
            </ModalTitle>
            <FormGroup>
              <Label>Sport Name</Label>
              <Input
                type="text"
                value={sportForm.name}
                onChange={(e) => setSportForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter sport name"
              />
            </FormGroup>
            <FormGroup>
              <Label>Family Member</Label>
              <Select
                value={sportForm.familyMemberId}
                onChange={(e) => setSportForm(prev => ({ ...prev, familyMemberId: e.target.value }))}
              >
                <option value="">Select a family member</option>
                {config.members.map(member => (
                  <option key={member.id} value={member.id}>{member.name}</option>
                ))}
              </Select>
            </FormGroup>
            <FormGroup>
              <Label>Equipment (comma-separated)</Label>
              <Input
                type="text"
                value={sportForm.equipment}
                onChange={(e) => setSportForm(prev => ({ ...prev, equipment: e.target.value }))}
                placeholder="e.g., ball, shoes, water bottle"
              />
            </FormGroup>
            <ButtonGroup>
              <Button className="secondary" onClick={() => {
                setShowAddSportModal(false);
                setEditingSport(null);
                setSportForm({ name: '', familyMemberId: '', equipment: '' });
              }}>
                Cancel
              </Button>
              <Button onClick={editingSport ? handleUpdateSport : handleAddSport}>
                {editingSport ? 'Update' : 'Add'}
              </Button>
            </ButtonGroup>
          </ModalContent>
        </Modal>
      )}
      
      {/* Add Event Modal */}
      {showAddEventModal && selectedSportForEvent && (
        <Modal>
          <ModalContent>
            <ModalTitle>Add Event</ModalTitle>
            <FormGroup>
              <Label>Event Title</Label>
              <Input
                type="text"
                value={eventForm.title}
                onChange={(e) => setEventForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter event title"
              />
            </FormGroup>
            <FormGroup>
              <Label>Date</Label>
              <Input
                type="date"
                value={eventForm.date}
                onChange={(e) => setEventForm(prev => ({ ...prev, date: e.target.value }))}
              />
            </FormGroup>
            <FormGroup>
              <Label>Start Time</Label>
              <Input
                type="time"
                value={eventForm.startTime}
                onChange={(e) => setEventForm(prev => ({ ...prev, startTime: e.target.value }))}
              />
            </FormGroup>
            <FormGroup>
              <Label>End Time</Label>
              <Input
                type="time"
                value={eventForm.endTime}
                onChange={(e) => setEventForm(prev => ({ ...prev, endTime: e.target.value }))}
              />
            </FormGroup>
            <FormGroup>
              <Label>Location</Label>
              <Input
                type="text"
                value={eventForm.location}
                onChange={(e) => setEventForm(prev => ({ ...prev, location: e.target.value }))}
                placeholder="Enter location"
              />
            </FormGroup>
            <FormGroup>
              <Label>Event Type</Label>
              <Select
                value={eventForm.type}
                onChange={(e) => setEventForm(prev => ({ ...prev, type: e.target.value as 'practice' | 'game' }))}
              >
                <option value="practice">Practice</option>
                <option value="game">Game</option>
              </Select>
            </FormGroup>
            <FormGroup>
              <Label>Equipment for this event (comma-separated)</Label>
              <Input
                type="text"
                value={eventForm.equipment}
                onChange={(e) => setEventForm(prev => ({ ...prev, equipment: e.target.value }))}
                placeholder="e.g., ball, shoes, water bottle"
              />
            </FormGroup>
            <FormGroup>
              <Label>Notes (optional)</Label>
              <Textarea
                value={eventForm.notes}
                onChange={(e) => setEventForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Enter any additional notes"
              />
            </FormGroup>
            <ButtonGroup>
              <Button className="secondary" onClick={() => {
                setShowAddEventModal(false);
                setSelectedSportForEvent(null);
                setEventForm({
                  title: '',
                  date: '',
                  startTime: '',
                  endTime: '',
                  location: '',
                  type: 'practice',
                  equipment: '',
                  notes: ''
                });
              }}>
                Cancel
              </Button>
              <Button onClick={handleAddEvent}>
                Add Event
              </Button>
            </ButtonGroup>
          </ModalContent>
        </Modal>
      )}
    </WidgetContainer>
  );
};

export default SportsWidget; 