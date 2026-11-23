import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  limitToLast,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { serverNow } from './clock';
import { db } from './firebase';
import { pairId, type DmMessage, type DmThread, type Friendship, type Playback, type Profile, type Room, type RoomMessage, type VideoSource } from './types';

const withId = <T,>(d: QueryDocumentSnapshot<DocumentData>) => ({ id: d.id, ...d.data() }) as T;
const ms = (t?: { toMillis(): number }) => t?.toMillis?.() ?? Date.now() + 1e12; // pending writes sort last

/* ---------------- Profiles (cached) ---------------- */

const profileCache = new Map<string, Profile>();
const profileWaiters = new Map<string, Promise<Profile | null>>();

export async function fetchProfile(uid: string): Promise<Profile | null> {
  if (profileCache.has(uid)) return profileCache.get(uid)!;
  if (!profileWaiters.has(uid)) {
    profileWaiters.set(
      uid,
      getDoc(doc(db, 'users', uid)).then((s) => {
        profileWaiters.delete(uid);
        if (!s.exists()) return null;
        const p = s.data() as Profile;
        profileCache.set(uid, p);
        return p;
      }),
    );
  }
  return profileWaiters.get(uid)!;
}

export function useProfiles(uids: string[]) {
  const key = [...new Set(uids)].sort().join(',');
  const [map, setMap] = useState<Record<string, Profile>>({});
  useEffect(() => {
    if (!key) return;
    let alive = true;
    const ids = key.split(',');
    // live updates so username/photo changes show up
    const unsubs = ids.map((uid) =>
      onSnapshot(doc(db, 'users', uid), (s) => {
        if (!alive || !s.exists()) return;
        const p = s.data() as Profile;
        profileCache.set(uid, p);
        setMap((m) => ({ ...m, [uid]: p }));
      }, () => undefined),
    );
    return () => {
      alive = false;
      unsubs.forEach((u) => u());
    };
  }, [key]);
  return map;
}

export function useProfileByUsername(username: string) {
  const [state, setState] = useState<{ loading: boolean; profile: Profile | null }>({ loading: true, profile: null });
  useEffect(() => {
    setState({ loading: true, profile: null });
    return onSnapshot(
      query(collection(db, 'users'), where('username', '==', username), limit(1)),
      (s) => setState({ loading: false, profile: s.empty ? null : (s.docs[0].data() as Profile) }),
      () => setState({ loading: false, profile: null }),
    );
  }, [username]);
  return state;
}

export async function searchUsers(prefix: string) {
  const q = prefix.trim().replace(/^@/, '').toLowerCase();
  if (!q) return [] as Profile[];
  const snap = await getDocs(query(collection(db, 'users'), where('username', '>=', q), where('username', '<=', q + '\uf8ff'), limit(12)));
  return snap.docs.map((d) => d.data() as Profile);
}

export async function updateProfile(uid: string, data: Partial<Pick<Profile, 'displayName' | 'bio' | 'lang' | 'photoURL'>>) {
  await updateDoc(doc(db, 'users', uid), data);
}

/* ---------------- Friends ---------------- */

export function useFriendships(uid: string) {
  const [list, setList] = useState<Friendship[] | null>(null);
  useEffect(
    () =>
      onSnapshot(query(collection(db, 'friendships'), where('members', 'array-contains', uid)), (s) =>
        setList(s.docs.map((d) => withId<Friendship>(d))),
      ),
    [uid],
  );
  return list;
}

export function otherMember(members: string[], me: string) {
  return members[0] === me ? members[1] : members[0];
}

export async function sendFriendRequest(me: string, other: string) {
  const id = pairId(me, other);
  const [a, b] = id.split('_');
  await setDoc(doc(db, 'friendships', id), { members: [a, b], requestedBy: me, status: 'pending', createdAt: serverTimestamp() });
}

export async function acceptFriend(id: string) {
  await updateDoc(doc(db, 'friendships', id), { status: 'accepted', acceptedAt: serverTimestamp() });
}

export async function removeFriendship(id: string) {
  await deleteDoc(doc(db, 'friendships', id));
}

/* ---------------- Private messages ---------------- */

export function useDmThreads(uid: string) {
  const [list, setList] = useState<DmThread[] | null>(null);
  useEffect(
    () =>
      onSnapshot(query(collection(db, 'dms'), where('members', 'array-contains', uid)), (s) =>
        setList(s.docs.map((d) => withId<DmThread>(d)).sort((a, b) => ms(b.updatedAt) - ms(a.updatedAt))),
      ),
    [uid],
  );
  return list;
}

export function isUnread(t: DmThread, me: string) {
  if (!t.lastFrom || t.lastFrom === me || !t.updatedAt) return false;
  const read = t.readAt?.[me];
  return !read || read.toMillis() < t.updatedAt.toMillis();
}

export function useDmMessages(id: string | null) {
  const [list, setList] = useState<DmMessage[] | null>(null);
  useEffect(() => {
    setList(null);
    if (!id) return;
    return onSnapshot(
      query(collection(db, 'dms', id, 'messages'), orderBy('createdAt'), limitToLast(200)),
      (s) => setList(s.docs.map((d) => withId<DmMessage>(d))),
      () => setList([]),
    );
  }, [id]);
  return list;
}

export async function sendDm(me: string, other: string, text: string, extra: Partial<DmMessage> = {}) {
  const id = pairId(me, other);
  const members = id.split('_');
  await setDoc(
    doc(db, 'dms', id),
    { members, lastText: text.slice(0, 120), lastFrom: me, updatedAt: serverTimestamp(), readAt: { [me]: serverTimestamp() } },
    { merge: true },
  );
  await addDoc(collection(db, 'dms', id, 'messages'), { from: me, text, kind: 'text', ...extra, createdAt: serverTimestamp() });
}

