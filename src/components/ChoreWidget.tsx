import React, { useState } from 'react';
import styled from 'styled-components';
import { Chore, ChoreConfig } from '../types';
import { ChoreService } from '../services/choreService';
import { FiPlus, FiSettings, FiCheck, FiRotateCcw, FiTrash2, FiUser } from 'react-icons/fi';
import ConfirmDialog from './ConfirmDialog';
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

const ChoreControls = styled.div`
  display: flex;
  gap: 8px;
`;

const ControlButton = styled.button`
  background: none;
  border: none;
  color: var(--hb-muted);
  cursor: pointer;
  min-width: 44px;
  min-height: var(--hb-touch);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:active {
    background-color: var(--hb-paper);
  }
`;

const ChoreTabs = styled.div`
  display: flex;
  border-bottom: 1px solid var(--hb-line);
  margin-bottom: 12px;
`;

const Tab = styled.button<{ active: boolean }>`
  background: none;
  border: none;
  padding: 12px 16px;
  min-height: var(--hb-touch);
  cursor: pointer;
  border-bottom: 2px solid ${props => props.active ? 'var(--hb-accent)' : 'transparent'};
  color: ${props => props.active ? 'var(--hb-accent)' : 'var(--hb-muted)'};
  font-weight: ${props => props.active ? '600' : '400'};
`;

const ChoreList = styled.div`
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const ChoreCard = styled.div<{ completed: boolean; overdue: boolean }>`
  background: ${props => props.overdue ? '#fdf6e3' : props.completed ? '#eaf5ee' : 'white'};
  border: 1px solid ${props => props.overdue ? '#f3e3b5' : props.completed ? '#cfe8d8' : 'var(--hb-line)'};
  border-radius: 12px;
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
  color: var(--hb-text);
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
      case 'success': return 'var(--hb-success)';
      case 'warning': return '#f2c14e';
      case 'danger': return 'var(--hb-danger)';
      default: return 'var(--hb-muted)';
    }
  }};
  color: white;
  border: none;
  min-width: 44px;
  min-height: var(--hb-touch);
  padding: 8px;
  border-radius: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  
  &:hover {
    opacity: 0.8;
  }
`;

const ChoreDetails = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--hb-muted);
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
  color: ${props => props.overdue ? 'var(--hb-danger)' : 'var(--hb-muted)'};
  font-weight: ${props => props.overdue ? '600' : '400'};
`;

const AddChoreButton = styled.button`
  background: var(--hb-success);
  color: white;
  border: none;
  padding: 12px 16px;
  min-height: var(--hb-touch);
  border-radius: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 16px;
`;

const Modal = styled.div<{ isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(31, 35, 40, 0.28);
  backdrop-filter: blur(6px);
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
  color: var(--hb-text);
`;

const FormGroup = styled.div`
  margin-bottom: 16px;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 6px;
  font-weight: 600;
  color: var(--hb-text);
  font-size: 14px;
`;

const Input = styled.input`
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 12px;
  font-size: 14px;
  
  &:focus {
    outline: none;
    border-color: var(--hb-accent);
  }
`;

const Select = styled.select`
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 12px;
  font-size: 14px;
  
  &:focus {
    outline: none;
    border-color: var(--hb-accent);
  }
`;

const TextArea = styled.textarea`
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 12px;
  font-size: 14px;
  resize: vertical;
  min-height: 60px;
  
  &:focus {
    outline: none;
    border-color: var(--hb-accent);
  }
`;

const Button = styled.button`
  background: var(--hb-accent);
  color: white;
  border: none;
  padding: 12px 16px;
  min-height: var(--hb-touch);
  border-radius: 12px;
  cursor: pointer;
  font-size: 16px;
  margin-right: 8px;
  
  &:hover {
    background: #5a6fd8;
  }
  
  &.secondary {
    background: var(--hb-paper);
    color: var(--hb-text);
    
    &:hover {
      background: var(--hb-line);
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
  color: var(--hb-muted);
  font-style: italic;
  padding: 20px;
`;

const ChoreWidget: React.FC<ChoreWidgetProps> = ({ config, onConfigChange }) => {
  const [activeTab, setActiveTab] = useState<'all' | 'overdue' | 'today'>('all');
  const [showAddChore, setShowAddChore] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<string | null>(null);
  const [newMember, setNewMember] = useState({ name: '', color: '#3d4fdb' });
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
        <ChoreControls style={{ marginLeft: 'auto' }}>
          <ControlButton onClick={() => setShowSettings(true)} title="Family members">
            <FiSettings size={20} />
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
                  <div style={{ fontSize: '12px', color: 'var(--hb-muted)', marginBottom: '8px' }}>
                    {chore.description}
                  </div>
                )}
                
                <ChoreDetails>
                  <ChoreAssignee>
                    <FiUser size={12} />
                    {member?.name}
                    <AssigneeColor color={member?.color || 'var(--hb-muted)'} />
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

      {showAddChore && (
      <Modal isOpen>
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
      )}

      {showSettings && (
      <Modal isOpen>
        <ModalContent>
          <ModalTitle>Family Members</ModalTitle>
          <p style={{ color: '#555', marginTop: 0 }}>
            These people are shared with the Sports tracker.
          </p>
          
          <FormGroup>
            <MemberList>
              {config.members.map((member) => (
                <MemberTag key={member.id} color={member.color}>
                  <FiUser size={14} />
                  {member.name}
                  <ControlButton
                    onClick={() => setMemberToDelete(member.id)}
                    title={`Remove ${member.name}`}
                    style={{ minWidth: 32, minHeight: 32, color: 'white' }}
                  >
                    <FiTrash2 size={16} />
                  </ControlButton>
                </MemberTag>
              ))}
            </MemberList>
          </FormGroup>

          <FormGroup>
            <Label>Add a family member</Label>
            <Input
              type="text"
              placeholder="Name"
              value={newMember.name}
              onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
            />
          </FormGroup>
          <FormGroup>
            <Label>Color</Label>
            <Input
              type="color"
              value={newMember.color}
              onChange={(e) => setNewMember({ ...newMember, color: e.target.value })}
            />
          </FormGroup>
          <Button
            onClick={() => {
              if (!newMember.name.trim()) return;
              handleAddMember(newMember.name.trim(), newMember.color);
              setNewMember({ name: '', color: '#3d4fdb' });
            }}
          >
            Add member
          </Button>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: 16 }}>
            <Button className="secondary" onClick={() => setShowSettings(false)}>
              Close
            </Button>
          </div>
        </ModalContent>
      </Modal>
      )}

      {memberToDelete && (
        <ConfirmDialog
          title="Remove family member?"
          message="This removes their chores and any sports assigned to them."
          confirmLabel="Remove"
          danger
          onCancel={() => setMemberToDelete(null)}
          onConfirm={() => {
            onConfigChange(ChoreService.removeFamilyMember(config, memberToDelete));
            setMemberToDelete(null);
          }}
        />
      )}
    </ChoreContainer>
  );
};

export default ChoreWidget; 