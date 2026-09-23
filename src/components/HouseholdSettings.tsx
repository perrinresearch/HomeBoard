import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { onAuthStateChanged } from 'firebase/auth';
import { AppState } from '../types';
import { firebaseAuth, firebaseEnabled } from '../services/firebaseApp';
import {
  createHousehold,
  joinHousehold,
  leaveHousehold,
  savedHouseholdEmail,
  savedJoinCode
} from '../services/householdService';

const Section = styled.div`
  margin-bottom: 32px;
`;

const SectionTitle = styled.h3`
  margin: 0 0 16px 0;
  color: var(--hb-text);
  font-size: 18px;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: var(--hb-text);
  font-size: 14px;
`;

const Input = styled.input`
  width: 100%;
  min-height: 52px;
  padding: 10px;
  border: 1px solid var(--hb-line);
  border-radius: 12px;
  font-size: 18px;
  box-sizing: border-box;
`;

const Row = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 12px;
`;

const Button = styled.button`
  min-height: 48px;
  padding: 0 16px;
  border: none;
  border-radius: 12px;
  background: var(--hb-accent);
  color: white;
  font-size: 16px;
  font-weight: 650;
  cursor: pointer;

  &.quiet {
    background: var(--hb-paper);
    color: var(--hb-text);
  }

  &:disabled {
    opacity: 0.6;
  }
`;

const Hint = styled.p`
  margin: 8px 0 0;
  color: var(--hb-muted);
  font-size: 14px;
`;

const Code = styled.div`
  margin-top: 12px;
  font-size: 32px;
  font-weight: 700;
  letter-spacing: 0.18em;
`;

const ErrorText = styled.p`
  margin: 8px 0 0;
  color: #b42318;
  font-size: 14px;
`;

interface HouseholdSettingsProps {
  appState: AppState;
}

const HouseholdSettings: React.FC<HouseholdSettingsProps> = ({ appState }) => {
  const [email, setEmail] = useState(savedHouseholdEmail());
  const [code, setCode] = useState('');
  const [joinCode, setJoinCode] = useState(savedJoinCode());
  const [signedInEmail, setSignedInEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const auth = firebaseAuth();
    if (!auth) {
      return undefined;
    }
    return onAuthStateChanged(auth, (user) => {
      setSignedInEmail(user?.email || '');
      setJoinCode(savedJoinCode());
    });
  }, []);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update the household');
    } finally {
      setBusy(false);
    }
  };

  if (!firebaseEnabled()) {
    return (
      <Section>
        <SectionTitle>Household</SectionTitle>
        <Hint>
          Add the Firebase keys to the build to share chores, shopping, and the calendar with phones.
        </Hint>
      </Section>
    );
  }

  return (
    <Section>
      <SectionTitle>Household</SectionTitle>
      {signedInEmail ? (
        <>
          <Hint>Signed in as {signedInEmail}. Phones join with this email and the code below.</Hint>
          {joinCode ? <Code>{joinCode}</Code> : <Hint>The join code is saved on this board after you create or join.</Hint>}
          <Row>
            <Button className="quiet" type="button" disabled={busy} onClick={() => run(leaveHousehold)}>
              Sign out
            </Button>
          </Row>
        </>
      ) : (
        <>
          <Label htmlFor="household-email">Email</Label>
          <Input
            id="household-email"
            type="email"
            value={email}
            autoComplete="off"
            onChange={(event) => setEmail(event.target.value)}
          />
          <Label htmlFor="household-code">Join code</Label>
          <Input
            id="household-code"
            value={code}
            autoComplete="off"
            placeholder="From the board"
            onChange={(event) => setCode(event.target.value)}
          />
          <Row>
            <Button type="button" disabled={busy || !email.includes('@')} onClick={() => run(async () => {
              const created = await createHousehold(email, appState);
              setJoinCode(created);
              setCode('');
            })}>
              Create household
            </Button>
            <Button className="quiet" type="button" disabled={busy || !email.includes('@') || code.trim().length < 6} onClick={() => run(async () => {
              await joinHousehold(email, code);
              setJoinCode(code.trim());
            })}>
              Join
            </Button>
          </Row>
          <Hint>Create a household on the board, then enter the same email and code on a phone.</Hint>
        </>
      )}
      {error ? <ErrorText>{error}</ErrorText> : null}
    </Section>
  );
};

export default HouseholdSettings;