export async function markDmRead(id: string, me: string) {
  const members = id.split('_');
  await setDoc(doc(db, 'dms', id), { members, readAt: { [me]: serverTimestamp() } }, { merge: true }).catch(() => undefined);
}

/* ---------------- Rooms ---------------- */

export function useRoom(id: string) {
  const [state, setState] = useState<{ loading: boolean; room: Room | null }>({ loading: true, room: null });
  useEffect(
    () =>
      onSnapshot(
        doc(db, 'rooms', id),
        (s) => setState({ loading: false, room: s.exists() ? ({ id: s.id, ...s.data() } as Room) : null }),
        () => setState({ loading: false, room: null }),
      ),
    [id],
  );
  return state;
}

export function useMyRooms(uid: string) {
  const [list, setList] = useState<Room[] | null>(null);
  useEffect(
    () =>
      onSnapshot(query(collection(db, 'rooms'), where('members', 'array-contains', uid)), (s) =>
        setList(s.docs.map((d) => withId<Room>(d)).sort((a, b) => ms(b.updatedAt) - ms(a.updatedAt))),
      ),
    [uid],
  );
  return list;
}

export function usePublicRooms() {
  const [list, setList] = useState<Room[] | null>(null);
  useEffect(
    () =>
      onSnapshot(query(collection(db, 'rooms'), where('isPublic', '==', true), limit(50)), (s) =>
        setList(s.docs.map((d) => withId<Room>(d)).sort((a, b) => ms(b.updatedAt) - ms(a.updatedAt))),
      ),
    [],
  );
  return list;
}

export async function createRoom(uid: string, name: string, maxMembers: number, isPublic: boolean) {
  const ref = await addDoc(collection(db, 'rooms'), {
    name: name.trim().slice(0, 60),
    ownerId: uid,
    admins: [uid],
    members: [uid],
    maxMembers: Math.max(2, Math.min(28, Math.round(maxMembers))),
    isPublic,
    video: null,
    playback: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function joinRoom(roomId: string, uid: string) {
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'rooms', roomId);
    const s = await tx.get(ref);
    if (!s.exists()) throw new Error('notfound');
    const r = s.data() as Room;
    if (r.members.includes(uid)) return;
    if (r.members.length >= r.maxMembers) throw new Error('full');
    tx.update(ref, { members: arrayUnion(uid) });
  });
}

export async function leaveRoom(roomId: string, uid: string) {
  await updateDoc(doc(db, 'rooms', roomId), { members: arrayRemove(uid) });
}

export async function kickMember(roomId: string, uid: string) {
  await updateDoc(doc(db, 'rooms', roomId), { members: arrayRemove(uid), admins: arrayRemove(uid) });
}

export async function setAdmin(roomId: string, uid: string, makeAdmin: boolean) {
  await updateDoc(doc(db, 'rooms', roomId), { admins: makeAdmin ? arrayUnion(uid) : arrayRemove(uid) });
}

export async function deleteRoom(roomId: string) {
  await deleteDoc(doc(db, 'rooms', roomId));
}

export async function setRoomVideo(roomId: string, video: VideoSource, by: string, prevVersion: number, at: number) {
  const playback: Playback = { playing: false, position: 0, at, rate: 1, by, videoVersion: prevVersion + 1 };
  await updateDoc(doc(db, 'rooms', roomId), { video, playback, updatedAt: serverTimestamp() });
}

export async function publishPlayback(roomId: string, playback: Playback) {
  await updateDoc(doc(db, 'rooms', roomId), { playback });
}

export function useRoomMessages(roomId: string, enabled: boolean) {
  const [list, setList] = useState<RoomMessage[] | null>(null);
  useEffect(() => {
    if (!enabled) return;
    return onSnapshot(
      query(collection(db, 'rooms', roomId, 'messages'), orderBy('createdAt'), limitToLast(150)),
      (s) => setList(s.docs.map((d) => withId<RoomMessage>(d))),
      () => setList([]),
    );
  }, [roomId, enabled]);
  return list;
}

export async function sendRoomMessage(roomId: string, me: Profile, text: string, kind: RoomMessage['kind'] = 'text') {
  await addDoc(collection(db, 'rooms', roomId, 'messages'), {
    uid: me.uid,
    username: me.username,
    photoURL: me.photoURL,
    text,
    kind,
    createdAt: serverTimestamp(),
  });
}

/** Heartbeat presence: written every 25s while the room page is open. */
export function usePresence(roomId: string, uid: string, enabled: boolean) {
  const [online, setOnline] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!enabled) return;
    const ref = doc(db, 'rooms', roomId, 'presence', uid);
    const beat = () => setDoc(ref, { lastSeen: serverTimestamp() }).catch(() => undefined);
    beat();
    const timer = window.setInterval(beat, 25_000);
    let docs: { id: string; t: number }[] = [];
    const recompute = () => setOnline(new Set(docs.filter((d) => serverNow() - d.t < 60_000).map((d) => d.id)));
    const unsub = onSnapshot(
      collection(db, 'rooms', roomId, 'presence'),
      (s) => {
        docs = s.docs.map((d) => ({ id: d.id, t: d.get('lastSeen')?.toMillis?.() ?? Date.now() }));
        recompute();
      },
      () => undefined,
    );
    const re = window.setInterval(recompute, 15_000);
    const bye = () => deleteDoc(ref).catch(() => undefined);
    window.addEventListener('pagehide', bye);
    return () => {
      clearInterval(timer);
      clearInterval(re);
      unsub();
      window.removeEventListener('pagehide', bye);
      bye();
    };
  }, [roomId, uid, enabled]);
  return online;
}
