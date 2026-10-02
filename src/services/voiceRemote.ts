import { commandFromRemote, RemoteVoicePayload, VoiceCommand } from './voiceParse';

export type VoiceMode = 'off' | 'workstation' | 'cloud';

export interface VoiceConfig {
  mode: VoiceMode;
  ollamaUrl: string;
  ollamaModel: string;
  cloudReady: boolean;
}

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (body as { error?: string }).error || 'Voice service is not available';
    throw new Error(message);
  }
  return body as T;
}

export async function fetchVoiceConfig(): Promise<VoiceConfig> {
  const response = await fetch('/api/voice/config', { cache: 'no-store' });
  return readJson<VoiceConfig>(response);
}

export async function saveVoiceConfig(config: Pick<VoiceConfig, 'mode' | 'ollamaUrl' | 'ollamaModel'>): Promise<VoiceConfig> {
  const response = await fetch('/api/voice/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  });
  return readJson<VoiceConfig>(response);
}

export async function fetchVoiceModels(ollamaUrl: string): Promise<string[]> {
  const query = ollamaUrl.trim() ? `?url=${encodeURIComponent(ollamaUrl.trim())}` : '';
  const response = await fetch(`/api/voice/models${query}`, { cache: 'no-store' });
  const body = await readJson<{ models?: string[] }>(response);
  return Array.isArray(body.models) ? body.models : [];
}

export async function interpretRemote(spoken: string, context = ''): Promise<{ command: VoiceCommand | null; reply: string } | null> {
  const text = spoken.trim();
  if (!text) {
    return null;
  }
  try {
    const response = await fetch('/api/voice/interpret', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, context: context.trim() })
    });
    const body = await readJson<RemoteVoicePayload>(response);
    const command = commandFromRemote(body);
    const reply = (body.reply || '').trim();
    if (!command && !reply) {
      return null;
    }
    return { command, reply };
  } catch {
    return null;
  }
}
