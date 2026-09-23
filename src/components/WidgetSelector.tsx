import React from 'react';
import styled from 'styled-components';
import { Widget } from '../types';
import { FiCloud, FiCalendar, FiCheckSquare, FiActivity } from 'react-icons/fi';

interface WidgetSelectorProps {
  onAddWidget: (widget: Widget) => void;
  onClose: () => void;
}

const Modal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(31, 35, 40, 0.28);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background: var(--hb-card);
  padding: 24px;
  border-radius: var(--hb-radius);
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  overflow-y: auto;
`;

const ModalTitle = styled.h3`
  margin: 0 0 20px 0;
  color: var(--hb-text);
  font-size: 20px;
  text-align: center;
`;

const WidgetGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
`;

const WidgetOption = styled.button`
  border: 2px solid var(--hb-line);
  border-radius: 16px;
  padding: 20px;
  min-height: 140px;
  text-align: center;
  cursor: pointer;
  background: white;
  width: 100%;
  
  &:active {
    border-color: var(--hb-accent);
    background: #f7f8ff;
  }
`;

const WidgetIcon = styled.div`
  font-size: 32px;
  color: var(--hb-accent);
  margin-bottom: 12px;
`;

const WidgetName = styled.div`
  font-weight: 600;
  color: var(--hb-text);
  margin-bottom: 8px;
`;

const WidgetDescription = styled.div`
  font-size: 14px;
  color: var(--hb-muted);
  line-height: 1.4;
`;

const ButtonGroup = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
`;

const Button = styled.button`
  background: var(--hb-accent);
  color: white;
  border: none;
  padding: 12px 20px;
  min-height: 44px;
  border-radius: 12px;
  cursor: pointer;
  font-size: 16px;
  transition: background-color 0.2s ease;
  
  &:hover {
    background: var(--hb-accent-dark);
  }
  
  &.secondary {
    background: var(--hb-paper);
    color: var(--hb-text);
    
    &:hover {
      background: var(--hb-line);
    }
  }
`;

const widgetTypes = [
  {
    type: 'weather' as const,
    title: 'Weather & Time',
    description: 'Display current weather for multiple locations with date and time',
    icon: <FiCloud />,
    defaultSize: { width: 300, height: 400 }
  },
  {
    type: 'calendar' as const,
    title: 'Calendar',
    description: 'Month and agenda from Google, Outlook, Apple, and this board',
    icon: <FiCalendar />,
    defaultSize: { width: 350, height: 450 }
  },
  {
    type: 'chores' as const,
    title: 'Family Chores',
    description: 'Track and manage household chores with family member assignments',
    icon: <FiCheckSquare />,
    defaultSize: { width: 320, height: 400 }
  },
  {
    type: 'sports' as const,
    title: 'Sports Tracker',
    description: 'Track sports activities, schedules, and equipment for family members',
    icon: <FiActivity />,
    defaultSize: { width: 350, height: 500 }
  }
];

const WidgetSelector: React.FC<WidgetSelectorProps> = ({ onAddWidget, onClose }) => {
  const handleSelectWidget = (widgetType: typeof widgetTypes[0]) => {
    const newWidget: Widget = {
      id: Date.now().toString(),
      type: widgetType.type,
      title: widgetType.title,
      size: widgetType.defaultSize,
      columnSpan: 2,
      config: {}
    };
    
    onAddWidget(newWidget);
    onClose();
  };

  return (
    <Modal>
      <ModalContent>
        <ModalTitle>Add Widget</ModalTitle>
        
        <WidgetGrid>
          {widgetTypes.map((widget) => (
            <WidgetOption
              key={widget.type}
              onClick={() => handleSelectWidget(widget)}
            >
              <WidgetIcon>
                {widget.icon}
              </WidgetIcon>
              <WidgetName>{widget.title}</WidgetName>
              <WidgetDescription>
                {widget.description}
              </WidgetDescription>
            </WidgetOption>
          ))}
        </WidgetGrid>
        
        <ButtonGroup>
          <Button className="secondary" onClick={onClose}>
            Cancel
          </Button>
        </ButtonGroup>
      </ModalContent>
    </Modal>
  );
};

export default WidgetSelector; 