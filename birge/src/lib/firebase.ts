import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, GoogleAuthProvider } from 'firebase/auth';
import { connectFirestoreEmulator, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

const env = import.meta.env;
export const useEmulators = env.VITE_USE_EMULATORS === 'true';

const config = useEmulators
  ? { apiKey: 'demo-key', authDomain: 'localhost', projectId: 'demo-birge', appId: 'demo-app' }
  : {
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: env.VITE_FIREBASE_APP_ID,
    };

export const isConfigured = Boolean(config.apiKey && config.projectId);

export const app = initializeApp(isConfigured ? config : { apiKey: 'x', projectId: 'unconfigured', appId: 'x' });
export const auth = getAuth(app);
export const db = initializeFirestore(
  app,
  useEmulators ? {} : { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) },
);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

if (useEmulators) {
  const host = location.hostname;
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
}

// Test hook for local end-to-end tests against the emulators only (never present in production builds).
if (useEmulators) {
  (window as unknown as Record<string, unknown>).__birgeTestSignIn = async (sub: string, name: string) => {
    const { signInWithCredential } = await import('firebase/auth');
    const cred = GoogleAuthProvider.credential(JSON.stringify({ sub, email: `${sub}@example.com`, email_verified: true, name }));
    return signInWithCredential(auth, cred);
  };
}
