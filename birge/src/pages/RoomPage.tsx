import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { CopyButton } from '../components/CopyButton';
import { Icon } from '../components/Icon';
import { MessageList, timeOf } from '../components/MessageList';
import { VideoStage } from '../components/VideoStage';
import { useI18n } from '../i18n';
import { useMe } from '../lib/auth';
import {
  deleteRoom,
  joinRoom,
  kickMember,
  leaveRoom,
  otherMember,
  sendDm,
  sendRoomMessage,
  setAdmin,
  useFriendships,
  usePresence,
  useProfiles,
  useRoom,
  useRoomMessages,
} from '../lib/data';
import type { Profile, Room } from '../lib/types';

export function RoomPage() {
  const { id = '' } = useParams();
  const { t } = useI18n();
  const me = useMe();
  const { loading, room } = useRoom(id);

  if (loading) return <div className="page center muted">{t('common.loading')}</div>;
  if (!room)
    return (
      <div className="page center">
        <p>{t('room.notfound')}</p>
        <Link className="btn ghost" to="/">
          {t('common.back')}
        </Link>
      </div>
    );
  if (!room.members.includes(me.uid)) return <JoinCard room={room} />;
  return <RoomView room={room} me={me} />;
}

function JoinCard({ room }: { room: Room }) {
  const { t } = useI18n();
  const me = useMe();
  const owner = useProfiles([room.ownerId])[room.ownerId];
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const full = room.members.length >= room.maxMembers;
  return (
    <div className="page center">
      <div className="card join-card">
        <Icon name="film" size={40} />
        <h1>{room.name}</h1>
        {owner && (
          <p className="muted">
            {t('room.owner')}: @{owner.username}
          </p>
        )}
        <p>
          <Icon name="users" size={16} /> {room.members.length}/{room.maxMembers} {t('room.members')}
        </p>
        <button
          className="btn primary"
          disabled={full || busy}
          onClick={async () => {
            setBusy(true);
            setErr('');
            try {
              await joinRoom(room.id, me.uid);
            } catch (e) {
              setErr((e as Error).message === 'full' ? t('room.full') : t('common.error'));
            } finally {
              setBusy(false);
            }
          }}
        >
          {full ? t('room.full') : t('room.join')}
        </button>
        {err && <p className="error small">{err}</p>}
      </div>
    </div>
  );
}

