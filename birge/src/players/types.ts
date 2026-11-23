/** A uniform wrapper around YouTube / Vimeo / <video>, so the sync engine treats them the same. */
export interface SyncPlayer {
  play(): Promise<void> | void;
  pause(): void;
  seek(seconds: number): void;
  getTime(): number;
  getDuration(): number;
  isPaused(): boolean;
  setVolume(v: number): void; // 0..1
  getVolume(): number;
  setMuted(m: boolean): void;
  setRate(r: number): void;
  destroy(): void;
}

export type PlayerEvents = {
  onReady: () => void;
  /** user-visible state change (play/pause/seek) — the sync loop decides whether to publish */
  onChange: () => void;
  /** browser refused to start playback without a click */
  onAutoplayBlocked: () => void;
  onError: (message: string) => void;
};
