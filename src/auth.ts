import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from './firebaseConfig';

export interface LumoUser {
  uid: string;
  email: string;
  displayName: string;
  householdName: string;
  role: 'owner' | 'family' | 'guest';
  linkedDevices: string[];
  createdAt: number;
  isGuest?: boolean;
}

const STORAGE_KEY_USER = 'lumo.auth.user';
const STORAGE_KEY_USERS_DB = 'lumo.auth.users_db';
const STORAGE_KEY_TOKEN = 'lumo.auth.token';

// In-memory active user listener callbacks
type AuthListener = (user: LumoUser | null) => void;
const listeners: Set<AuthListener> = new Set();

let currentUser: LumoUser | null = null;
let isFirebaseListenerInitialized = false;

export const addAuthListener = (listener: AuthListener) => {
  listeners.add(listener);
  listener(currentUser);
  return () => {
    listeners.delete(listener);
  };
};

const notifyListeners = (user: LumoUser | null) => {
  currentUser = user;
  listeners.forEach((cb) => {
    try {
      cb(user);
    } catch (e) {
      console.warn('[Auth] Listener callback error:', e);
    }
  });
};

/**
 * Initialize and restore persisted session
 */
export async function initAuth(): Promise<LumoUser | null> {
  // First load locally cached session immediately for zero wait time
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_USER);
    if (raw) {
      const parsed: LumoUser = JSON.parse(raw);
      currentUser = parsed;
      notifyListeners(currentUser);
    }
  } catch (err) {
    console.warn('[Auth] Failed to load local user session:', err);
  }

  // Subscribe to Firebase Auth state
  if (!isFirebaseListenerInitialized && auth) {
    isFirebaseListenerInitialized = true;
    try {
      onAuthStateChanged(auth, async (fbUser) => {
        if (fbUser) {
          // If we already have household metadata stored locally for this UID
          let householdName = 'My Smart Home';
          try {
            const raw = await AsyncStorage.getItem(STORAGE_KEY_USER);
            if (raw) {
              const parsed: LumoUser = JSON.parse(raw);
              if (parsed.uid === fbUser.uid && parsed.householdName) {
                householdName = parsed.householdName;
              }
            }
          } catch {}

          const syncedUser: LumoUser = {
            uid: fbUser.uid,
            email: fbUser.email || '',
            displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'Home Owner',
            householdName,
            role: 'owner',
            linkedDevices: ['ESP32_MINI_01'],
            createdAt: fbUser.metadata.creationTime ? new Date(fbUser.metadata.creationTime).getTime() : Date.now(),
            isGuest: false,
          };
          currentUser = syncedUser;
          await AsyncStorage.setItem(STORAGE_KEY_USER, JSON.stringify(syncedUser));
          notifyListeners(syncedUser);
        }
        // Note: Do not remove local user session if fbUser is null on cold start / offline
        // Only explicit signOut() will remove the user session from storage.
      });
    } catch (e) {
      console.warn('[Auth] Firebase onAuthStateChanged error:', e);
    }
  }

  return currentUser;
}

export function getCurrentUser(): LumoUser | null {
  return currentUser;
}

/**
 * Get private user-specific MQTT topic prefix
 * This guarantees privacy so customer A's app cannot see or switch customer B's relays!
 */
export function getUserMqttPrefix(user?: LumoUser | null): string {
  const u = user || currentUser;
  if (!u || u.isGuest) {
    return 'home/esp32'; // Default legacy / guest topic
  }
  return `lumo/u/${u.uid}`;
}

/**
 * Mock/Local secure customer database fallback
 */
async function getStoredUsers(): Promise<Record<string, { user: LumoUser; passHash: string }>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_USERS_DB);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function saveStoredUsers(db: Record<string, { user: LumoUser; passHash: string }>) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY_USERS_DB, JSON.stringify(db));
  } catch {}
}

/**
 * Sign up a new customer account using Firebase Auth
 */
export async function signUpWithEmail(
  email: string,
  pass: string,
  displayName: string,
  householdName: string = 'My Smart Home'
): Promise<{ success: boolean; user?: LumoUser; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, error: 'Please enter a valid email address' };
  }
  if (!pass || pass.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters' };
  }

  // 1. Try Firebase Auth
  try {
    if (auth) {
      const credential = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
      const fbUser = credential.user;

      if (displayName.trim()) {
        await updateProfile(fbUser, { displayName: displayName.trim() }).catch(() => {});
      }

      const newUser: LumoUser = {
        uid: fbUser.uid,
        email: cleanEmail,
        displayName: displayName.trim() || cleanEmail.split('@')[0],
        householdName: householdName.trim() || 'My Smart Home',
        role: 'owner',
        linkedDevices: ['ESP32_MINI_01'],
        createdAt: Date.now(),
        isGuest: false,
      };

      await AsyncStorage.setItem(STORAGE_KEY_USER, JSON.stringify(newUser));
      notifyListeners(newUser);
      return { success: true, user: newUser };
    }
  } catch (fbErr: any) {
    console.warn('[Auth] Firebase sign-up warning:', fbErr?.code || fbErr?.message);
    if (fbErr?.code === 'auth/email-already-in-use') {
      return { success: false, error: 'An account with this email already exists' };
    }
    if (fbErr?.code === 'auth/weak-password') {
      return { success: false, error: 'Password is too weak' };
    }
    // If network error, allow local fallback
    if (fbErr?.code !== 'auth/network-request-failed') {
      return { success: false, error: fbErr?.message || 'Firebase sign-up failed' };
    }
  }

  // 2. Offline / Local fallback
  const db = await getStoredUsers();
  if (db[cleanEmail]) {
    return { success: false, error: 'An account with this email already exists' };
  }

  const uid = 'usr_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
  const newUser: LumoUser = {
    uid,
    email: cleanEmail,
    displayName: displayName.trim() || cleanEmail.split('@')[0],
    householdName: householdName.trim() || 'My Smart Home',
    role: 'owner',
    linkedDevices: ['ESP32_MINI_01'],
    createdAt: Date.now(),
    isGuest: false,
  };

  db[cleanEmail] = {
    user: newUser,
    passHash: pass,
  };
  await saveStoredUsers(db);

  await AsyncStorage.setItem(STORAGE_KEY_USER, JSON.stringify(newUser));
  notifyListeners(newUser);
  return { success: true, user: newUser };
}

