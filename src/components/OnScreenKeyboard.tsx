import React, { useEffect, useState } from 'react';
import styled from 'styled-components';

type Field = HTMLInputElement | HTMLTextAreaElement;
type Layout = 'letters' | 'symbols';

const TEXT_TYPES = new Set(['text', 'search', 'email', 'url', 'password', 'tel', 'number', '']);

const LETTERS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['shift', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'backspace'],
  ['symbols', 'space', '.', 'hide']
];

const SYMBOLS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['@', '#', '/', ':', '-', '_', '.', ',', '?', '!'],
  ['letters', '(', ')', '+', '=', '&', "'", '"', 'backspace'],
  ['letters', 'space', 'hide']
];

const Dock = styled.div`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 4000;
  background: #161b24;
  padding: 8px 10px 14px;
  box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.28);
`;

const Row = styled.div`
  display: flex;
  justify-content: center;
  gap: 6px;
  margin-top: 6px;
`;

const Key = styled.button<{ wide?: boolean; grow?: boolean }>`
  flex: ${props => props.grow ? '1 1 160px' : props.wide ? '1.4 1 0' : '1 1 0'};
  max-width: ${props => props.grow ? '420px' : '96px'};
  min-height: 52px;
  border: none;
  border-radius: 10px;
  background: ${props => props.wide ? '#2c3544' : '#f6f3ee'};
  color: ${props => props.wide ? '#f6f3ee' : '#1c1917'};
  font-size: 18px;
  font-weight: 650;
  cursor: pointer;

  &:active {
    background: #3d4fdb;
    color: white;
  }
`;

function isTextField(target: EventTarget | null): target is Field {
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
    return false;
  }
  if (target.disabled || target.readOnly) {
    return false;
  }
  if (target instanceof HTMLTextAreaElement) {
    return true;
  }
  return TEXT_TYPES.has((target.type || 'text').toLowerCase());
}

function writeValue(field: Field, next: string, cursor: number) {
  const prototype = field instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  setter?.call(field, next);
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.setSelectionRange(cursor, cursor);
}

function applyKey(field: Field, key: string, shift: boolean) {
  const start = field.selectionStart ?? field.value.length;
  const end = field.selectionEnd ?? field.value.length;
  if (key === 'backspace') {
    const from = start === end ? Math.max(0, start - 1) : start;
    writeValue(field, field.value.slice(0, from) + field.value.slice(end), from);
    return;
  }
  const text = key === 'space' ? ' ' : (shift && key.length === 1 ? key.toUpperCase() : key);
  writeValue(field, field.value.slice(0, start) + text + field.value.slice(end), start + text.length);
}

const OnScreenKeyboard: React.FC = () => {
  const [field, setField] = useState<Field | null>(null);
  const [layout, setLayout] = useState<Layout>('letters');
  const [shift, setShift] = useState(false);

  useEffect(() => {
    const show = (event: FocusEvent) => {
      if (!isTextField(event.target)) {
        return;
      }
      setField(event.target);
      setLayout(event.target instanceof HTMLInputElement && event.target.type === 'number' ? 'symbols' : 'letters');
      setShift(false);
      window.setTimeout(() => {
        event.target instanceof HTMLElement && event.target.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 50);
    };
    const hide = () => {
      window.setTimeout(() => {
        const active = document.activeElement;
        if (isTextField(active)) {
          setField(active);
          return;
        }
        if (active instanceof HTMLElement && active.closest('[aria-label="On-screen keyboard"]')) {
          return;
        }
        setField(null);
      }, 0);
    };
    document.addEventListener('focusin', show);
    document.addEventListener('focusout', hide);
    return () => {
      document.removeEventListener('focusin', show);
      document.removeEventListener('focusout', hide);
    };
  }, []);

  useEffect(() => {
    document.body.style.paddingBottom = field ? '280px' : '';
    return () => {
      document.body.style.paddingBottom = '';
    };
  }, [field]);

  if (!field) {
    return null;
  }

  const press = (key: string) => {
    if (!field.isConnected) {
      setField(null);
      return;
    }
    field.focus();
    if (key === 'hide') {
      field.blur();
      setField(null);
      return;
    }
    if (key === 'shift') {
      setShift(value => !value);
      return;
    }
    if (key === 'symbols') {
      setLayout('symbols');
      setShift(false);
      return;
    }
    if (key === 'letters') {
      setLayout('letters');
      return;
    }
    applyKey(field, key, shift);
    if (shift) {
      setShift(false);
    }
  };

  const rows = layout === 'letters' ? LETTERS : SYMBOLS;

  return (
    <Dock role="group" aria-label="On-screen keyboard">
      {rows.map(row => (
        <Row key={row.join('')}>
          {row.map(key => {
            const label = key === 'space' ? 'space' : key === 'backspace' ? '⌫' : key === 'shift' ? (shift ? '⇧' : 'shift') : key === 'symbols' ? '123' : key === 'letters' ? 'ABC' : key === 'hide' ? 'hide' : (shift ? key.toUpperCase() : key);
            return (
              <Key
                key={key}
                type="button"
                wide={['shift', 'backspace', 'symbols', 'letters', 'hide'].includes(key)}
                grow={key === 'space'}
                onPointerDown={(event) => {
                  event.preventDefault();
                  press(key);
                }}
              >
                {label}
              </Key>
            );
          })}
        </Row>
      ))}
    </Dock>
  );
};

export default OnScreenKeyboard;
