import React, { useCallback, useEffect, useState } from 'react';
import styled from 'styled-components';
import { FamilyMember } from '../types';
import { AppleFeed, CalendarService, RemoteAccount, RemoteCalendar, calendarOwners } from '../services/calendarService';

const PEOPLE = 'household';

function sharedWith(ids: string[], current: string, members: FamilyMember[]): string {
  const names = ids
    .filter(id => id !== current)
    .map(id => (id === PEOPLE ? 'Household' : members.find(member => member.id === id)?.name))
    .filter((name): name is string => Boolean(name));
  return names.length ? `Also ${names.join(', ')}` : '';
}

const People = styled.div`
  display: flex;
  gap: 8px;
  overflow-x: auto;
  margin-bottom: 16px;
  padding-bottom: 4px;
`;

const Person = styled.button<{ active: boolean; color: string }>`
  min-height: 48px;
  padding: 0 16px;
  border-radius: 999px;
  border: 2px solid ${props => props.active ? props.color : 'var(--hb-line)'};
  background: ${props => props.active ? props.color : 'white'};
  color: ${props => props.active ? 'white' : 'var(--hb-text)'};
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
`;

const Block = styled.div`
  border: 1px solid var(--hb-line);
  border-radius: 16px;
  padding: 14px 16px;
  margin-bottom: 12px;
  background: var(--hb-paper);
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 48px;
`;

const Hint = styled.p`
  margin: 0 0 12px;
  color: var(--hb-muted);
  font-size: 14px;
`;

const ErrorText = styled.p`
  margin: 0 0 12px;
  color: #b42318;
`;

const Button = styled.button`
  min-height: 44px;
  padding: 0 14px;
  border: none;
  border-radius: 12px;
  background: var(--hb-accent);
  color: white;
  font-weight: 700;
  cursor: pointer;

  &.quiet {
    background: white;
    color: var(--hb-text);
    border: 1px solid var(--hb-line);
  }
`;

const Input = styled.input`
  flex: 1;
  min-height: 48px;
  border: 1px solid var(--hb-line);
  border-radius: 12px;
  padding: 0 12px;
  font-size: 16px;
`;

interface CalendarConnectionsProps {
  members: FamilyMember[];
}

