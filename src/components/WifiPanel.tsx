import React, { useCallback, useEffect, useState } from 'react';
import styled from 'styled-components';
import { FiWifi, FiWifiOff } from 'react-icons/fi';
import { CalendarService, WifiNetwork, WifiStatus } from '../services/calendarService';

interface WifiPanelProps {
  onStatusChange?: (status: WifiStatus) => void;
}

const Section = styled.div`
  margin-bottom: 32px;
`;

const SectionTitle = styled.h3`
  margin: 0 0 16px 0;
  color: var(--hb-text);
  font-size: 18px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const StatusCard = styled.div`
  background: var(--hb-paper);
  border: 1px solid var(--hb-line);
  border-radius: 14px;
  padding: 14px 16px;
  margin-bottom: 16px;
`;

const StatusLine = styled.div`
  font-size: 16px;
  font-weight: 650;
  color: var(--hb-text);
`;

const StatusMeta = styled.div`
  margin-top: 4px;
  color: var(--hb-muted);
  font-size: 14px;
`;

const FormGroup = styled.div`
  margin-bottom: 16px;
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

  &:focus {
    outline: none;
    border-color: var(--hb-accent);
  }
`;

const Hint = styled.p`
  margin: 8px 0 0;
  color: var(--hb-muted);
  font-size: 14px;
`;

const FieldError = styled.p`
  margin: 8px 0 0;
  color: #b42318;
  font-size: 14px;
`;

const NetworkList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 240px;
  overflow-y: auto;
  margin-bottom: 16px;
`;

const NetworkRow = styled.button<{ selected: boolean }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  min-height: 52px;
  padding: 10px 14px;
  border-radius: 12px;
  border: 2px solid ${props => props.selected ? 'var(--hb-accent)' : 'var(--hb-line)'};
  background: ${props => props.selected ? 'var(--hb-accent-soft, #5561d60d)' : 'var(--hb-card)'};
  color: var(--hb-text);
  cursor: pointer;
  text-align: left;
  font-size: 16px;
  font-weight: 600;
`;

const NetworkMeta = styled.span`
  color: var(--hb-muted);
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
`;

const Actions = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
`;

const Button = styled.button`
  padding: 10px 20px;
  min-height: 48px;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;

  &.primary {
    background: var(--hb-accent);
    color: white;
  }

  &.secondary {
    background: var(--hb-paper);
    color: var(--hb-text);
  }

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
`;

function signalLabel(signal: number | null) {
  if (signal == null) {
    return '';
  }
  if (signal >= -60) {
    return 'Strong';
  }
  if (signal >= -75) {
    return 'OK';
  }
  return 'Weak';
}

function describeStatus(status: WifiStatus | null, connecting: boolean) {
  if (connecting) {
    return 'Connecting…';
  }
  if (status?.connected && status.ssid) {
    return status.ssid;
  }
  return 'Not connected';
}

const WifiPanel: React.FC<WifiPanelProps> = ({ onStatusChange }) => {
  const [status, setStatus] = useState<WifiStatus | null>(null);
  const [networks, setNetworks] = useState<WifiNetwork[]>([]);
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [secured, setSecured] = useState(true);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [ready, setReady] = useState(false);

  const applyStatus = useCallback((next: WifiStatus) => {
    setStatus(next);
    onStatusChange?.(next);
  }, [onStatusChange]);

  const loadStatus = useCallback(async () => {
    try {
      const next = await CalendarService.fetchWifi();
      applyStatus(next);
      setError('');
      setReady(true);
      return next;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read Wi-Fi status');
      setReady(true);
      return null;
    }
  }, [applyStatus]);

  const loadScan = useCallback(async () => {
    setScanning(true);
    setError('');
    try {
      const next = await CalendarService.scanWifi();
      setNetworks(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Wi-Fi scan failed');
    } finally {
      setScanning(false);
    }
  }, []);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const next = await loadStatus();
      if (cancel || !next) {
        return;
      }
      await loadScan();
    })();
    return () => {
      cancel = true;
    };
  }, [loadStatus, loadScan]);

  const selectNetwork = (network: WifiNetwork) => {
    setSsid(network.ssid);
    setSecured(network.security === 'wpa');
    setPassword('');
    setError('');
  };

  const handleConnect = async () => {
    const name = ssid.trim();
    if (!name) {
      setError('Enter a Wi-Fi name');
      return;
    }
    setConnecting(true);
    setError('');
    try {
      applyStatus(await CalendarService.setWifi(name, secured ? password : ''));
      const deadline = Date.now() + 20000;
      let joined = false;
      while (Date.now() < deadline) {
        await new Promise(resolve => window.setTimeout(resolve, 2000));
        const next = await loadStatus();
        if (next?.connected && next.ssid === name) {
          joined = true;
          break;
        }
      }
      setPassword('');
      if (!joined) {
        setError('Could not join. Check the password and try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change Wi-Fi');
    } finally {
      setConnecting(false);
    }
  };

  if (!ready) {
    return (
      <Section>
        <SectionTitle>
          <FiWifi />
          Wi-Fi
        </SectionTitle>
        <Hint>Checking Wi-Fi…</Hint>
      </Section>
    );
  }

  const meta = [
    status?.ip,
    signalLabel(status?.signal ?? null),
    status?.iface
  ].filter(Boolean).join(' · ');

  return (
    <Section>
      <SectionTitle>
        {status?.connected ? <FiWifi /> : <FiWifiOff />}
        Wi-Fi
      </SectionTitle>
      <StatusCard>
        <StatusLine>{describeStatus(status, connecting)}</StatusLine>
        {meta ? <StatusMeta>{meta}</StatusMeta> : null}
      </StatusCard>
      <FormGroup>
        <Label>Nearby networks</Label>
        <NetworkList>
          {networks.map(network => (
            <NetworkRow
              key={network.ssid}
              type="button"
              selected={ssid === network.ssid}
              onClick={() => selectNetwork(network)}
            >
              <span>{network.ssid}</span>
              <NetworkMeta>
                {network.security === 'wpa' ? 'Secured' : 'Open'}
                {signalLabel(network.signal) ? ` · ${signalLabel(network.signal)}` : ''}
              </NetworkMeta>
            </NetworkRow>
          ))}
        </NetworkList>
        {!scanning && networks.length === 0 ? <Hint>No networks found yet.</Hint> : null}
      </FormGroup>
      <FormGroup>
        <Label htmlFor="wifi-ssid">Network name</Label>
        <Input
          id="wifi-ssid"
          value={ssid}
          placeholder="Hidden network or type a name"
          onChange={event => {
            setSsid(event.target.value);
            setSecured(true);
          }}
          disabled={connecting}
        />
      </FormGroup>
      {secured ? (
        <FormGroup>
          <Label htmlFor="wifi-password">Password</Label>
          <Input
            id="wifi-password"
            type="password"
            value={password}
            autoComplete="off"
            onChange={event => setPassword(event.target.value)}
            disabled={connecting}
          />
        </FormGroup>
      ) : (
        <Hint>This network is open and does not need a password.</Hint>
      )}
      {error ? <FieldError>{error}</FieldError> : null}
      <Actions>
        <Button className="secondary" type="button" onClick={loadScan} disabled={scanning || connecting}>
          {scanning ? 'Scanning…' : 'Scan again'}
        </Button>
        <Button className="primary" type="button" onClick={handleConnect} disabled={connecting || !ssid.trim()}>
          {connecting ? 'Connecting…' : 'Connect'}
        </Button>
      </Actions>
    </Section>
  );
};

export default WifiPanel;
