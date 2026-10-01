import { wakeScreen } from '../components/ScreenSleep';

let pauseCapture: (() => void) | null = null;
let resumeCapture: (() => void) | null = null;

/** Free the mic so speech recognition can open it. */
export function pauseRoomSound(): void {
  pauseCapture?.();
}

export function resumeRoomSound(): void {
  resumeCapture?.();
}

const PREFER = /respeaker|xvf|seeed|xmos|flex|3800|l48k/i;
const SKIP = /hdmi|ahub|monitor/i;
const RMS_WAKE = 0.012;
const HOLD_MS = 200;
const COOLDOWN_MS = 4000;
const RETRY_MS = 8000;
const OPEN_MS = 5000;
const POLL_MS = 80;

const MIC: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: true
};

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('mic timeout')), ms);
    promise.then(
      value => {
        window.clearTimeout(timer);
        resolve(value);
      },
      error => {
        window.clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function isSkipped(device: MediaDeviceInfo): boolean {
  return SKIP.test(device.label) || device.deviceId === 'default' || device.deviceId === 'communications';
}

async function chooseInputs(): Promise<MediaDeviceInfo[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const inputs = devices.filter(device => device.kind === 'audioinput' && !isSkipped(device));
  const preferred = inputs.filter(device => PREFER.test(device.label));
  return preferred.length ? preferred : inputs;
}

async function openMic(): Promise<MediaStream> {
  const inputs = await chooseInputs();
  let last: unknown;
  for (const device of inputs) {
    try {
      return await withTimeout(
        navigator.mediaDevices.getUserMedia({
          audio: { ...MIC, deviceId: { exact: device.deviceId } },
          video: false
        }),
        OPEN_MS
      );
    } catch (error) {
      last = error;
    }
  }
  try {
    return await withTimeout(
      navigator.mediaDevices.getUserMedia({ audio: MIC, video: false }),
      OPEN_MS
    );
  } catch (error) {
    throw last || error;
  }
}

function rms(samples: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const value = (samples[i] - 128) / 128;
    sum += value * value;
  }
  return Math.sqrt(sum / samples.length);
}

/** Open the room mic and call wakeScreen() when the level stays high. */
export function listenForRoomSound(): () => void {
  if (!navigator.mediaDevices?.getUserMedia) {
    return () => undefined;
  }

  let stopped = false;
  let opening = false;
  let stream: MediaStream | null = null;
  let audio: AudioContext | null = null;
  let poll = 0;
  let retry = 0;
  let loudSince = 0;
  let lastWake = 0;

  const release = () => {
    window.clearInterval(poll);
    window.clearTimeout(retry);
    poll = 0;
    stream?.getTracks().forEach(track => track.stop());
    stream = null;
    if (audio) {
      void audio.close();
      audio = null;
    }
  };

  const watch = (mic: MediaStream) => {
    stream = mic;
    const context = new AudioContext();
    audio = context;
    const source = context.createMediaStreamSource(mic);
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.2;
    source.connect(analyser);
    const mute = context.createGain();
    mute.gain.value = 0;
    analyser.connect(mute);
    mute.connect(context.destination);
    const samples = new Uint8Array(analyser.fftSize);
    void context.resume();

    poll = window.setInterval(() => {
      if (context.state === 'suspended') {
        void context.resume();
      }
      analyser.getByteTimeDomainData(samples);
      const level = rms(samples);
      const now = performance.now();
      if (level < RMS_WAKE) {
        loudSince = 0;
        return;
      }
      if (!loudSince) {
        loudSince = now;
      }
      if (now - loudSince < HOLD_MS || now - lastWake < COOLDOWN_MS) {
        return;
      }
      lastWake = now;
      loudSince = 0;
      wakeScreen();
    }, POLL_MS);
  };

  const start = () => {
    if (stopped || opening || stream) {
      return;
    }
    opening = true;
    void openMic()
      .then(mic => {
        opening = false;
        if (stopped) {
          mic.getTracks().forEach(track => track.stop());
          return;
        }
        watch(mic);
      })
      .catch(() => {
        opening = false;
        if (!stopped) {
          retry = window.setTimeout(start, RETRY_MS);
        }
      });
  };

  pauseCapture = () => {
    release();
  };
  resumeCapture = () => {
    if (!stopped && !stream && !opening) {
      start();
    }
  };

  start();
  window.addEventListener('pointerdown', start);
  return () => {
    stopped = true;
    pauseCapture = null;
    resumeCapture = null;
    window.removeEventListener('pointerdown', start);
    release();
  };
}
