import type { VideoSource } from './types';

/** Turns any pasted link into a playable source. */
export function parseVideoUrl(raw: string, title = ''): VideoSource | null {
  const input = raw.trim();
  if (!input) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\.|^m\./, '');
  const base = { title: title.trim(), url: url.toString() };

  // YouTube: watch?v=, youtu.be/, shorts/, embed/, live/
  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0];
    if (id) return { kind: 'youtube', src: id, ...base };
  }
  if (host.endsWith('youtube.com') || host === 'youtube-nocookie.com') {
    const v = url.searchParams.get('v');
    if (v) return { kind: 'youtube', src: v, ...base };
    const m = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]{6,})/);
    if (m) return { kind: 'youtube', src: m[1], ...base };
  }

  // Vimeo: vimeo.com/123, vimeo.com/channels/x/123, player.vimeo.com/video/123
  if (host.endsWith('vimeo.com')) {
    const m = url.pathname.match(/(\d{5,})/);
    if (m) return { kind: 'vimeo', src: m[1], ...base };
  }

  const path = url.pathname.toLowerCase();
  if (/\.m3u8$/.test(path)) return { kind: 'hls', src: url.toString(), ...base };
  if (/\.(mp4|webm|ogv|ogg|mov|m4v|mkv)$/.test(path)) return { kind: 'file', src: url.toString(), ...base };

  // Anything else: embed the page as-is (cannot be synced)
  return { kind: 'embed', src: toEmbedUrl(url), ...base };
}

function toEmbedUrl(url: URL) {
  const host = url.hostname.replace(/^www\./, '');
  // Some common sites have dedicated embed URLs
  if (host === 'rutube.ru') {
    const m = url.pathname.match(/\/video\/([\w]+)/);
    if (m) return `https://rutube.ru/play/embed/${m[1]}`;
  }
  if (host.endsWith('dailymotion.com')) {
    const m = url.pathname.match(/\/video\/([\w]+)/);
    if (m) return `https://www.dailymotion.com/embed/video/${m[1]}`;
  }
  if (host === 'drive.google.com') {
    const m = url.pathname.match(/\/file\/d\/([\w-]+)/);
    if (m) return `https://drive.google.com/file/d/${m[1]}/preview`;
  }
  if (host === 'twitch.tv') {
    const channel = url.pathname.split('/')[1];
    if (channel) return `https://player.twitch.tv/?channel=${channel}&parent=${location.hostname}`;
  }
  return url.toString();
}

export function localSource(fileName: string): VideoSource {
  return { kind: 'local', src: fileName, title: fileName, url: '' };
}

export function videoTitle(v: VideoSource) {
  if (v.title) return v.title;
  if (v.kind === 'youtube') return `YouTube · ${v.src}`;
  if (v.kind === 'vimeo') return `Vimeo · ${v.src}`;
  try {
    const u = new URL(v.url || v.src);
    return decodeURIComponent(u.pathname.split('/').pop() || u.hostname);
  } catch {
    return v.src;
  }
}

export function formatTime(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const mm = String(m).padStart(h ? 2 : 1, '0');
  return `${h ? h + ':' : ''}${mm}:${String(sec).padStart(2, '0')}`;
}
