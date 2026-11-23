import { onAuthStateChanged, signInWithPopup, signOut as fbSignOut, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useI18n } from '../i18n';
import { syncClock } from './clock';
import { auth, db, googleProvider, isConfigured } from './firebase';
import type { Profile } from './types';
import { createProfile } from './usernames';

type AuthState = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { lang, setLang } = useI18n();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(isConfigured);

  useEffect(() => {
    if (!isConfigured) return;
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setProfile(null);
        setLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    let created = false;
    let langApplied = false;
    syncClock(user.uid);
    const unsub = onSnapshot(doc(db, 'users', user.uid), async (snap) => {
      if (snap.exists()) {
        const p = snap.data() as Profile;
        setProfile(p);
        if (!langApplied && p.lang) {
          langApplied = true;
          setLang(p.lang);
        }
        setLoading(false);
      } else if (!created && !snap.metadata.fromCache) {
        created = true;
        try {
          await createProfile(user, lang);
        } catch (e) {
          console.error(e);
          setLoading(false);
        }
      }
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const value: AuthState = {
    user,
    profile,
    loading,
    signIn: async () => {
      await signInWithPopup(auth, googleProvider);
    },
    signOut: async () => {
      await fbSignOut(auth);
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside provider');
  return ctx;
}

/** For pages behind sign-in: profile is guaranteed. */
export function useMe() {
  const { profile } = useAuth();
  if (!profile) throw new Error('useMe without profile');
  return profile;
}
