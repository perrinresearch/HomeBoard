import React from 'react';
import styled from 'styled-components';
import { Widget as WidgetType } from '../types';
import { FiX, FiMaximize2, FiMinimize2, FiColumns } from 'react-icons/fi';

interface WidgetProps {
  widget: WidgetType;
  index: number;
  headerBackground: string;
  onRemove: (id: string) => void;
  onResize: (id: string, size: { width: number; height: number }) => void;
  onColumnSpanChange: (id: string, columnSpan: number) => void;
  children: React.ReactNode;
}

const WidgetContainer = styled.div<{ size: { width: number; height: number }; columnSpan: number }>`
  width: 100%;
  min-height: ${props => props.size.height}px;
  grid-column: span ${props => props.columnSpan};
  background: var(--hb-card);
  border-radius: var(--hb-radius);
  box-shadow: var(--hb-shadow);
  border: 1px solid rgba(255, 252, 248, 0.08);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  color: var(--hb-text);
`;

const WidgetHeader = styled.div<{ background: string }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: ${props => props.background};
  color: white;
  font-weight: 600;
  font-size: 16px;
  min-height: 56px;
`;

const WidgetControls = styled.div`
  display: flex;
  gap: 4px;
  align-items: center;
`;

const ControlButton = styled.button`
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  min-width: var(--hb-touch);
  min-height: var(--hb-touch);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;

  &:active {
    background-color: rgba(255, 255, 255, 0.2);
  }
`;

const SpanBadge = styled.span`
  position: absolute;
  top: 4px;
  right: 4px;
  background: #fff;
  color: var(--hb-accent);
  border-radius: 50%;
  width: 16px;
  height: 16px;
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
`;

const WidgetContent = styled.div`
  padding: 16px;
  flex: 1;
  overflow-y: auto;
`;

const Widget: React.FC<WidgetProps> = ({ widget, onRemove, onResize, onColumnSpanChange, headerBackground, children }) => {
  const handleResize = (direction: 'expand' | 'shrink') => {
    const sizeChange = direction === 'expand' ? 50 : -50;
    const newSize = {
      width: widget.size.width,
      height: Math.max(200, widget.size.height + sizeChange)
    };
    onResize(widget.id, newSize);
  };

  const handleColumnSpanToggle = () => {
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
    <WidgetContainer size={widget.size} columnSpan={widget.columnSpan}>
      <WidgetHeader background={headerBackground}>
        <span>{widget.title}</span>
        <WidgetControls>
          <ControlButton
            onClick={handleColumnSpanToggle}
            title={`Cycle width: ${widget.columnSpan} columns`}
            style={{ backgroundColor: widget.columnSpan > 1 ? 'rgba(255, 255, 255, 0.2)' : 'transparent' }}
          >
            <FiColumns size={20} />
            {widget.columnSpan > 1 && <SpanBadge>{widget.columnSpan}</SpanBadge>}
          </ControlButton>
          <ControlButton onClick={() => handleResize('shrink')} title="Shorter">
            <FiMinimize2 size={20} />
          </ControlButton>
          <ControlButton onClick={() => handleResize('expand')} title="Taller">
            <FiMaximize2 size={20} />
          </ControlButton>
          <ControlButton onClick={() => onRemove(widget.id)} title="Remove widget">
            <FiX size={20} />
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
