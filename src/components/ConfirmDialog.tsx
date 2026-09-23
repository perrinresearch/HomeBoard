import React from 'react';
import styled from 'styled-components';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(31, 35, 40, 0.28);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 16px;
`;

const Dialog = styled.div`
  background: var(--hb-card);
  border-radius: var(--hb-radius);
  width: 100%;
  max-width: 420px;
  padding: 24px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2);
`;

const Title = styled.h3`
  margin: 0 0 12px 0;
  font-size: 20px;
  color: var(--hb-text);
`;

const Message = styled.p`
  margin: 0 0 24px 0;
  color: var(--hb-muted);
  line-height: 1.4;
  font-size: 16px;
`;

const ButtonRow = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
`;

const Button = styled.button<{ danger?: boolean }>`
  min-height: var(--hb-touch);
  min-width: 88px;
  padding: 10px 16px;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  background: ${props => props.danger ? 'var(--hb-danger)' : 'var(--hb-accent)'};
  color: white;

  &.secondary {
    background: var(--hb-paper);
    color: var(--hb-text);
  }
`;

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel
}) => {
  return (
    <Overlay>
      <Dialog role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <Title id="confirm-title">{title}</Title>
        <Message>{message}</Message>
        <ButtonRow>
          <Button className="secondary" onClick={onCancel}>{cancelLabel}</Button>
          <Button danger={danger} onClick={onConfirm}>{confirmLabel}</Button>
        </ButtonRow>
      </Dialog>
    </Overlay>
  );
};

export default ConfirmDialog;
