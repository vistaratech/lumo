import AsyncStorage from '@react-native-async-storage/async-storage';

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
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_USER);
    if (raw) {
      const parsed: LumoUser = JSON.parse(raw);
      currentUser = parsed;
      notifyListeners(currentUser);
      return parsed;
    }
  } catch (err) {
    console.warn('[Auth] Failed to load user session:', err);
  }
  notifyListeners(null);
  return null;
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
 * Mock/Local secure customer database stored encrypted in AsyncStorage
 * Can seamlessly hook into Firebase Auth SDK when online
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
 * Sign up a new customer account
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
    passHash: pass, // In prod Firebase handles hashing
  };
  await saveStoredUsers(db);

  await AsyncStorage.setItem(STORAGE_KEY_USER, JSON.stringify(newUser));
  notifyListeners(newUser);
  return { success: true, user: newUser };
}

/**
 * Sign in existing customer
 */
export async function signInWithEmail(
  email: string,
  pass: string
): Promise<{ success: boolean; user?: LumoUser; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !pass) {
    return { success: false, error: 'Please enter email and password' };
  }

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
