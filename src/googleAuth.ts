import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import {
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
} from 'firebase/auth';
import { auth } from './firebaseConfig';
import { LumoUser } from './auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

WebBrowser.maybeCompleteAuthSession();

export const GOOGLE_CONFIG = {
  iosClientId: '1087681119264-ul56sv4ue86edpr5vfkqkd4dlsbjl3j1.apps.googleusercontent.com',
  webClientId: '1087681119264-ul56sv4ue86edpr5vfkqkd4dlsbjl3j1.apps.googleusercontent.com',
  reversedClientId: 'com.googleusercontent.apps.1087681119264-ul56sv4ue86edpr5vfkqkd4dlsbjl3j1',
};

const STORAGE_KEY_USER = 'lumo.auth.user';

/**
 * Execute real Google Sign-In with Firebase
 */
export async function promptGoogleSignIn(): Promise<{
  success: boolean;
  user?: LumoUser;
  error?: string;
}> {
  try {
    // 1. Web Environment: Use standard Firebase Google popup
    if (Platform.OS === 'web') {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const cred = await signInWithPopup(auth, provider);
      const fbUser = cred.user;

      const lumoUser: LumoUser = {
        uid: fbUser.uid,
        email: fbUser.email || 'user@gmail.com',
        displayName: fbUser.displayName || 'Google User',
        householdName: `${fbUser.displayName || 'My'}'s Home`,
        role: 'owner',
        linkedDevices: ['ESP32_MINI_01'],
        createdAt: Date.now(),
        isGuest: false,
      };

      await AsyncStorage.setItem(STORAGE_KEY_USER, JSON.stringify(lumoUser));
      return { success: true, user: lumoUser };
    }

    // 2. Mobile (iOS / Android) Environment
    // On iOS Google requires the custom scheme to match the reversed client ID
    const redirectUri =
      Platform.OS === 'ios'
        ? `${GOOGLE_CONFIG.reversedClientId}:/oauth2redirect/google`
        : AuthSession.makeRedirectUri({
            scheme: 'lumo',
            path: 'auth',
          });

    const clientId = Platform.OS === 'ios' ? GOOGLE_CONFIG.iosClientId : GOOGLE_CONFIG.webClientId;

    // CRITICAL: usePKCE: false must be explicitly set because Google rejects code_challenge_method for id_token requests!
    const request = new AuthSession.AuthRequest({
      clientId,
      scopes: ['openid', 'profile', 'email'],
      responseType: AuthSession.ResponseType.IdToken,
      redirectUri,
      usePKCE: false,
    });

    const discovery = {
      authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
      revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
    };

    const result = await request.promptAsync(discovery);

    if (result.type === 'success' && result.params.id_token) {
      const credential = GoogleAuthProvider.credential(result.params.id_token);
      const userCredential = await signInWithCredential(auth, credential);
      const fbUser = userCredential.user;

      const lumoUser: LumoUser = {
        uid: fbUser.uid,
        email: fbUser.email || 'user@gmail.com',
        displayName: fbUser.displayName || 'Google User',
        householdName: `${fbUser.displayName || 'My'}'s Home`,
        role: 'owner',
        linkedDevices: ['ESP32_MINI_01'],
        createdAt: Date.now(),
        isGuest: false,
      };

      await AsyncStorage.setItem(STORAGE_KEY_USER, JSON.stringify(lumoUser));
      return { success: true, user: lumoUser };
    } else if (result.type === 'cancel' || result.type === 'dismiss') {
      return { success: false, error: 'Google sign-in was cancelled' };
    }

    return {
      success: false,
      error: 'Google Sign-In returned status: ' + result.type,
    };
  } catch (err: any) {
    console.warn('[GoogleAuth] Error:', err);
    return {
      success: false,
      error: err?.message || 'Failed to authenticate with Google',
    };
  }
}
