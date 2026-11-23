// Security-rules checks against the local emulators:  npm run emulators  (in another terminal), then  npm run test:rules
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import {
  addDoc, arrayUnion, collection, connectFirestoreEmulator, doc, getDocs, getFirestore, query, where, serverTimestamp, setDoc, updateDoc, writeBatch,
} from 'firebase/firestore';

let failed = 0;
const pass = (m) => console.log('  ✓ ' + m);
const fail = (m) => { failed++; console.log('  ✗ ' + m); };
async function allowed(label, fn) { try { await fn(); pass(label); } catch (e) { fail(`${label} — ${e.code || e.message}`); } }
async function denied(label, fn) { try { await fn(); fail(`${label} — was allowed!`); } catch (e) { e.code === 'permission-denied' ? pass(label) : fail(`${label} — ${e.code || e.message}`); } }

const FS = 'http://127.0.0.1:8080/v1/projects/demo-syncora/databases/(default)/documents';
async function adminPatch(path, fields) {
  const r = await fetch(`${FS}/${path}`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) });
  if (!r.ok) throw new Error(`admin write ${path}: ${r.status}`);
}
const monthAhead = () => ({ timestampValue: new Date(Date.now() + 30 * 864e5).toISOString() });
await adminPatch('config/app', { subscriptionRequired: { booleanValue: true }, priceKzt: { integerValue: '999' }, introPriceKzt: { integerValue: '499' } });

async function user(name, paid = true) {
  const app = initializeApp({ apiKey: 'demo', projectId: 'demo-syncora', appId: name }, name);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const sub = name + Date.now();
  const { user } = await signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify({ sub, email: sub + '@example.com', email_verified: true })));
  const username = (name + Date.now()).slice(0, 20).toLowerCase();
  const b = writeBatch(db);
  b.set(doc(db, 'usernames', username), { uid: user.uid });
  b.set(doc(db, 'users', user.uid), { uid: user.uid, username, displayName: name, photoURL: null, bio: '' });
  await b.commit();
  if (paid) await adminPatch(`subscriptions/${user.uid}`, { activeUntil: monthAhead(), status: { stringValue: 'active' } });
  return { uid: user.uid, db, username };
}

const [owner, member, stranger, unpaid] = await Promise.all([user('owner'), user('member'), user('stranger'), user('unpaid', false)]);
console.log('Subscription');
await denied('cannot give yourself a subscription', () => setDoc(doc(unpaid.db, 'subscriptions', unpaid.uid), { activeUntil: new Date(Date.now() + 1e10), status: 'active' }));
await denied('cannot change prices', () => setDoc(doc(unpaid.db, 'config', 'app'), { priceKzt: 1 }));
await denied('unpaid user cannot create a room', () => addDoc(collection(unpaid.db, 'rooms'), { name: 'x', ownerId: unpaid.uid, admins: [unpaid.uid], members: [unpaid.uid], maxMembers: 5, isPublic: false }));
await denied('unpaid user cannot send friend requests', () => {
  const [x, y] = [unpaid.uid, owner.uid].sort();
  return setDoc(doc(unpaid.db, 'friendships', `${x}_${y}`), { members: [x, y], requestedBy: unpaid.uid, status: 'pending' });
});
console.log('Profiles & usernames');
await denied('cannot take a username someone already holds', () => setDoc(doc(stranger.db, 'usernames', owner.username), { uid: stranger.uid }));
await denied('cannot point own profile at a username you do not hold', () => updateDoc(doc(stranger.db, 'users', stranger.uid), { username: owner.username }));
await denied('cannot edit another person’s profile', () => updateDoc(doc(stranger.db, 'users', owner.uid), { displayName: 'hacked' }));

