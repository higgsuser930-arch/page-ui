import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { serverNow } from '../lib/clock';
import { publishPlayback, sendRoomMessage, setRoomVideo } from '../lib/data';
import type { Playback, Profile, Room } from '../lib/types';
import { formatTime, localSource, parseVideoUrl, videoTitle } from '../lib/video';
import { createHtml5Player } from '../players/html5';
import type { SyncPlayer } from '../players/types';
import { createVimeoPlayer } from '../players/vimeo';
import { createYouTubePlayer } from '../players/youtube';
import { Icon } from './Icon';

type Props = { room: Room; me: Profile; isAdmin: boolean };

function expectedPosition(p: Playback) {
  return p.position + (p.playing ? ((serverNow() - p.at) / 1000) * (p.rate || 1) : 0);
}

export function VideoStage({ room, me, isAdmin }: Props) {
  const { t } = useI18n();
  const stageRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<SyncPlayer | null>(null);
  const [ready, setReady] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState('');
  const [localFile, setLocalFile] = useState<{ name: string; url: string } | null>(null);
  const [volume, setVolume] = useState(1);
  const [clock, setClock] = useState({ time: 0, duration: 0 });

  const video = room.video;
  const kind = video?.kind;
  const synced = video && kind !== 'embed';
  const mediaSrc = kind === 'local' ? (localFile && localFile.name === video?.src ? localFile.url : null) : video?.src;

  // Latest values for the sync loop without re-creating the player
  const live = useRef({ room, isAdmin, me });
  live.current = { room, isAdmin, me };
  const sync = useRef({ engaged: false, suppressUntil: 0, lastSeekAt: 0, lastRemote: '', publishing: false });

  /* ---------- create / destroy player when the source changes ---------- */
  useEffect(() => {
    setReady(false);
    setBlocked(false);
    setError('');
    sync.current = { engaged: false, suppressUntil: Date.now() + 3000, lastSeekAt: 0, lastRemote: '', publishing: false };
    const host = hostRef.current;
    if (!host || !video || kind === 'embed' || !mediaSrc) return;
    const events = {
      onReady: () => setReady(true),
      onChange: () => tick(),
      onAutoplayBlocked: () => setBlocked(true),
      onError: (m: string) => setError(m),
    };
    const controls = isAdmin;
    let p: SyncPlayer;
    if (kind === 'youtube') p = createYouTubePlayer(host, mediaSrc, controls, events);
    else if (kind === 'vimeo') p = createVimeoPlayer(host, mediaSrc, controls, events);
    else p = createHtml5Player(host, mediaSrc, kind === 'hls', controls, events);
    playerRef.current = p;
    p.setVolume(volume);
    return () => {
      p.destroy();
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, mediaSrc, isAdmin, room.playback?.videoVersion]);

  /* ---------- the sync loop ---------- */
  function tick() {
    const p = playerRef.current;
    const { room, isAdmin, me } = live.current;
    const remote = room.playback;
    if (!p || !remote) return;
    const s = sync.current;
    const now = Date.now();
    const paused = p.isPaused();
    const time = p.getTime();

    if (!s.engaged && !paused) s.engaged = true;

    const key = `${remote.at}:${remote.position}:${remote.playing}`;
    const remoteChanged = key !== s.lastRemote;
    s.lastRemote = key;
    const fromOther = remote.by !== me.uid;
    if (remoteChanged && fromOther) s.suppressUntil = now + 2500;

    const following = !isAdmin || now < s.suppressUntil;
    const expected = expectedPosition(remote);

    if (following) {
      if (remote.playing && paused) {
        if (!blockedRef.current) p.play();
      } else if (!remote.playing && !paused) {
        p.pause();
      }
      const tolerance = kind === 'youtube' || kind === 'vimeo' ? 1.5 : 0.8;
      if (Math.abs(time - expected) > tolerance && now - s.lastSeekAt > 2000) {
        s.lastSeekAt = now;
        p.seek(Math.max(0, expected));
      }
      if (!remote.playing && !paused) s.engaged = true;
      if (!remote.playing) s.engaged = true; // nothing to autoplay: admin may act freely
      return;
    }

    // Admin: publish when local state diverges from the shared state
    if (!s.engaged || s.publishing) return;
    const drift = Math.abs(time - expected);
    if (paused === remote.playing || drift > 1.5) {
      s.publishing = true;
      const next: Playback = { ...remote, playing: !paused, position: time, at: serverNow(), by: me.uid, rate: 1 };
      s.lastRemote = `${next.at}:${next.position}:${next.playing}`;
      publishPlayback(room.id, next).finally(() => (s.publishing = false));
    }
  }

  const blockedRef = useRef(blocked);
  blockedRef.current = blocked;

  useEffect(() => {
    if (!ready) return;
    const id = window.setInterval(() => {
      tick();
      const p = playerRef.current;
      if (p) setClock({ time: p.getTime(), duration: p.getDuration() });
    }, 500);
    tick();
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // react to remote changes immediately
  useEffect(() => {
    if (ready) tick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.playback?.at, room.playback?.playing, room.playback?.position]);

  function joinPlayback() {
    setBlocked(false);
    blockedRef.current = false;
    const p = playerRef.current;
    if (!p) return;
    sync.current.suppressUntil = Date.now() + 2500;
    p.setMuted(false);
    const remote = room.playback;
    if (remote) p.seek(expectedPosition(remote));
    Promise.resolve(p.play()).then(() => (sync.current.engaged = true));
  }

  function resync() {
    const p = playerRef.current;
    if (!p || !room.playback) return;
    sync.current.lastSeekAt = Date.now();
    p.seek(expectedPosition(room.playback));
  }

  function toggleFullscreen() {
    const el = stageRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  }

  function changeVolume(v: number) {
    setVolume(v);
    playerRef.current?.setVolume(v);
    playerRef.current?.setMuted(v === 0);
  }

  return (
    <div className="stage-wrap">
      {isAdmin && <AdminBar room={room} me={me} onLocalFile={setLocalFile} />}
      <div className="stage" ref={stageRef}>
        {!video && (
          <div className="stage-empty">
            <Icon name="film" size={48} />
            <p>{t('room.video.empty')}</p>
            {isAdmin && <p className="muted">{t('room.video.empty.admin')}</p>}
          </div>
        )}
        {video && kind === 'embed' && (
          <iframe
            className="stage-embed"
            src={video.src}
            title={videoTitle(video)}
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
          />
        )}
        {video && kind === 'local' && !mediaSrc && (
          <div className="stage-empty">
            <Icon name="folder" size={44} />
            <p>{t('room.video.pickfile.d', { title: video.src })}</p>
            <label className="btn primary">
              {t('room.video.pickfile')}
              <input
                type="file"
                accept="video/*,.mkv"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setLocalFile({ name: video.src, url: URL.createObjectURL(f) });
                }}
              />
            </label>
          </div>
        )}
        <div className="stage-host" ref={hostRef} style={{ display: synced && mediaSrc ? 'block' : 'none' }} />
        {synced && mediaSrc && !isAdmin && <div className="stage-shield" title={t('room.controlledBy')} />}
        {synced && mediaSrc && blocked && (
          <button className="stage-blocked" onClick={joinPlayback}>
            <Icon name="play" size={56} />
            <span>{t('room.tapToJoin')}</span>
          </button>
        )}
        {error && <div className="stage-error">{error}</div>}
      </div>
      {video && (
        <div className="stage-bar">
          <div className="stage-title" title={videoTitle(video)}>
            <Icon name="film" size={16} /> {videoTitle(video)}
          </div>
          {synced && mediaSrc && (
            <>
              {!isAdmin && (
                <span className="muted small">
                  {room.playback?.playing ? '▶' : '❚❚'} {formatTime(clock.time)} / {formatTime(clock.duration)}
                </span>
              )}
              {!isAdmin && (
                <button className="btn ghost sm" onClick={resync} title={t('room.resync')}>
                  <Icon name="sync" size={16} />
                </button>
              )}
              <input
                className="volume"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                aria-label="Volume"
                onChange={(e) => changeVolume(Number(e.target.value))}
              />
            </>
          )}
          <button className="btn ghost sm" onClick={toggleFullscreen} title={t('room.fullscreen')}>
            <Icon name="expand" size={16} />
          </button>
        </div>
      )}
      {video && kind === 'embed' && <p className="note">{t('room.video.nosync')}</p>}
      {!isAdmin && synced && <p className="note subtle">{t('room.controlledBy')}</p>}
    </div>
  );
}

function AdminBar({ room, me, onLocalFile }: { room: Room; me: Profile; onLocalFile: (f: { name: string; url: string }) => void }) {
  const { t } = useI18n();
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function apply(src: ReturnType<typeof parseVideoUrl>) {
    if (!src) {
      setErr('URL?');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      await setRoomVideo(room.id, src, me.uid, room.playback?.videoVersion ?? 0, serverNow());
      await sendRoomMessage(room.id, me, t('room.sys.video', { name: '@' + me.username, title: videoTitle(src) }), 'system');
      setUrl('');
      setTitle('');
    } catch {
      setErr(t('common.error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="admin-bar"
      onSubmit={(e) => {
        e.preventDefault();
        apply(parseVideoUrl(url, title));
      }}
    >
      <input className="input grow" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t('room.video.ph')} />
      <input className="input title-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('room.video.title.ph')} maxLength={80} />
      <button className="btn primary" disabled={busy || !url.trim()}>
        {t('room.video.set')}
      </button>
      <label className="btn ghost" title={t('room.video.local')}>
        <Icon name="folder" size={18} />
        <input
          type="file"
          accept="video/*,.mkv"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            onLocalFile({ name: f.name, url: URL.createObjectURL(f) });
            apply(localSource(f.name));
            e.target.value = '';
          }}
        />
      </label>
      {err && <span className="error small">{err}</span>}
    </form>
  );
}
