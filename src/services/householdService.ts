import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User
} from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { AppState, CalendarEvent, Chore, FamilyMember, ShoppingItem, Sport } from '../types';
import { firebaseAuth, firebaseDb, firebaseEnabled } from './firebaseApp';
import { normalizeAppState } from './storageService';

const CODE_KEY = 'homeboard.householdCode';
const EMAIL_KEY = 'homeboard.householdEmail';
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export interface HouseholdRecord {
  email: string;
  members: FamilyMember[];
  chores: Chore[];
  shopping: ShoppingItem[];
  localEvents: CalendarEvent[];
  sports: Sport[];
  remoteEvents: CalendarEvent[];
}

let activeUid: string | null = null;

export function householdUid(): string | null {
  return activeUid;
}

export function savedJoinCode(): string {
  return window.localStorage.getItem(CODE_KEY) || '';
}

export function savedHouseholdEmail(): string {
  return window.localStorage.getItem(EMAIL_KEY) || '';
}

function generateCode(): string {
  const bytes = new Uint8Array(8);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
}

function jsonReady<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function revive(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(revive);
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (typeof child === 'string' && ['start', 'end', 'nextDue', 'lastCompleted', 'date'].includes(key) && !Number.isNaN(Date.parse(child))) {
        result[key] = new Date(child);
      } else {
        result[key] = revive(child);
      }
    }
    return result;
  }
  return value;
}

export function sharedSlice(state: AppState) {
  return {
    members: state.familyMembers,
    chores: state.choreConfig.chores,
    shopping: state.shoppingList,
    localEvents: state.calendarConfig.events,
    sports: state.sportsConfig.sports
  };
}

export function applyHousehold(prev: AppState, data: HouseholdRecord): AppState {
  const members = data.members.length ? data.members : prev.familyMembers;
  return normalizeAppState({
    ...prev,
    familyMembers: members,
    choreConfig: { members, chores: data.chores },
    shoppingList: data.shopping,
    calendarConfig: {
      ...prev.calendarConfig,
      events: data.localEvents
    },
    sportsConfig: { members, sports: data.sports },
    settings: prev.settings,
    widgets: prev.widgets,
    weatherLocations: prev.weatherLocations
  });
}

function recordFromSnapshot(data: Record<string, unknown>): HouseholdRecord {
  const revived = revive(data) as Partial<HouseholdRecord>;
  return {
    email: typeof revived.email === 'string' ? revived.email : '',
    members: revived.members || [],
    chores: revived.chores || [],
    shopping: revived.shopping || [],
    localEvents: revived.localEvents || [],
    sports: revived.sports || [],
    remoteEvents: revived.remoteEvents || []
  };
}

export function parseCloudEvents(events: CalendarEvent[]): CalendarEvent[] {
  return events.map((event) => {
    const startValue = event.start instanceof Date ? event.start : new Date(event.start);
    const endValue = event.end instanceof Date ? event.end : new Date(event.end);
    const allDay = Boolean(event.allDay) || (typeof event.start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(event.start));
    const start = allDay
      ? new Date(startValue.getUTCFullYear(), startValue.getUTCMonth(), startValue.getUTCDate())
      : startValue;
    const end = allDay
      ? new Date(endValue.getUTCFullYear(), endValue.getUTCMonth(), endValue.getUTCDate())
      : endValue;
    return { ...event, start, end, allDay };
  });
}

async function registerWithBroker(uid: string) {
  try {
    await fetch('/api/household', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: uid })
    });
  } catch {
    // The board still copies remote events itself when it can reach the broker.
  }
}

