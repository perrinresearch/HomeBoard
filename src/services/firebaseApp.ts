import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { Firestore, getFirestore, initializeFirestore, persistentLocalCache } from 'firebase/firestore';

const config = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || '',
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || '',
  appId: process.env.REACT_APP_FIREBASE_APP_ID || ''
};

export function firebaseEnabled(): boolean {
  return Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

export function firebaseAuth(): Auth | null {
  if (!firebaseEnabled()) {
    return null;
  }
  if (!auth) {
    app = getApps()[0] || initializeApp(config);
    auth = getAuth(app);
  }
  return auth;
}

export function firebaseDb(): Firestore | null {
  if (!firebaseEnabled()) {
    return null;
  }
  if (!db) {
    app = getApps()[0] || initializeApp(config);
    try {
      db = initializeFirestore(app, { localCache: persistentLocalCache() });
    } catch (error) {
      db = getFirestore(app);
    }
  }
  return db;
}
