import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { FriendButton } from '../components/FriendButton';
import { Icon } from '../components/Icon';
import { useI18n } from '../i18n';
import { useMe } from '../lib/auth';
import { otherMember, removeFriendship, searchUsers, useFriendships, useProfiles } from '../lib/data';
import type { Friendship, Profile } from '../lib/types';

export function Friends() {
  const { t } = useI18n();
  const me = useMe();
  const friendships = useFriendships(me.uid);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Profile[] | null>(null);

  useEffect(() => {
    const v = q.trim().replace(/^@/, '');
    if (v.length < 2) {
      setResults(null);
      return;
    }
    const id = setTimeout(() => searchUsers(v).then(setResults).catch(() => setResults([])), 250);
    return () => clearTimeout(id);
  }, [q]);

  const all = friendships ?? [];
  const accepted = all.filter((f) => f.status === 'accepted');
  const incoming = all.filter((f) => f.status === 'pending' && f.requestedBy !== me.uid);
  const outgoing = all.filter((f) => f.status === 'pending' && f.requestedBy === me.uid);
  const profiles = useProfiles(all.map((f) => otherMember(f.members, me.uid)));

  const row = (f: Friendship, actions: React.ReactNode) => {
    const p = profiles[otherMember(f.members, me.uid)];
    return (
      <div className="person card-row" key={f.id}>
        <Avatar p={p} size={40} />
        <div className="grow">
          <Link to={p ? `/u/${p.username}` : '#'} className="person-name">
            {p?.displayName ?? '…'}
          </Link>
          <div className="muted small">@{p?.username}</div>
        </div>
        {p && actions}
      </div>
    );
  };

  return (
    <div className="page narrow">
      <h1>{t('friends.title')}</h1>
      <div className="search">
        <Icon name="search" size={18} />
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('friends.search.ph')} autoFocus />
      </div>
      {results && (
        <div className="card list">
          {results.length === 0 ? (
            <p className="muted small">{t('friends.notfound')}</p>
          ) : (
            results.map((p) => (
              <div className="person" key={p.uid}>
                <Avatar p={p} size={40} />
                <div className="grow">
                  <Link to={`/u/${p.username}`} className="person-name">
                    {p.displayName}
                  </Link>
                  <div className="muted small">@{p.username}</div>
                </div>
                <FriendButton other={p} friendships={friendships} />
              </div>
            ))
          )}
        </div>
      )}

      {incoming.length > 0 && (
        <>
          <h2 className="section-title">
            {t('friends.incoming')} <em className="badge">{incoming.length}</em>
          </h2>
          <div className="card list">{incoming.map((f) => row(f, <FriendButton other={profiles[otherMember(f.members, me.uid)]} friendships={friendships} />))}</div>
        </>
      )}

      <h2 className="section-title">{t('friends.list')}</h2>
      {friendships === null ? (
        <p className="muted">{t('common.loading')}</p>
      ) : accepted.length === 0 ? (
        <p className="muted empty">{t('friends.empty')}</p>
      ) : (
        <div className="card list">
          {accepted.map((f) =>
            row(
              f,
              <span className="row gap-s">
                <FriendButton other={profiles[otherMember(f.members, me.uid)]} friendships={friendships} />
                <button
                  className="btn ghost xs"
                  title={t('friends.remove')}
                  onClick={() => confirm(t('friends.remove.confirm')) && removeFriendship(f.id)}
                >
                  <Icon name="x" size={14} />
                </button>
              </span>,
            ),
          )}
        </div>
      )}

      {outgoing.length > 0 && (
        <>
          <h2 className="section-title">{t('friends.outgoing')}</h2>
          <div className="card list">{outgoing.map((f) => row(f, <FriendButton other={profiles[otherMember(f.members, me.uid)]} friendships={friendships} />))}</div>
        </>
      )}
    </div>
  );
}
