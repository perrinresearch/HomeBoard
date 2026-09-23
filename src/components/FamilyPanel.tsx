import React, { useState } from 'react';
import styled from 'styled-components';
import { ChoreConfig, FamilyMember } from '../types';
import { ChoreService } from '../services/choreService';

const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#5561d6', '#e09f3e', '#9b5de5', '#f15bb5'];

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--hb-line);
  border-radius: 14px;
  background: var(--hb-paper);
`;

const Swatch = styled.button<{ color: string; selected?: boolean }>`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 3px solid ${props => props.selected ? 'var(--hb-text)' : 'transparent'};
  background: ${props => props.color};
  cursor: pointer;
  flex: 0 0 auto;
`;

const Name = styled.input`
  flex: 1;
  min-height: 48px;
  border: 1px solid var(--hb-line);
  border-radius: 12px;
  padding: 0 12px;
  font-size: 18px;
  background: white;
`;

const Quiet = styled.button`
  min-height: 44px;
  border: none;
  background: transparent;
  color: #b42318;
  font-weight: 650;
  cursor: pointer;
`;

const AddRow = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 16px;
  align-items: center;
`;

const AddButton = styled.button`
  min-height: 52px;
  padding: 0 18px;
  border: none;
  border-radius: 12px;
  background: var(--hb-accent);
  color: white;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
  }
`;

const Hint = styled.p`
  margin: 0 0 16px;
  color: var(--hb-muted);
  font-size: 14px;
`;

interface FamilyPanelProps {
  config: ChoreConfig;
  onChange: (config: ChoreConfig) => void;
}

const FamilyPanel: React.FC<FamilyPanelProps> = ({ config, onChange }) => {
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[config.members.length % COLORS.length]);

  const update = (member: FamilyMember, nextName: string, nextColor: string) => {
    onChange(ChoreService.updateFamilyMember(config, member.id, nextName, nextColor));
  };

  return (
    <div>
      <Hint>People on the board share chores, sports, and calendars. Add everyone who should have their own column.</Hint>
      <List>
        {config.members.map(member => (
          <Row key={member.id}>
            <Swatch
              type="button"
              color={member.color}
              selected
              aria-label={`Change color for ${member.name}`}
              onClick={() => {
                const index = COLORS.indexOf(member.color);
                update(member, member.name, COLORS[(index + 1) % COLORS.length]);
              }}
            />
            <Name
              value={member.name}
              aria-label={`${member.name} name`}
              onChange={(event) => update(member, event.target.value, member.color)}
            />
            <Quiet type="button" onClick={() => onChange(ChoreService.removeFamilyMember(config, member.id))}>
              Remove
            </Quiet>
          </Row>
        ))}
      </List>
      <AddRow>
        {COLORS.slice(0, 5).map(swatch => (
          <Swatch
            key={swatch}
            type="button"
            color={swatch}
            selected={color === swatch}
            aria-label={swatch}
            onClick={() => setColor(swatch)}
          />
        ))}
        <Name
          value={name}
          placeholder="Name"
          aria-label="New family member"
          onChange={(event) => setName(event.target.value)}
        />
        <AddButton
          type="button"
          disabled={!name.trim()}
          onClick={() => {
            onChange(ChoreService.addFamilyMember(config, name.trim(), color));
            setName('');
            setColor(COLORS[(config.members.length + 1) % COLORS.length]);
          }}
        >
          Add
        </AddButton>
      </AddRow>
    </div>
  );
};

export default FamilyPanel;
