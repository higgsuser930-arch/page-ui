import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';

/** Milliseconds to add to Date.now() to get the server's clock. */
let offset = 0;

export function serverNow() {
  return Date.now() + offset;
}

/** Estimate the offset between this device and Firestore's clock (devices' clocks can differ by seconds). */
export async function syncClock(uid: string) {
  try {
    const ref = doc(db, 'clock', uid);
    const samples: number[] = [];
    for (let i = 0; i < 3; i++) {
      const t0 = Date.now();
      await setDoc(ref, { t: serverTimestamp() });
      const snap = await getDoc(ref);
      const t1 = Date.now();
      const server = snap.get('t')?.toMillis?.();
      if (typeof server === 'number') samples.push(server - (t0 + t1) / 2);
    }
    if (samples.length) {
      samples.sort((a, b) => a - b);
      offset = samples[Math.floor(samples.length / 2)];
    }
  } catch {
    offset = 0;
  }
}
