import React, { useState } from 'react';
import styled from 'styled-components';
import { Chore, FamilyMember, ChoreConfig } from '../types';
import { ChoreService } from '../services/choreService';
import { FiPlus, FiSettings, FiCheck, FiRotateCcw, FiTrash2, FiUser } from 'react-icons/fi';
import { format } from 'date-fns';

interface ChoreWidgetProps {
  config: ChoreConfig;
  onConfigChange: (config: ChoreConfig) => void;
}

const ChoreContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 16px;
`;

const ChoreHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const ChoreTitle = styled.h3`
  margin: 0;
  font-size: 16px;
  color: #333;
`;

const ChoreControls = styled.div`
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

const ChoreTabs = styled.div`
  display: flex;
  border-bottom: 1px solid #e0e0e0;
  margin-bottom: 12px;
`;

const Tab = styled.button<{ active: boolean }>`
  background: none;
  border: none;
  padding: 8px 16px;
  cursor: pointer;
  border-bottom: 2px solid ${props => props.active ? '#667eea' : 'transparent'};
  color: ${props => props.active ? '#667eea' : '#666'};
  font-weight: ${props => props.active ? '600' : '400'};
  
  &:hover {
    color: #667eea;
  }
`;

const ChoreList = styled.div`
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const ChoreCard = styled.div<{ completed: boolean; overdue: boolean }>`
  background: ${props => props.overdue ? '#fff3cd' : props.completed ? '#d4edda' : 'white'};
  border: 1px solid ${props => props.overdue ? '#ffeaa7' : props.completed ? '#c3e6cb' : '#e0e0e0'};
  border-radius: 8px;
  padding: 12px;
  position: relative;
  transition: all 0.2s ease;
  
  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
`;

const ChoreHeaderRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
`;

const ChoreTitleText = styled.div<{ completed: boolean }>`
  font-weight: 600;
  color: #333;
  text-decoration: ${props => props.completed ? 'line-through' : 'none'};
  opacity: ${props => props.completed ? 0.6 : 1};
`;

const ChoreActions = styled.div`
  display: flex;
  gap: 4px;
`;

const ActionButton = styled.button<{ variant?: 'success' | 'warning' | 'danger' }>`
  background: ${props => {
    switch (props.variant) {
      case 'success': return '#28a745';
      case 'warning': return '#ffc107';
      case 'danger': return '#dc3545';
      default: return '#6c757d';
    }
  }};
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  
  &:hover {
    opacity: 0.8;
  }
`;

const ChoreDetails = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #666;
`;

const ChoreAssignee = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const AssigneeColor = styled.div<{ color: string }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${props => props.color};
`;

const ChoreDueDate = styled.div<{ overdue: boolean }>`
  color: ${props => props.overdue ? '#dc3545' : '#666'};
  font-weight: ${props => props.overdue ? '600' : '400'};
`;

const AddChoreButton = styled.button`
  background: #4CAF50;
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  transition: background-color 0.2s ease;
  
  &:hover {
    background: #45a049;
  }
`;

const Modal = styled.div<{ isOpen: boolean }>`
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
  max-width: 500px;
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

const Select = styled.select`
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

const TextArea = styled.textarea`
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  resize: vertical;
  min-height: 60px;
  
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

const MemberList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
`;

const MemberTag = styled.div<{ color: string }>`
  background: ${props => props.color};
  color: white;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
`;

const NoChores = styled.div`
  text-align: center;
  color: #666;
  font-style: italic;
  padding: 20px;
`;

