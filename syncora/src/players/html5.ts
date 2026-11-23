import type { PlayerEvents, SyncPlayer } from './types';

/** <video> element for direct files, HLS streams and local files picked by each viewer. */
export function createHtml5Player(container: HTMLElement, src: string, isHls: boolean, controls: boolean, ev: PlayerEvents): SyncPlayer {
  const video = document.createElement('video');
  video.playsInline = true;
  video.controls = controls;
  video.preload = 'auto';
  video.style.width = '100%';
  video.style.height = '100%';
  video.style.background = '#000';
  container.appendChild(video);

  let hls: { destroy(): void } | null = null;
  let destroyed = false;
  if (isHls && !video.canPlayType('application/vnd.apple.mpegurl')) {
    // hls.js is only downloaded when someone actually plays an .m3u8 stream
    import('hls.js').then(({ default: Hls }) => {
      if (destroyed) return;
      if (!Hls.isSupported()) return ev.onError('HLS is not supported in this browser');
      const h = new Hls();
      hls = h;
      h.loadSource(src);
      h.attachMedia(video);
      h.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) ev.onError(`HLS: ${data.details}`);
      });
    });
  } else {
    video.src = src;
  }

  video.addEventListener('loadedmetadata', () => ev.onReady(), { once: true });
  video.addEventListener('play', () => ev.onChange());
  video.addEventListener('pause', () => ev.onChange());
  video.addEventListener('seeked', () => ev.onChange());
  video.addEventListener('error', () => ev.onError(video.error?.message || 'Video cannot be played'));

  return {
    play() {
      const p = video.play();
      return p?.catch((e: DOMException) => {
        if (e.name === 'NotAllowedError') ev.onAutoplayBlocked();
      });
    },
    pause() {
      video.pause();
    },
    seek(s) {
      video.currentTime = s;
    },
    getTime() {
      return video.currentTime;
    },
    getDuration() {
      return video.duration || 0;
    },
    isPaused() {
      return video.paused;
    },
    setVolume(v) {
      video.volume = v;
    },
    getVolume() {
      return video.volume;
    },
    setMuted(m) {
      video.muted = m;
    },
    setRate(r) {
      video.playbackRate = r;
    },
    destroy() {
      destroyed = true;
      hls?.destroy();
      video.pause();
      video.removeAttribute('src');
      video.load();
      container.innerHTML = '';
    },
  };
}