const CalendarConnections: React.FC<CalendarConnectionsProps> = ({ members }) => {
  const [person, setPerson] = useState(members[0]?.id || PEOPLE);
  const [google, setGoogle] = useState<RemoteAccount[]>([]);
  const [microsoft, setMicrosoft] = useState<RemoteAccount[]>([]);
  const [apple, setApple] = useState<AppleFeed[]>([]);
  const [appleUrl, setAppleUrl] = useState('');
  const [error, setError] = useState('');

  const applySources = (sources: { google: RemoteAccount[]; microsoft: RemoteAccount[]; apple: AppleFeed[] }) => {
    setGoogle(sources.google);
    setMicrosoft(sources.microsoft);
    setApple(sources.apple);
  };

  const load = useCallback(async () => {
    applySources(await CalendarService.fetchSources());
  }, []);

  useEffect(() => {
    load().catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not load calendars'));
  }, [load]);

  const personId = person === 'unassigned' ? '' : person;
  const includesPerson = (item: { familyMemberId?: string; familyMemberIds?: string[] }) => {
    const owners = calendarOwners(item);
    if (!personId) {
      return owners.length === 0;
    }
    return owners.includes(personId);
  };
  const owned = <T extends { familyMemberId?: string; familyMemberIds?: string[] }>(items: T[]) => (
    items.filter(includesPerson)
  );

  const assign = async (
    provider: 'google' | 'microsoft' | 'apple',
    id: string,
    owner: string,
    accountId = '',
    action: 'add' | 'remove' = 'add'
  ) => {
    setError('');
    try {
      const sources = await CalendarService.setOwner(provider, id, owner, accountId, action);
      applySources(sources);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not assign that calendar');
    }
  };

  const connect = (provider: 'google' | 'microsoft') => {
    sessionStorage.setItem('homeboard.pendingCalendarOwner', person === 'unassigned' ? '' : person);
    window.location.assign(CalendarService.connectUrl(provider));
  };

  const addApple = async () => {
    setError('');
    try {
      const feed = await CalendarService.addApple(appleUrl);
      setAppleUrl('');
      if (person !== 'unassigned') {
        await assign('apple', feed.id, person);
      } else {
        await load();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not add that Apple calendar');
    }
  };

  const renderProvider = (provider: 'google' | 'microsoft', accounts: RemoteAccount[]) => {
    const label = provider === 'google' ? 'Gmail' : 'Microsoft';
    return (
      <Block>
        <Row>
          <strong style={{ flex: 1 }}>{label}</strong>
          <Button type="button" onClick={() => connect(provider)}>Add account</Button>
        </Row>
        {accounts.length === 0 ? <Hint>No {label} account connected.</Hint> : null}
        {accounts.map(account => {
          const mine = owned(account.calendars);
          const others = account.calendars.filter(calendar => !includesPerson(calendar));
          return (
            <div key={account.id}>
              <Row>
                <span style={{ flex: 1 }}>{account.email || 'Connected account'}</span>
                <Button className="quiet" type="button" onClick={async () => {
                  setError('');
                  try {
                    applySources(await CalendarService.disconnect(provider, account.id));
                  } catch (caught) {
                    setError(caught instanceof Error ? caught.message : 'Could not disconnect');
                  }
                }}>Disconnect</Button>
              </Row>
              {mine.map(calendar => (
                <CalendarRow
                  key={`${account.id}:${calendar.id}`}
                  calendar={calendar}
                  onToggle={(enabled) => {
                    void CalendarService.setCalendarEnabled(provider, calendar.id, enabled, account.id).then(applySources)
                      .catch(caught => setError(caught instanceof Error ? caught.message : 'Could not update that calendar'));
                  }}
                  onClear={personId ? () => assign(provider, calendar.id, personId, account.id, 'remove') : undefined}
                  shared={sharedWith(calendarOwners(calendar), personId, members)}
                />
              ))}
              {person !== 'unassigned' && others.length > 0 && (
                <Row>
                  <select
                    aria-label={`Add a ${label} calendar for this person`}
                    defaultValue=""
                    onChange={(event) => {
                      const id = event.target.value;
                      event.target.value = '';
                      if (id) {
                        void assign(provider, id, person, account.id);
                      }
                    }}
                  >
                    <option value="">Add a calendar from {account.email || label}</option>
                    {others.map(calendar => (
                      <option key={calendar.id} value={calendar.id}>{calendar.name}</option>
                    ))}
                  </select>
                </Row>
              )}
            </div>
          );
        })}
      </Block>
    );
  };

  const appleMine = owned(apple);
  const appleOthers = apple.filter(feed => !includesPerson(feed));

  return (
    <div>
      <Hint>A calendar can belong to more than one person. Adding it here keeps everyone else who already has it.</Hint>
      {error ? <ErrorText>{error}</ErrorText> : null}
      <People>
        <Person type="button" active={person === PEOPLE} color="#5561d6" onClick={() => setPerson(PEOPLE)}>Household</Person>
        {members.map(member => (
          <Person key={member.id} type="button" active={person === member.id} color={member.color} onClick={() => setPerson(member.id)}>
            {member.name}
          </Person>
        ))}
        <Person type="button" active={person === 'unassigned'} color="#6b6258" onClick={() => setPerson('unassigned')}>Unassigned</Person>
      </People>
      {renderProvider('google', google)}
      {renderProvider('microsoft', microsoft)}
      <Block>
        <strong>Apple</strong>
        <Hint>Paste a webcal or https share link.</Hint>
        {appleMine.map(feed => (
          <Row key={feed.id}>
            <span style={{ flex: 1 }}>{feed.name}</span>
            <span style={{ color: 'var(--hb-muted)', fontSize: 13 }}>{sharedWith(calendarOwners(feed), personId, members)}</span>
            {personId ? <Button className="quiet" type="button" onClick={() => assign('apple', feed.id, personId, '', 'remove')}>Remove</Button> : null}
          </Row>
        ))}
        {person !== 'unassigned' && appleOthers.length > 0 && (
          <Row>
            <select
              aria-label="Add an Apple calendar for this person"
              defaultValue=""
              onChange={(event) => {
                const id = event.target.value;
                event.target.value = '';
                if (id) {
                  void assign('apple', id, person);
                }
              }}
            >
              <option value="">Add another Apple calendar</option>
              {appleOthers.map(feed => <option key={feed.id} value={feed.id}>{feed.name}</option>)}
            </select>
          </Row>
        )}
        <Row>
          <Input
            value={appleUrl}
            placeholder="webcal://..."
            aria-label="Apple calendar link"
            onChange={(event) => setAppleUrl(event.target.value)}
          />
          <Button type="button" onClick={addApple}>Add</Button>
        </Row>
      </Block>
    </div>
  );
};

const CalendarRow: React.FC<{
  calendar: RemoteCalendar;
  shared?: string;
  onToggle: (enabled: boolean) => void;
  onClear?: () => void;
}> = ({ calendar, shared, onToggle, onClear }) => (
  <Row>
    <input type="checkbox" checked={calendar.enabled} onChange={(event) => onToggle(event.target.checked)} />
    <span style={{ flex: 1 }}>
      {calendar.name}
      {shared ? <span style={{ display: 'block', color: 'var(--hb-muted)', fontSize: 13, fontWeight: 500 }}>{shared}</span> : null}
    </span>
    {onClear ? <Button className="quiet" type="button" onClick={onClear}>Remove</Button> : null}
  </Row>
);

export default CalendarConnections;
