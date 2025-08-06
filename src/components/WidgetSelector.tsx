import React, { useState } from 'react';
import styled from 'styled-components';
import { Widget } from '../types';
import { FiPlus, FiCloud, FiCalendar, FiCheckSquare } from 'react-icons/fi';

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
  font-size: 20px;
  text-align: center;
`;

const WidgetGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
`;

const WidgetOption = styled.div`
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: #667eea;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
  }
`;

const WidgetIcon = styled.div`
  font-size: 32px;
  color: #667eea;
  margin-bottom: 12px;
`;

const WidgetName = styled.div`
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
`;

const WidgetDescription = styled.div`
  font-size: 14px;
  color: #666;
  line-height: 1.4;
`;

const ButtonGroup = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
`;

const Button = styled.button`
  background: #667eea;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
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
    description: 'View and manage events from Google, Apple, and Outlook calendars',
    icon: <FiCalendar />,
    defaultSize: { width: 350, height: 450 }
  },
  {
    type: 'chores' as const,
    title: 'Family Chores',
    description: 'Track and manage household chores with family member assignments',
    icon: <FiCheckSquare />,
    defaultSize: { width: 320, height: 400 }
  }
];

const WidgetSelector: React.FC<WidgetSelectorProps> = ({ onAddWidget, onClose }) => {
  const handleSelectWidget = (widgetType: typeof widgetTypes[0]) => {
    const newWidget: Widget = {
      id: Date.now().toString(),
      type: widgetType.type,
      title: widgetType.title,
      size: widgetType.defaultSize,
      columnSpan: 1, // Default to 1 column
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