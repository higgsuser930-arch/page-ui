import type { PlayerEvents, SyncPlayer } from './types';

/* Minimal typings for the YouTube IFrame API */
type YTPlayer = {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(s: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  setVolume(v: number): void;
  getVolume(): number;
  mute(): void;
  unMute(): void;
  setPlaybackRate(r: number): void;
  destroy(): void;
};
declare global {
  interface Window {
    YT?: { Player: new (el: HTMLElement, opts: unknown) => YTPlayer; PlayerState: Record<string, number> };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;
function loadApi() {
  if (window.YT?.Player) return Promise.resolve();
  if (!apiPromise) {
    apiPromise = new Promise((resolve, reject) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve();
      };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.onerror = () => {
        apiPromise = null;
        reject(new Error('YouTube API failed to load'));
      };
      document.head.appendChild(s);
    });
  }
  return apiPromise;
}

export function createYouTubePlayer(container: HTMLElement, videoId: string, controls: boolean, ev: PlayerEvents): SyncPlayer {
  let player: YTPlayer | null = null;
  let destroyed = false;
  let wantPlay = false;
  let playRequestedAt = 0;
  const mount = document.createElement('div');
  container.appendChild(mount);

  loadApi()
    .then(() => {
      if (destroyed || !window.YT) return;
      player = new window.YT.Player(mount, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: { controls: controls ? 1 : 0, rel: 0, modestbranding: 1, playsinline: 1, disablekb: controls ? 0 : 1, fs: 0 },
        events: {
          onReady: () => ev.onReady(),
          onStateChange: (e: { data: number }) => {
            // -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued
            if (e.data === 1 || e.data === 2 || e.data === 0) ev.onChange();
          },
          onError: (e: { data: number }) => ev.onError(`YouTube error ${e.data}`),
        },
      });
    })
    .catch((e) => ev.onError(String(e)));

  // YouTube silently stays "unstarted"/"paused" when autoplay is blocked; detect that.
  const watchdog = window.setInterval(() => {
    if (!player || !wantPlay || !playRequestedAt) return;
    const state = player.getPlayerState?.();
    if (state === 1 || state === 3) {
      playRequestedAt = 0;
    } else if (Date.now() - playRequestedAt > 2500) {
      playRequestedAt = 0;
      ev.onAutoplayBlocked();
    }
  }, 500);

  return {
    play() {
      wantPlay = true;
      playRequestedAt = Date.now();
      player?.playVideo?.();
    },
    pause() {
      wantPlay = false;
      player?.pauseVideo?.();
    },
    seek(s) {
      player?.seekTo?.(s, true);
    },
    getTime() {
      return player?.getCurrentTime?.() ?? 0;
    },
    getDuration() {
      return player?.getDuration?.() ?? 0;
    },
    isPaused() {
      const s = player?.getPlayerState?.();
      return !(s === 1 || s === 3);
    },
    setVolume(v) {
      player?.setVolume?.(Math.round(v * 100));
    },
    getVolume() {
      return (player?.getVolume?.() ?? 100) / 100;
    },
    setMuted(m) {
      if (m) player?.mute?.();
      else player?.unMute?.();
    },
    setRate(r) {
      player?.setPlaybackRate?.(r);
    },
    destroy() {
      destroyed = true;
      clearInterval(watchdog);
      try {
        player?.destroy?.();
      } catch {
        /* ignore */
      }
      container.innerHTML = '';
    },
  };
}
