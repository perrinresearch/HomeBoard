import React from 'react';
import styled from 'styled-components';
import { FiX } from 'react-icons/fi';
import { AppSettings, AppState, ChoreConfig, SportsConfig } from '../types';
import { WifiStatus } from '../services/calendarService';
import Settings from './Settings';
import FamilyPanel from './FamilyPanel';
import CalendarConnections from './CalendarConnections';
import SportsWidget from './SportsWidget';

export type ConfigSection = 'family' | 'calendars' | 'sports' | 'appearance' | 'board';

const SECTIONS: { id: ConfigSection; label: string }[] = [
  { id: 'family', label: 'Family' },
  { id: 'calendars', label: 'Calendars' },
  { id: 'sports', label: 'Sports' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'board', label: 'Board' }
];

const Scrim = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(31, 35, 40, 0.28);
  backdrop-filter: blur(6px);
  z-index: 1600;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
`;

const Sheet = styled.div`
  width: min(980px, 100%);
  max-height: 86vh;
  background: var(--hb-card);
  color: var(--hb-text);
  border-radius: 24px;
  box-shadow: 0 24px 64px rgba(16, 24, 40, 0.16);
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px 0;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 24px;
`;

const Close = styled.button`
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 12px;
  background: transparent;
  color: var(--hb-muted);
  cursor: pointer;
`;

const Menu = styled.div`
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 16px 20px;
  border-bottom: 1px solid var(--hb-line);
`;

const Tab = styled.button<{ active: boolean }>`
  min-height: 44px;
  padding: 0 16px;
  border-radius: 999px;
  border: 1px solid ${props => props.active ? 'var(--hb-accent)' : 'var(--hb-line)'};
  background: ${props => props.active ? 'var(--hb-accent)' : 'white'};
  color: ${props => props.active ? 'white' : 'var(--hb-text)'};
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
`;

const Body = styled.div`
  overflow: auto;
  padding: 20px;
`;

interface ConfigShellProps {
  section: ConfigSection;
  appState: AppState;
  onSection: (section: ConfigSection) => void;
  onClose: () => void;
  onSettingsChange: (settings: AppSettings) => void;
  onChoresChange: (config: ChoreConfig) => void;
  onSportsChange: (config: SportsConfig) => void;
  onWifiChange?: (status: WifiStatus) => void;
}

const ConfigShell: React.FC<ConfigShellProps> = ({
  section,
  appState,
  onSection,
  onClose,
  onSettingsChange,
  onChoresChange,
  onSportsChange,
  onWifiChange
}) => (
  <Scrim onClick={onClose}>
    <Sheet onClick={(event) => event.stopPropagation()}>
      <Header>
        <Title>Settings</Title>
        <Close type="button" aria-label="Close settings" onClick={onClose}>
          <FiX size={22} />
        </Close>
      </Header>
      <Menu>
        {SECTIONS.map(item => (
          <Tab key={item.id} type="button" active={section === item.id} onClick={() => onSection(item.id)}>
            {item.label}
          </Tab>
        ))}
      </Menu>
      <Body>
        {section === 'family' && (
          <FamilyPanel config={appState.choreConfig} onChange={onChoresChange} />
        )}
        {section === 'calendars' && (
          <CalendarConnections members={appState.familyMembers} />
        )}
        {section === 'sports' && (
          <SportsWidget config={appState.sportsConfig} onConfigChange={onSportsChange} />
        )}
        {(section === 'appearance' || section === 'board') && (
          <Settings
            embedded
            panel={section}
            settings={appState.settings}
            appState={appState}
            onSettingsChange={onSettingsChange}
            onWifiChange={onWifiChange}
            onClose={onClose}
          />
        )}
      </Body>
    </Sheet>
  </Scrim>
);

export default ConfigShell;
