import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { Icon } from '../components/Icon';
import { MessageList, timeOf } from '../components/MessageList';
import { useI18n } from '../i18n';
import { useMe } from '../lib/auth';
import { isUnread, markDmRead, otherMember, sendDm, useDmMessages, useDmThreads, useFriendships, useProfileByUsername, useProfiles } from '../lib/data';
import { pairId, type Profile } from '../lib/types';

export function Messages() {
  const { t } = useI18n();
  const me = useMe();
  const { username } = useParams();
  const threads = useDmThreads(me.uid);
  const profiles = useProfiles((threads ?? []).map((th) => otherMember(th.members, me.uid)));

  return (
    <div className={`page dm ${username ? 'has-thread' : ''}`}>
      <aside className="dm-list card">
        <h2>{t('dm.title')}</h2>
        {threads === null ? (
          <p className="muted small">{t('common.loading')}</p>
        ) : threads.length === 0 ? (
          <p className="muted small">{t('dm.empty')}</p>
        ) : (
          threads.map((th) => {
            const p = profiles[otherMember(th.members, me.uid)];
            if (!p) return null;
            return (
              <Link key={th.id} to={`/messages/${p.username}`} className={`dm-item ${p.username === username ? 'on' : ''}`}>
                <Avatar p={p} size={40} />
                <div className="grow min0">
                  <div className="row between">
                    <b className="ellipsis">{p.displayName}</b>
                    <span className="muted xsmall">{timeOf(th.updatedAt)}</span>
                  </div>
                  <div className="muted small ellipsis">
                    {th.lastFrom === me.uid ? '↪ ' : ''}
                    {th.lastText}
                  </div>
                </div>
                {isUnread(th, me.uid) && <i className="unread-dot" />}
              </Link>
            );
          })
        )}
      </aside>
      <section className="dm-thread card">{username ? <Thread username={username} /> : <p className="muted center pad">{t('dm.select')}</p>}</section>
    </div>
  );
}

function Thread({ username }: { username: string }) {
  const { loading, profile } = useProfileByUsername(username);
  const { t } = useI18n();
  if (loading) return <p className="muted center pad">{t('common.loading')}</p>;
  if (!profile) return <p className="muted center pad">{t('notfound')}</p>;
  return <ThreadWith other={profile} />;
}

function ThreadWith({ other }: { other: Profile }) {
  const { t } = useI18n();
  const me = useMe();
  const nav = useNavigate();
  const id = pairId(me.uid, other.uid);
  const friendships = useFriendships(me.uid);
  const isFriend = friendships?.some((f) => f.id === id && f.status === 'accepted');
  const msgs = useDmMessages(id);
  const [text, setText] = useState('');

  useEffect(() => {
    if (isFriend && msgs && msgs.length) markDmRead(id, me.uid);
  }, [id, me.uid, isFriend, msgs?.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="thread">
      <div className="thread-head">
        <button className="btn ghost icon-only back-btn" onClick={() => nav('/messages')} aria-label={t('common.back')}>
          ←
        </button>
        <Avatar p={other} size={36} />
        <div>
          <Link to={`/u/${other.username}`} className="person-name">
            {other.displayName}
          </Link>
          <div className="muted small">@{other.username}</div>
        </div>
      </div>
      <MessageList count={msgs?.length ?? 0}>
        {(msgs ?? []).map((m) => (
          <div key={m.id} className={`msg ${m.from === me.uid ? 'mine' : ''}`}>
            <div className="bubble">
              {m.kind === 'invite' && m.roomId ? (
                <div className="invite">
                  <Icon name="film" size={18} />
                  <div>
                    <div className="small">{t('dm.invite', { name: '@' + (m.from === me.uid ? me.username : other.username) })}</div>
                    <b>{m.roomName}</b>
                  </div>
                  <Link className="btn primary xs" to={`/room/${m.roomId}`}>
                    {t('dm.invite.open')}
                  </Link>
                </div>
              ) : (
                <div className="msg-text">{m.text}</div>
              )}
              <div className="msg-meta right">
                <span>{timeOf(m.createdAt)}</span>
              </div>
            </div>
          </div>
        ))}
      </MessageList>
      {friendships !== null && !isFriend ? (
        <p className="note center">{t('dm.notFriends')}</p>
      ) : (
        <form
          className="composer"
          onSubmit={async (e) => {
            e.preventDefault();
            const v = text.trim();
            if (!v) return;
            setText('');
            await sendDm(me.uid, other.uid, v.slice(0, 2000)).catch(() => setText(v));
          }}
        >
          <input className="input grow" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('room.chat.ph')} maxLength={2000} autoFocus />
          <button className="btn primary icon-only" disabled={!text.trim()} aria-label={t('common.send')}>
            <Icon name="send" size={18} />
          </button>
        </form>
      )}
    </div>
  );
}
