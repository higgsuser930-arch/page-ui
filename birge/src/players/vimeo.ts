import VimeoPlayer from '@vimeo/player';
import type { PlayerEvents, SyncPlayer } from './types';

export function createVimeoPlayer(container: HTMLElement, id: string, controls: boolean, ev: PlayerEvents): SyncPlayer {
  const mount = document.createElement('div');
  mount.style.width = '100%';
  mount.style.height = '100%';
  container.appendChild(mount);
  const player = new VimeoPlayer(mount, { id: Number(id), responsive: false, controls, width: 640 });
  let time = 0;
  let duration = 0;
  let paused = true;
  let volume = 1;
  player.ready().then(() => {
    const iframe = mount.querySelector('iframe');
    if (iframe) {
      iframe.style.width = '100%';
      iframe.style.height = '100%';
    }
    player.getDuration().then((d) => (duration = d));
    ev.onReady();
  });
  player.on('timeupdate', (d: { seconds: number; duration: number }) => {
    time = d.seconds;
    duration = d.duration;
  });
  player.on('play', () => {
    paused = false;
    ev.onChange();
  });
  player.on('pause', () => {
    paused = true;
    ev.onChange();
  });
  player.on('seeked', (d: { seconds: number }) => {
    time = d.seconds;
    ev.onChange();
  });
  player.on('error', (e: { message?: string }) => ev.onError(e?.message || 'Vimeo error'));

  return {
    play() {
      return player.play().then(
        () => undefined,
        (e: { name?: string }) => {
          if (e?.name === 'NotAllowedError') ev.onAutoplayBlocked();
        },
      );
    },
    pause() {
      player.pause().catch(() => undefined);
    },
    seek(s) {
      time = s;
      player.setCurrentTime(s).catch(() => undefined);
    },
    getTime() {
      return time;
    },
    getDuration() {
      return duration;
    },
    isPaused() {
      return paused;
    },
    setVolume(v) {
      volume = v;
      player.setVolume(v).catch(() => undefined);
    },
    getVolume() {
      return volume;
    },
    setMuted(m) {
      player.setMuted(m).catch(() => undefined);
    },
    setRate(r) {
      player.setPlaybackRate(r).catch(() => undefined);
    },
    destroy() {
      player.destroy().catch(() => undefined);
      container.innerHTML = '';
    },
  };
}
