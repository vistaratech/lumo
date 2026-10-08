import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, initializeAuth } from 'firebase/auth';
// @ts-ignore - React Native specific persistence export from Firebase
import { getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export const firebaseConfig = {
  apiKey: "AIzaSyA4_62wm9ixpYOJnQGdtl1VnklFrmhTgss",
  authDomain: "lumo-ind.firebaseapp.com",
  projectId: "lumo-ind",
  storageBucket: "lumo-ind.firebasestorage.app",
  messagingSenderId: "1087681119264",
  appId: "1:1087681119264:ios:b5177ffe375ab76470e845",
};

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase Auth with persistent native AsyncStorage
let auth: any;
if (Platform.OS === 'web') {
  auth = getAuth(app);
} else {
  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    auth = getAuth(app);
  }
}

export { auth, app };