const ChoreWidget: React.FC<ChoreWidgetProps> = ({ config, onConfigChange }) => {
  const [activeTab, setActiveTab] = useState<'all' | 'overdue' | 'today'>('all');
  const [showAddChore, setShowAddChore] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [newChore, setNewChore] = useState({
    title: '',
    description: '',
    assignedTo: '',
    frequency: 'weekly' as const,
    frequencyValue: 1
  });

  const getFilteredChores = () => {
    switch (activeTab) {
      case 'overdue':
        return ChoreService.getOverdueChores(config);
      case 'today':
        return ChoreService.getDueTodayChores(config);
      default:
        return config.chores;
    }
  };

  const handleCompleteChore = (choreId: string) => {
    const updatedConfig = ChoreService.completeChore(config, choreId);
    onConfigChange(updatedConfig);
  };

  const handleResetChore = (choreId: string) => {
    const updatedConfig = ChoreService.resetChore(config, choreId);
    onConfigChange(updatedConfig);
  };

  const handleDeleteChore = (choreId: string) => {
    const updatedConfig = ChoreService.deleteChore(config, choreId);
    onConfigChange(updatedConfig);
  };

  const handleAddChore = () => {
    if (!newChore.title || !newChore.assignedTo) return;
    
    const updatedConfig = ChoreService.addChore(
      config,
      newChore.title,
      newChore.description,
      newChore.assignedTo,
      newChore.frequency,
      newChore.frequencyValue
    );
    
    onConfigChange(updatedConfig);
    setNewChore({
      title: '',
      description: '',
      assignedTo: '',
      frequency: 'weekly',
      frequencyValue: 1
    });
    setShowAddChore(false);
  };

  const handleAddMember = (name: string, color: string) => {
    const updatedConfig = ChoreService.addFamilyMember(config, name, color);
    onConfigChange(updatedConfig);
  };

  const isOverdue = (chore: Chore) => {
    return !chore.completed && new Date(chore.nextDue) < new Date();
  };

  const formatDueDate = (date: Date) => {
    const dueDate = new Date(date);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (dueDate.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (dueDate.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return format(dueDate, 'MMM d');
    }
  };

  const getMemberById = (id: string) => {
    return config.members.find(member => member.id === id);
  };

  return (
    <ChoreContainer>
      <ChoreHeader>
        <ChoreTitle>Family Chores</ChoreTitle>
        <ChoreControls>
          <ControlButton onClick={() => setShowSettings(true)}>
            <FiSettings size={14} />
          </ControlButton>
        </ChoreControls>
      </ChoreHeader>

      <ChoreTabs>
        <Tab
          active={activeTab === 'all'}
          onClick={() => setActiveTab('all')}
        >
          All ({config.chores.length})
        </Tab>
        <Tab
          active={activeTab === 'overdue'}
          onClick={() => setActiveTab('overdue')}
        >
          Overdue ({ChoreService.getOverdueChores(config).length})
        </Tab>
        <Tab
          active={activeTab === 'today'}
          onClick={() => setActiveTab('today')}
        >
          Today ({ChoreService.getDueTodayChores(config).length})
        </Tab>
      </ChoreTabs>

      <ChoreList>
        {getFilteredChores().length > 0 ? (
          getFilteredChores().map((chore) => {
            const member = getMemberById(chore.assignedTo);
            const overdue = isOverdue(chore);
            
            return (
              <ChoreCard key={chore.id} completed={chore.completed} overdue={overdue}>
                <ChoreHeaderRow>
                  <ChoreTitleText completed={chore.completed}>
                    {chore.title}
                  </ChoreTitleText>
                  <ChoreActions>
                    {!chore.completed ? (
                      <ActionButton
                        variant="success"
                        onClick={() => handleCompleteChore(chore.id)}
                      >
                        <FiCheck size={12} />
                      </ActionButton>
                    ) : (
                      <ActionButton
                        variant="warning"
                        onClick={() => handleResetChore(chore.id)}
                      >
                        <FiRotateCcw size={12} />
                      </ActionButton>
                    )}
                    <ActionButton
                      variant="danger"
                      onClick={() => handleDeleteChore(chore.id)}
                    >
                      <FiTrash2 size={12} />
                    </ActionButton>
                  </ChoreActions>
                </ChoreHeaderRow>
                
                {chore.description && (
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                    {chore.description}
                  </div>
                )}
                
                <ChoreDetails>
                  <ChoreAssignee>
                    <FiUser size={12} />
                    {member?.name}
                    <AssigneeColor color={member?.color || '#666'} />
                  </ChoreAssignee>
                  <ChoreDueDate overdue={overdue}>
                    Due: {formatDueDate(chore.nextDue)}
                  </ChoreDueDate>
                </ChoreDetails>
              </ChoreCard>
            );
          })
        ) : (
          <NoChores>No chores found</NoChores>
        )}
      </ChoreList>

      <AddChoreButton onClick={() => setShowAddChore(true)}>
        <FiPlus size={12} />
        Add Chore
      </AddChoreButton>

      {/* Add Chore Modal */}
      <Modal isOpen={showAddChore}>
        <ModalContent>
          <ModalTitle>Add New Chore</ModalTitle>
          
          <FormGroup>
            <Label>Chore Title</Label>
            <Input
              type="text"
              placeholder="Enter chore title"
              value={newChore.title}
              onChange={(e) => setNewChore({ ...newChore, title: e.target.value })}
            />
          </FormGroup>

          <FormGroup>
            <Label>Description (Optional)</Label>
            <TextArea
              placeholder="Enter chore description"
              value={newChore.description}
              onChange={(e) => setNewChore({ ...newChore, description: e.target.value })}
            />
          </FormGroup>

          <FormGroup>
            <Label>Assign To</Label>
            <Select
              value={newChore.assignedTo}
              onChange={(e) => setNewChore({ ...newChore, assignedTo: e.target.value })}
            >
              <option value="">Select family member</option>
              {config.members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </Select>
          </FormGroup>

          <FormGroup>
            <Label>Frequency</Label>
            <Select
              value={newChore.frequency}
              onChange={(e) => setNewChore({ ...newChore, frequency: e.target.value as any })}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="custom">Custom</option>
            </Select>
          </FormGroup>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button className="secondary" onClick={() => setShowAddChore(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddChore}>
              Add Chore
            </Button>
          </div>
        </ModalContent>
      </Modal>

      {/* Settings Modal */}
      <Modal isOpen={showSettings}>
        <ModalContent>
          <ModalTitle>Family Settings</ModalTitle>
          
          <FormGroup>
            <Label>Family Members</Label>
            <MemberList>
              {config.members.map((member) => (
                <MemberTag key={member.id} color={member.color}>
                  <FiUser size={12} />
                  {member.name}
                </MemberTag>
              ))}
            </MemberList>
          </FormGroup>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button className="secondary" onClick={() => setShowSettings(false)}>
              Close
            </Button>
          </div>
        </ModalContent>
      </Modal>
    </ChoreContainer>
  );
};

export default ChoreWidget; 