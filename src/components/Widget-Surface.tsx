import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { Widget as WidgetType } from '../types';
import { FiX, FiMaximize2, FiMinimize2, FiColumns } from 'react-icons/fi';

interface WidgetProps {
  widget: WidgetType;
  index: number;
  onRemove: (id: string) => void;
  onResize: (id: string, size: { width: number; height: number }) => void;
  onColumnSpanChange: (id: string, columnSpan: number) => void;
  children: React.ReactNode;
  widgetHeaderBackground?: string;
}

const WidgetContainer = styled.div<{ size: { width: number; height: number }; columnSpan: number }>`
  width: 100%;
  min-height: ${props => props.size.height}px;
  grid-column: span ${props => props.columnSpan};
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  border: 1px solid #e0e0e0;
  overflow: hidden;
  transition: all 0.3s ease;
  
  &:hover {
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
    transform: translateY(-2px);
  }
`;

const WidgetHeader = styled.div<{ background: string }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: ${props => props.background};
  color: white;
  font-weight: 600;
  font-size: 14px;
`;

const WidgetControls = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const ControlButton = styled.button`
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease;
  
  &:hover {
    background-color: rgba(255, 255, 255, 0.2);
  }
`;

const WidgetContent = styled.div`
  padding: 16px;
  height: calc(100% - 60px);
  overflow-y: auto;
`;



const Widget: React.FC<WidgetProps> = ({ widget, index, onRemove, onResize, onColumnSpanChange, children, widgetHeaderBackground }) => {

  const handleResize = (direction: 'expand' | 'shrink') => {
    const sizeChange = direction === 'expand' ? 50 : -50;
    const newSize = {
      width: widget.size.width, // Keep width as is since grid handles it
      height: Math.max(150, widget.size.height + sizeChange)
    };
    onResize(widget.id, newSize);
  };

  const handleColumnSpanToggle = () => {
    // Get the maximum available columns based on screen size
    const getMaxColumns = () => {
      if (window.innerWidth <= 600) return 1;
      if (window.innerWidth <= 900) return 2;
      if (window.innerWidth <= 1200) return 3;
      return 4;
    };
    
    const maxColumns = getMaxColumns();
    const newColumnSpan = widget.columnSpan >= maxColumns ? 1 : widget.columnSpan + 1;
    onColumnSpanChange(widget.id, newColumnSpan);
  };



  return (
    <WidgetContainer
      size={widget.size}
      columnSpan={widget.columnSpan}
    >
          <WidgetHeader background={widgetHeaderBackground || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'}>
            <span>{widget.title}</span>
            <WidgetControls>
              <ControlButton 
                onClick={handleColumnSpanToggle}
                title={`Cycle width: ${widget.columnSpan} columns (responsive to screen size)`}
                style={{ 
                  backgroundColor: widget.columnSpan > 1 ? 'rgba(255, 255, 255, 0.3)' : 'transparent',
                  borderRadius: '4px',
                  position: 'relative'
                }}
              >
                <FiColumns size={14} />
                {widget.columnSpan > 1 && (
                  <span style={{
                    position: 'absolute',
                    top: '-2px',
                    right: '-2px',
                    background: '#fff',
                    color: '#667eea',
                    borderRadius: '50%',
                    width: '12px',
                    height: '12px',
                    fontSize: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold'
                  }}>
                    {widget.columnSpan}
                  </span>
                )}
              </ControlButton>
              <ControlButton onClick={() => handleResize('shrink')}>
                <FiMinimize2 size={14} />
              </ControlButton>
              <ControlButton onClick={() => handleResize('expand')}>
                <FiMaximize2 size={14} />
              </ControlButton>
              <ControlButton onClick={() => onRemove(widget.id)}>
                <FiX size={14} />
              </ControlButton>
            </WidgetControls>
          </WidgetHeader>
          <WidgetContent>
            {children}
          </WidgetContent>
        </WidgetContainer>
  );
};

export default Widget; 