function RoomView({ room, me }: { room: Room; me: Profile }) {
  const { t } = useI18n();
  const nav = useNavigate();
  const isAdmin = room.admins.includes(me.uid);
  const isOwner = room.ownerId === me.uid;
  const [tab, setTab] = useState<'chat' | 'people'>('chat');
  const [inviteOpen, setInviteOpen] = useState(false);
  const online = usePresence(room.id, me.uid, true);
  const profiles = useProfiles(room.members);

  return (
    <div className="room">
      <div className="room-head">
        <div className="room-title">
          <h1>{room.name}</h1>
          <span className="muted small">
            <Icon name="users" size={14} /> {room.members.length}/{room.maxMembers} · {online.size} {t('room.online')}
          </span>
        </div>
        <div className="row gap-s wrap">
          <button className="btn primary sm" onClick={() => setInviteOpen(true)}>
            <Icon name="userPlus" size={16} /> {t('room.invite')}
          </button>
          {isOwner ? (
            <button
              className="btn danger sm"
              onClick={async () => {
                if (!confirm(t('room.delete.confirm'))) return;
                await deleteRoom(room.id);
                nav('/');
              }}
            >
              <Icon name="trash" size={16} /> {t('room.delete')}
            </button>
          ) : (
            <button
              className="btn ghost sm"
              onClick={async () => {
                await leaveRoom(room.id, me.uid);
                nav('/');
              }}
            >
              <Icon name="door" size={16} /> {t('room.leave')}
            </button>
          )}
        </div>
      </div>

      <div className="room-body">
        <VideoStage room={room} me={me} isAdmin={isAdmin} />
        <aside className="side card">
          <div className="tabs">
            <button className={tab === 'chat' ? 'on' : ''} onClick={() => setTab('chat')}>
              <Icon name="chat" size={16} /> {t('room.chat')}
            </button>
            <button className={tab === 'people' ? 'on' : ''} onClick={() => setTab('people')}>
              <Icon name="users" size={16} /> {t('room.people')} · {room.members.length}
            </button>
          </div>
          {tab === 'chat' ? (
            <RoomChat room={room} me={me} />
          ) : (
            <div className="people">
              {room.members.map((uid) => {
                const p = profiles[uid];
                const adm = room.admins.includes(uid);
                return (
                  <div className="person" key={uid}>
                    <Avatar p={p} size={34} online={online.has(uid)} />
                    <div className="grow">
                      <Link to={p ? `/u/${p.username}` : '#'} className="person-name">
                        {p?.displayName ?? '…'}
                      </Link>
                      <div className="muted small">
                        @{p?.username ?? ''}{' '}
                        {uid === room.ownerId ? (
                          <span className="tag">
                            <Icon name="crown" size={11} /> {t('room.owner')}
                          </span>
                        ) : (
                          adm && (
                            <span className="tag">
                              <Icon name="shield" size={11} /> {t('room.admin')}
                            </span>
                          )
                        )}
                      </div>
                    </div>
                    {isOwner && uid !== me.uid && (
                      <button className="btn ghost xs" onClick={() => setAdmin(room.id, uid, !adm)}>
                        {adm ? t('room.removeAdmin') : t('room.makeAdmin')}
                      </button>
                    )}
                    {isAdmin && uid !== me.uid && uid !== room.ownerId && (
                      <button className="btn ghost xs" onClick={() => kickMember(room.id, uid)} title={t('room.kick')}>
                        <Icon name="x" size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </aside>
      </div>
      {inviteOpen && <InviteModal room={room} me={me} onClose={() => setInviteOpen(false)} />}
    </div>
  );
}

const REACTIONS = ['😂', '😍', '😮', '😢', '🔥', '👏'];

function RoomChat({ room, me }: { room: Room; me: Profile }) {
  const { t } = useI18n();
  const msgs = useRoomMessages(room.id, true);
  const [text, setText] = useState('');
  const send = async (value: string, kind: 'text' | 'reaction' = 'text') => {
    const v = value.trim();
    if (!v) return;
    if (kind === 'text') setText('');
    await sendRoomMessage(room.id, me, v.slice(0, 1000), kind).catch(() => setText(v));
  };
  return (
    <div className="chat">
      <MessageList count={msgs?.length ?? 0}>
        {msgs === null ? (
          <p className="muted small center">{t('common.loading')}</p>
        ) : msgs.length === 0 ? (
          <p className="muted small center">{t('room.chat.empty')}</p>
        ) : (
          msgs.map((m) =>
            m.kind === 'system' ? (
              <div key={m.id} className="msg system">
                {m.text}
              </div>
            ) : (
              <div key={m.id} className={`msg ${m.uid === me.uid ? 'mine' : ''} ${m.kind === 'reaction' ? 'reaction' : ''}`}>
                <Avatar p={{ photoURL: m.photoURL, displayName: m.username, username: m.username }} size={26} />
                <div className="bubble">
                  <div className="msg-meta">
                    <b>@{m.username}</b> <span>{timeOf(m.createdAt)}</span>
                  </div>
                  <div className="msg-text">{m.text}</div>
                </div>
              </div>
            ),
          )
        )}
      </MessageList>
      <div className="reactions" aria-label={t('room.reactions')}>
        {REACTIONS.map((r) => (
          <button key={r} onClick={() => send(r, 'reaction')}>
            {r}
          </button>
        ))}
      </div>
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <input className="input grow" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('room.chat.ph')} maxLength={1000} />
        <button className="btn primary icon-only" aria-label={t('common.send')} disabled={!text.trim()}>
          <Icon name="send" size={18} />
        </button>
      </form>
    </div>
  );
}

function InviteModal({ room, me, onClose }: { room: Room; me: Profile; onClose: () => void }) {
  const { t } = useI18n();
  const link = `${location.origin}/room/${room.id}`;
  const friendships = useFriendships(me.uid);
  const friendIds = (friendships ?? []).filter((f) => f.status === 'accepted').map((f) => otherMember(f.members, me.uid));
  const profiles = useProfiles(friendIds);
  const [sent, setSent] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="row between">
          <h2>{t('room.invite')}</h2>
          <button className="btn ghost icon-only" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        <label className="field">
          <span>{t('room.invite.link')}</span>
          <div className="row gap-s">
            <input className="input grow" readOnly value={link} onFocus={(e) => e.target.select()} />
            <CopyButton text={link} />
          </div>
        </label>
        <h3>{t('room.invite.friends')}</h3>
        {friendIds.length === 0 ? (
          <p className="muted small">{t('room.invite.none')}</p>
        ) : (
          <div className="people">
            {friendIds.map((uid) => {
              const p = profiles[uid];
              const inRoom = room.members.includes(uid);
              return (
                <div className="person" key={uid}>
                  <Avatar p={p} size={32} />
                  <div className="grow">
                    <div className="person-name">{p?.displayName ?? '…'}</div>
                    <div className="muted small">@{p?.username}</div>
                  </div>
                  <button
                    className="btn primary xs"
                    disabled={inRoom || sent[uid]}
                    onClick={async () => {
                      setSent((s) => ({ ...s, [uid]: true }));
                      await sendDm(me.uid, uid, `🎬 ${room.name}\n${link}`, { kind: 'invite', roomId: room.id, roomName: room.name }).catch(() =>
                        setSent((s) => ({ ...s, [uid]: false })),
                      );
                    }}
                  >
                    {inRoom ? '✓' : sent[uid] ? t('room.invite.sent') : t('room.invite')}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
