import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { Draggable } from 'react-beautiful-dnd';
import { Widget as WidgetType } from '../types';
import { FiX, FiMaximize2, FiMinimize2, FiColumns } from 'react-icons/fi';

interface WidgetProps {
  widget: WidgetType;
  index: number;
  onRemove: (id: string) => void;
  onResize: (id: string, size: { width: number; height: number }) => void;
  onColumnSpanChange: (id: string, columnSpan: number) => void;
  children: React.ReactNode;
}

const WidgetContainer = styled.div<{ size: { width: number; height: number }; columnSpan: number; isDragging?: boolean }>`
  width: 100%;
  min-height: ${props => props.size.height}px;
  grid-column: ${props => props.isDragging ? 'span 1' : `span ${props.columnSpan}`};
  background: white;
  border-radius: 12px;
  box-shadow: ${props => props.isDragging ? '0 8px 30px rgba(0, 0, 0, 0.3)' : '0 4px 20px rgba(0, 0, 0, 0.1)'};
  border: 1px solid #e0e0e0;
  overflow: hidden;
  transition: all 0.3s ease;
  transform: ${props => props.isDragging ? 'rotate(5deg)' : 'none'};
  opacity: ${props => props.isDragging ? 0.8 : 1};
  z-index: ${props => props.isDragging ? 1000 : 1};
  
  &:hover {
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
    transform: translateY(-2px);
  }
`;

const WidgetHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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

const HoldIndicator = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 16px;
  border-radius: 8px;
  text-align: center;
  z-index: 1001;
  pointer-events: none;
`;

const HoldProgress = styled.div<{ progress: number }>`
  width: 200px;
  height: 8px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  margin-bottom: 8px;
  overflow: hidden;
  
  &::after {
    content: '';
    display: block;
    width: ${props => props.progress}%;
    height: 100%;
    background: #667eea;
    border-radius: 4px;
    transition: width 0.2s ease;
  }
`;

const HoldText = styled.div`
  font-size: 14px;
  font-weight: 600;
`;

const Widget: React.FC<WidgetProps> = ({ widget, index, onRemove, onResize, onColumnSpanChange, children }) => {
  const [isHolding, setIsHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const dragTriggeredRef = useRef(false);

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

  const handleMouseDown = (e: React.MouseEvent) => {
    if (dragTriggeredRef.current) return;
    
    // Prevent default to avoid text selection
    e.preventDefault();
    
    setIsHolding(true);
    setHoldProgress(0);
    
    // Start progress timer
    progressTimerRef.current = setInterval(() => {
      setHoldProgress(prev => {
        if (prev >= 100) {
          return 100;
        }
        return prev + 10;
      });
    }, 200); // 2 seconds total = 200ms intervals for 10 steps
    
    // Start hold timer
    holdTimerRef.current = setTimeout(() => {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
      }
      dragTriggeredRef.current = true;
      setIsHolding(false);
      setHoldProgress(0);
      
      // The hidden drag handle will now be active and can be used for dragging
    }, 2000);
  };

  const handleMouseUp = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    setIsHolding(false);
    setHoldProgress(0);
    dragTriggeredRef.current = false;
  };

  const handleMouseLeave = () => {
    handleMouseUp();
  };

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
      }
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
      }
    };
  }, []);

  return (
    <Draggable draggableId={widget.id} index={index}>
      {(provided, snapshot) => (
        <WidgetContainer
          ref={provided.innerRef}
          {...provided.draggableProps}
          size={widget.size}
          columnSpan={widget.columnSpan}
          isDragging={snapshot.isDragging}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          style={{
            ...provided.draggableProps.style,
            cursor: isHolding ? 'grabbing' : 'grab'
          }}
        >
          {/* Hidden drag handle that gets triggered after hold */}
          <div
            {...provided.dragHandleProps}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              opacity: 0,
              cursor: 'grab',
              zIndex: dragTriggeredRef.current ? 1 : -1
            }}
          />
          
          {isHolding && (
            <HoldIndicator>
              <HoldProgress progress={holdProgress} />
              <HoldText>Hold to drag ({Math.round(holdProgress)}%)</HoldText>
            </HoldIndicator>
          )}
          <WidgetHeader>
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
      )}
    </Draggable>
  );
};

export default Widget; 