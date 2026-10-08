import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

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

// Initialize Firebase Auth
export const auth = getAuth(app);

export { app };
