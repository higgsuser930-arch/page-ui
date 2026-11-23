import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { Profile } from './types';

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

const first = ['aqqu', 'bori', 'qyran', 'tulpar', 'arlan', 'sunqar', 'samruk', 'kokjal', 'aibar', 'barys', 'jelaya', 'kerey', 'kino', 'nur', 'zhuldyz', 'aspan', 'tau', 'dala'];
const second = ['fan', 'kino', 'watch', 'film', 'star', 'nomad', 'dos', 'kozqaras', 'kesh', 'tun'];

export function randomUsername() {
  const a = first[Math.floor(Math.random() * first.length)];
  const b = second[Math.floor(Math.random() * second.length)];
  const n = Math.floor(1000 + Math.random() * 9000);
  return `${a}_${b}${n}`.slice(0, 20);
}

export function normalizeUsername(input: string) {
  return input.trim().replace(/^@/, '').toLowerCase();
}

export async function isUsernameFree(name: string, myUid?: string) {
  const snap = await getDoc(doc(db, 'usernames', name));
  return !snap.exists() || snap.get('uid') === myUid;
}

/** Creates the profile for a brand-new account with a random free username. */
export async function createProfile(user: { uid: string; displayName: string | null; photoURL: string | null }, lang: 'kk' | 'en') {
  for (let attempt = 0; attempt < 8; attempt++) {
    const username = randomUsername();
    try {
      return await runTransaction(db, async (tx) => {
        const profileRef = doc(db, 'users', user.uid);
        const existing = await tx.get(profileRef);
        if (existing.exists()) return existing.data() as Profile;
        const nameRef = doc(db, 'usernames', username);
        if ((await tx.get(nameRef)).exists()) throw new Error('taken');
        const profile: Profile = {
          uid: user.uid,
          username,
          displayName: (user.displayName || username).slice(0, 40),
          photoURL: user.photoURL,
          bio: '',
          lang,
        };
        tx.set(nameRef, { uid: user.uid });
        tx.set(profileRef, { ...profile, createdAt: serverTimestamp() });
        return profile;
      });
    } catch (e) {
      if ((e as Error).message !== 'taken') throw e;
    }
  }
  throw new Error('Could not allocate a username');
}

/** Atomically moves the user to a new username. Throws Error('taken') if someone else holds it. */
export async function changeUsername(uid: string, newName: string) {
  if (!USERNAME_RE.test(newName)) throw new Error('invalid');
  await runTransaction(db, async (tx) => {
    const profileRef = doc(db, 'users', uid);
    const profile = await tx.get(profileRef);
    const oldName = profile.get('username') as string;
    if (oldName === newName) return;
    const newRef = doc(db, 'usernames', newName);
    if ((await tx.get(newRef)).exists()) throw new Error('taken');
    tx.set(newRef, { uid });
    tx.update(profileRef, { username: newName });
    if (oldName) tx.delete(doc(db, 'usernames', oldName));
  });
}