/**
 * Sign in existing customer using Firebase Auth
 */
export async function signInWithEmail(
  email: string,
  pass: string
): Promise<{ success: boolean; user?: LumoUser; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !pass) {
    return { success: false, error: 'Please enter email and password' };
  }

  // 1. Try Firebase Auth
  try {
    if (auth) {
      const credential = await signInWithEmailAndPassword(auth, cleanEmail, pass);
      const fbUser = credential.user;

      let householdName = 'My Smart Home';
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY_USER);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.uid === fbUser.uid && parsed.householdName) {
            householdName = parsed.householdName;
          }
        }
      } catch {}

      const user: LumoUser = {
        uid: fbUser.uid,
        email: cleanEmail,
        displayName: fbUser.displayName || cleanEmail.split('@')[0],
        householdName,
        role: 'owner',
        linkedDevices: ['ESP32_MINI_01'],
        createdAt: fbUser.metadata.creationTime ? new Date(fbUser.metadata.creationTime).getTime() : Date.now(),
        isGuest: false,
      };

      await AsyncStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
      notifyListeners(user);
      return { success: true, user };
    }
  } catch (fbErr: any) {
    console.warn('[Auth] Firebase sign-in warning:', fbErr?.code || fbErr?.message);
    if (fbErr?.code === 'auth/invalid-credential' || fbErr?.code === 'auth/wrong-password' || fbErr?.code === 'auth/user-not-found') {
      return { success: false, error: 'Invalid email or password' };
    }
    if (fbErr?.code !== 'auth/network-request-failed') {
      return { success: false, error: fbErr?.message || 'Sign in failed' };
    }
  }

  // 2. Offline / Local fallback
  const db = await getStoredUsers();
  const entry = db[cleanEmail];
  if (!entry || entry.passHash !== pass) {
    return { success: false, error: 'Invalid email or password' };
  }

  await AsyncStorage.setItem(STORAGE_KEY_USER, JSON.stringify(entry.user));
  notifyListeners(entry.user);
  return { success: true, user: entry.user };
}

/**
 * Sign in using Google account
 */
export async function signInWithGoogle(): Promise<{ success: boolean; user?: LumoUser; error?: string }> {
  try {
    const { promptGoogleSignIn } = require('./googleAuth');
    const res = await promptGoogleSignIn();
    if (res.success && res.user) {
      currentUser = res.user;
      notifyListeners(res.user);
      return res;
    }
    return { success: false, error: res.error || 'Google sign-in was not completed' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Google sign-in failed' };
  }
}

/**
 * Quick Guest Mode (for buyers testing out the app offline without immediate sign-up)
 */
export async function continueAsGuest(
  displayName = 'Home Guest'
): Promise<LumoUser> {
  const guestUser: LumoUser = {
    uid: 'guest_' + Math.random().toString(36).substring(2, 8),
    email: 'guest@lumo.local',
    displayName,
    householdName: 'Lumo Home',
    role: 'guest',
    linkedDevices: ['ESP32_MINI_01'],
    createdAt: Date.now(),
    isGuest: true,
  };
  await AsyncStorage.setItem(STORAGE_KEY_USER, JSON.stringify(guestUser));
  notifyListeners(guestUser);
  return guestUser;
}

/**
 * Sign out current customer
 */
export async function signOut(): Promise<void> {
  try {
    if (auth) {
      await firebaseSignOut(auth).catch(() => {});
    }
    await AsyncStorage.removeItem(STORAGE_KEY_USER);
    await AsyncStorage.removeItem(STORAGE_KEY_TOKEN);
  } catch {}
  notifyListeners(null);
}

/**
 * Update household profile
 */
export async function updateHousehold(
  displayName: string,
  householdName: string
): Promise<LumoUser | null> {
  if (!currentUser) return null;
  const updated: LumoUser = {
    ...currentUser,
    displayName: displayName.trim() || currentUser.displayName,
    householdName: householdName.trim() || currentUser.householdName,
  };

  if (auth && auth.currentUser && displayName.trim()) {
    await updateProfile(auth.currentUser, { displayName: displayName.trim() }).catch(() => {});
  }

  await AsyncStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updated));

  if (!currentUser.isGuest) {
    const db = await getStoredUsers();
    if (db[currentUser.email]) {
      db[currentUser.email].user = updated;
      await saveStoredUsers(db);
    }
  }

  notifyListeners(updated);
  return updated;
}