console.log('Rooms');
const roomRef = await addDoc(collection(owner.db, 'rooms'), {
  name: 'Rules test', ownerId: owner.uid, admins: [owner.uid], members: [owner.uid], maxMembers: 2, isPublic: false, video: null, playback: null,
  createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
});
const id = roomRef.id;
await denied('cannot create a room with more than 28 seats', () => addDoc(collection(owner.db, 'rooms'), { name: 'x', ownerId: owner.uid, admins: [owner.uid], members: [owner.uid], maxMembers: 50, isPublic: false }));
await denied('unpaid user cannot join a room', () => updateDoc(doc(unpaid.db, 'rooms', id), { members: arrayUnion(unpaid.uid) }));
await allowed('member can join', () => updateDoc(doc(member.db, 'rooms', id), { members: arrayUnion(member.uid) }));
await denied('room is full (2/2): stranger cannot join', () => updateDoc(doc(stranger.db, 'rooms', id), { members: arrayUnion(stranger.uid) }));
await denied('stranger cannot read room chat', () => getDocs(collection(stranger.db, 'rooms', id, 'messages')));
await denied('stranger cannot post in room chat', () => addDoc(collection(stranger.db, 'rooms', id, 'messages'), { uid: stranger.uid, text: 'hi', createdAt: serverTimestamp() }));
await allowed('member can post in room chat', () => addDoc(collection(member.db, 'rooms', id, 'messages'), { uid: member.uid, username: member.username, photoURL: null, text: 'hi', kind: 'text', createdAt: serverTimestamp() }));
await denied('member cannot post as someone else', () => addDoc(collection(member.db, 'rooms', id, 'messages'), { uid: owner.uid, text: 'fake', createdAt: serverTimestamp() }));
await denied('non-admin cannot control playback', () => updateDoc(doc(member.db, 'rooms', id), { playback: { playing: true, position: 0, at: 0, rate: 1, by: member.uid, videoVersion: 1 } }));
await denied('non-admin cannot change the video', () => updateDoc(doc(member.db, 'rooms', id), { video: { kind: 'youtube', src: 'x', title: '', url: '' } }));
await denied('non-admin cannot make themselves admin', () => updateDoc(doc(member.db, 'rooms', id), { admins: arrayUnion(member.uid) }));
await allowed('admin controls playback', () => updateDoc(doc(owner.db, 'rooms', id), { playback: { playing: true, position: 5, at: Date.now(), rate: 1, by: owner.uid, videoVersion: 1 } }));

console.log('Friends & private messages');
const [a, b] = [owner.uid, stranger.uid].sort();
const pair = `${a}_${b}`;
await denied('cannot DM a non-friend', () => setDoc(doc(stranger.db, 'dms', pair), { members: [a, b], lastText: 'hi' }));
await denied('third person cannot create a friendship for others', () => setDoc(doc(member.db, 'friendships', pair), { members: [a, b], requestedBy: member.uid, status: 'pending' }));
await allowed('send friend request', () => setDoc(doc(stranger.db, 'friendships', pair), { members: [a, b], requestedBy: stranger.uid, status: 'pending', createdAt: serverTimestamp() }));
await denied('cannot accept your own request', () => updateDoc(doc(stranger.db, 'friendships', pair), { status: 'accepted' }));
await allowed('receiver accepts', () => updateDoc(doc(owner.db, 'friendships', pair), { status: 'accepted', acceptedAt: serverTimestamp() }));
await allowed('friends can DM', async () => {
  await setDoc(doc(stranger.db, 'dms', pair), { members: [a, b], lastText: 'hi', lastFrom: stranger.uid, updatedAt: serverTimestamp() }, { merge: true });
  await addDoc(collection(stranger.db, 'dms', pair, 'messages'), { from: stranger.uid, text: 'hi', kind: 'text', createdAt: serverTimestamp() });
});
await denied('third person cannot read the DM', () => getDocs(collection(member.db, 'dms', pair, 'messages')));
await allowed('own friendship list query is allowed', () => getDocs(query(collection(owner.db, 'friendships'), where('members', 'array-contains', owner.uid))));
await denied('listing everyone’s friendships is denied', () => getDocs(collection(owner.db, 'friendships')));

console.log(failed ? `\n${failed} FAILED` : '\nALL RULES CHECKS PASSED');
process.exit(failed ? 1 : 0);
