import React, { useEffect, useState } from 'react';
import styled, { css, keyframes } from 'styled-components';
import { FiMic } from 'react-icons/fi';
import { speakWakeWord, subscribeVoice, voiceSnapshot } from '../services/voiceListen';
import { unlockAlarm } from '../services/alarm';

const pulse = keyframes`
  0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.35); }
  50% { transform: scale(1.06); box-shadow: 0 0 0 10px rgba(255, 255, 255, 0); }
`;

const wakePop = keyframes`
  0% { transform: scale(1); }
  35% { transform: scale(1.12); }
  100% { transform: scale(1.04); }
`;

type Mode = 'off' | 'idle' | 'sound' | 'wake' | 'listen';

const Chip = styled.button<{ $mode: Mode }>`
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  min-height: 40px;
  padding: 6px 14px 10px;
  border: none;
  border-radius: 18px;
  color: white;
  font: inherit;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.01em;
  cursor: pointer;
  touch-action: manipulation;
  transition: background 0.15s ease, transform 0.15s ease;

  ${props => props.$mode === 'off' && css`
    background: #4b5563;
    opacity: 0.85;
  `}
  ${props => props.$mode === 'idle' && css`
    background: #334155;
  `}
  ${props => props.$mode === 'sound' && css`
    background: #0f766e;
  `}
  ${props => props.$mode === 'wake' && css`
    background: #ca8a04;
    animation: ${wakePop} 0.35s ease-out;
  `}
  ${props => props.$mode === 'listen' && css`
    background: var(--hb-accent, #2563eb);
    font-size: 17px;
    padding: 8px 16px 12px;
    animation: ${pulse} 1s ease-in-out infinite;
  `}
`;

const Meter = styled.span<{ $level: number }>`
  position: absolute;
  left: 0;
  bottom: 0;
  height: 5px;
  width: ${props => Math.round(props.$level * 100)}%;
  background: #f8fafc;
  opacity: 0.9;
  pointer-events: none;
`;

function modeOf(voice: ReturnType<typeof voiceSnapshot>): Mode {
  if (voice.woke) {
    return 'wake';
  }
  if (voice.listening) {
    return 'listen';
  }
  if (!voice.connected) {
    return 'off';
  }
  if (voice.hearing) {
    return 'sound';
  }
  return 'idle';
}

function labelOf(mode: Mode): string {
  if (mode === 'wake') {
    return 'HomeBoard';
  }
  if (mode === 'listen') {
    return 'Listening';
  }
  if (mode === 'sound') {
    return 'Hearing';
  }
  if (mode === 'off') {
    return 'Voice off';
  }
  return 'Say HomeBoard';
}

const VoiceListenChip: React.FC = () => {
  const [voice, setVoice] = useState(voiceSnapshot);
  const mode = modeOf(voice);

  useEffect(() => subscribeVoice(() => setVoice(voiceSnapshot())), []);

  return (
    <Chip
      type="button"
      $mode={mode}
      aria-live="polite"
      aria-label={labelOf(mode) + '. Tap to hear the wake word.'}
      onPointerDown={() => unlockAlarm()}
      onClick={() => speakWakeWord()}
    >
      <FiMic size={mode === 'listen' || mode === 'wake' ? 18 : 16} />
      {labelOf(mode)}
      <Meter $level={voice.level} />
    </Chip>
  );
};

export default VoiceListenChip;
