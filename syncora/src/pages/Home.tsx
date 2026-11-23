import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { useI18n } from '../i18n';
import { useMe } from '../lib/auth';
import { createRoom, useMyRooms, usePublicRooms } from '../lib/data';
import type { Room } from '../lib/types';
import { videoTitle } from '../lib/video';

export function Home() {
  const { t } = useI18n();
  const me = useMe();
  const nav = useNavigate();
  const rooms = useMyRooms(me.uid);
  const publicRooms = usePublicRooms();
  const [name, setName] = useState('');
  const [max, setMax] = useState(10);
  const [isPublic, setIsPublic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [join, setJoin] = useState('');
  const [err, setErr] = useState('');

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setErr('');
    try {
      const id = await createRoom(me.uid, name, max, isPublic);
      nav(`/room/${id}`);
    } catch {
      setErr(t('common.error'));
      setBusy(false);
    }
  }

  function goJoin(e: React.FormEvent) {
    e.preventDefault();
    const v = join.trim();
    const m = v.match(/room\/([\w-]+)/);
    const id = m ? m[1] : v.replace(/[^\w-]/g, '');
    if (id) nav(`/room/${id}`);
  }

  const others = publicRooms?.filter((r) => !r.members.includes(me.uid)) ?? null;

  return (
    <div className="page home">
      <div className="home-actions">
        <form className="card create" onSubmit={create}>
          <h2>
            <Icon name="plus" /> {t('home.create')}
          </h2>
          <label className="field">
            <span>{t('home.create.name')}</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('home.create.name.ph')} maxLength={60} required />
          </label>
          <label className="field">
            <span>
              {t('home.create.max')}: <b>{max}</b>
            </span>
            <input type="range" min={2} max={28} value={max} onChange={(e) => setMax(Number(e.target.value))} />
          </label>
          <label className="check">
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
            <span>{t('home.create.public')}</span>
          </label>
          <button className="btn primary" disabled={busy || !name.trim()}>
            {t('home.create.submit')}
          </button>
          {err && <p className="error small">{err}</p>}
        </form>
        <form className="card join" onSubmit={goJoin}>
          <h2>
            <Icon name="link" /> {t('home.join')}
          </h2>
          <input className="input" value={join} onChange={(e) => setJoin(e.target.value)} placeholder={t('home.join.ph')} />
          <button className="btn ghost" disabled={!join.trim()}>
            {t('home.join.submit')}
          </button>
        </form>
      </div>

      <h2 className="section-title">{t('home.title')}</h2>
      {rooms === null ? (
        <p className="muted">{t('common.loading')}</p>
      ) : rooms.length === 0 ? (
        <p className="muted empty">{t('home.empty')}</p>
      ) : (
        <div className="room-grid">
          {rooms.map((r) => (
            <RoomCard key={r.id} room={r} mine={r.ownerId === me.uid} />
          ))}
        </div>
      )}

      <h2 className="section-title">
        <Icon name="globe" /> {t('home.public')}
      </h2>
      {others === null ? (
        <p className="muted">{t('common.loading')}</p>
      ) : others.length === 0 ? (
        <p className="muted empty">{t('home.public.empty')}</p>
      ) : (
        <div className="room-grid">
          {others.map((r) => (
            <RoomCard key={r.id} room={r} mine={false} />
          ))}
        </div>
      )}
    </div>
  );
}

function RoomCard({ room, mine }: { room: Room; mine: boolean }) {
  const { t } = useI18n();
  return (
    <Link to={`/room/${room.id}`} className="card room-card">
      <div className="room-card-top">
        <span className="room-icon">
          <Icon name={room.isPublic ? 'globe' : 'lock'} size={16} />
        </span>
        {mine && (
          <span className="tag">
            <Icon name="crown" size={12} /> {t('room.owner')}
          </span>
        )}
      </div>
      <h3>{room.name}</h3>
      <p className="muted small ellipsis">{room.video ? '▶ ' + videoTitle(room.video) : t('room.video.empty')}</p>
      <p className="small">
        <Icon name="users" size={14} /> {room.members.length}/{room.maxMembers} {t('room.members')}
      </p>
    </Link>
  );
}