export async function createHousehold(email: string, state: AppState): Promise<string> {
  const auth = firebaseAuth();
  const db = firebaseDb();
  if (!auth || !db) {
    throw new Error('Firebase is not configured for this build');
  }
  const code = generateCode();
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), code);
  window.localStorage.setItem(CODE_KEY, code);
  window.localStorage.setItem(EMAIL_KEY, email.trim());
  await setDoc(doc(db, 'households', credential.user.uid), {
    email: email.trim(),
    ...jsonReady(sharedSlice(state)),
    remoteEvents: []
  }, { merge: true });
  await registerWithBroker(credential.user.uid);
  return code;
}

export async function joinHousehold(email: string, code: string): Promise<void> {
  const auth = firebaseAuth();
  if (!auth) {
    throw new Error('Firebase is not configured for this build');
  }
  const credential = await signInWithEmailAndPassword(auth, email.trim(), code.trim());
  window.localStorage.setItem(CODE_KEY, code.trim());
  window.localStorage.setItem(EMAIL_KEY, email.trim());
  await registerWithBroker(credential.user.uid);
}

export async function leaveHousehold(): Promise<void> {
  const auth = firebaseAuth();
  if (!auth) {
    return;
  }
  await signOut(auth);
}

export async function pushHousehold(uid: string, state: AppState): Promise<void> {
  const db = firebaseDb();
  if (!db) {
    return;
  }
  await setDoc(doc(db, 'households', uid), jsonReady(sharedSlice(state)), { merge: true });
}

export async function pushRemoteEvents(events: CalendarEvent[]): Promise<void> {
  const db = firebaseDb();
  if (!db || !activeUid) {
    return;
  }
  await setDoc(doc(db, 'households', activeUid), {
    remoteEvents: jsonReady(events)
  }, { merge: true });
}

export function watchHouseholdUser(onUser: (user: User | null) => void): () => void {
  const auth = firebaseAuth();
  if (!auth) {
    onUser(null);
    return () => undefined;
  }
  return onAuthStateChanged(auth, (user) => {
    activeUid = user?.uid || null;
    if (user) {
      void registerWithBroker(user.uid);
    }
    onUser(user);
  });
}

export function watchHousehold(
  uid: string,
  onData: (data: HouseholdRecord) => void,
  onMissing: () => void
): () => void {
  const db = firebaseDb();
  if (!db) {
    return () => undefined;
  }
  return onSnapshot(doc(db, 'households', uid), (snapshot) => {
    if (!snapshot.exists()) {
      onMissing();
      return;
    }
    onData(recordFromSnapshot(snapshot.data() as Record<string, unknown>));
  });
}

export function useHouseholdSync(
  appState: AppState,
  setAppState: Dispatch<SetStateAction<AppState>>,
  onCloudEvents: (events: CalendarEvent[]) => void
): void {
  const appStateRef = useRef(appState);
  appStateRef.current = appState;
  const onCloudEventsRef = useRef(onCloudEvents);
  onCloudEventsRef.current = onCloudEvents;
  const armed = useRef(false);
  const lastRemote = useRef('');
  const [uid, setUid] = useState<string | null>(null);
  const sharedKey = JSON.stringify(sharedSlice(appState));

  useEffect(() => {
    if (!firebaseEnabled()) {
      return undefined;
    }
    return watchHouseholdUser((user) => {
      setUid(user?.uid || null);
    });
  }, []);

  useEffect(() => {
    armed.current = false;
    lastRemote.current = '';
    if (!uid) {
      return undefined;
    }
    return watchHousehold(uid, (data) => {
      const next = applyHousehold(appStateRef.current, data);
      lastRemote.current = JSON.stringify(sharedSlice(next));
      armed.current = true;
      onCloudEventsRef.current(parseCloudEvents(data.remoteEvents || []));
      setAppState(next);
    }, () => {
      armed.current = true;
      void pushHousehold(uid, appStateRef.current);
    });
  }, [uid, setAppState]);

  useEffect(() => {
    if (!uid || !armed.current || sharedKey === lastRemote.current) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      lastRemote.current = sharedKey;
      void pushHousehold(uid, appStateRef.current);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [sharedKey, uid]);
}
