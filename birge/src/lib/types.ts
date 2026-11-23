import type { Timestamp } from 'firebase/firestore';

export type Profile = {
  uid: string;
  username: string;
  displayName: string;
  photoURL: string | null;
  bio?: string;
  lang?: 'kk' | 'en';
  createdAt?: Timestamp;
};

export type Friendship = {
  id: string;
  members: [string, string];
  requestedBy: string;
  status: 'pending' | 'accepted';
  createdAt?: Timestamp;
};

export type VideoKind = 'youtube' | 'vimeo' | 'file' | 'hls' | 'local' | 'embed';

export type VideoSource = {
  kind: VideoKind;
  /** youtube/vimeo id, media URL, embed URL, or file name for `local` */
  src: string;
  title: string;
  /** original link the admin pasted */
  url: string;
};

export type Playback = {
  playing: boolean;
  /** seconds at `at` */
  position: number;
  /** server ms when `position` was true */
  at: number;
  rate: number;
  by: string;
  /** increments every time the admin sets a new video */
  videoVersion: number;
};

export type Room = {
  id: string;
  name: string;
  ownerId: string;
  admins: string[];
  members: string[];
  maxMembers: number;
  isPublic: boolean;
  video: VideoSource | null;
  playback: Playback | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type RoomMessage = {
  id: string;
  uid: string;
  username: string;
  photoURL: string | null;
  text: string;
  kind?: 'text' | 'system' | 'reaction';
  createdAt?: Timestamp;
};

export type DmThread = {
  id: string;
  members: [string, string];
  lastText?: string;
  lastFrom?: string;
  updatedAt?: Timestamp;
  readAt?: Record<string, Timestamp>;
};

export type DmMessage = {
  id: string;
  from: string;
  text: string;
  kind?: 'text' | 'invite';
  roomId?: string;
  roomName?: string;
  createdAt?: Timestamp;
};

export function pairId(a: string, b: string) {
  return a < b ? `${a}_${b}` : `${b}_${a}`;
}
