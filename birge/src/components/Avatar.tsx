import type { Profile } from '../lib/types';

export function Avatar({ p, size = 36, online }: { p?: Pick<Profile, 'photoURL' | 'displayName' | 'username'> | null; size?: number; online?: boolean }) {
  const letter = (p?.displayName || p?.username || '?').trim().charAt(0).toUpperCase();
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {p?.photoURL ? <img src={p.photoURL} alt="" referrerPolicy="no-referrer" /> : <span>{letter}</span>}
      {online && <i className="dot" />}
    </span>
  );
}
