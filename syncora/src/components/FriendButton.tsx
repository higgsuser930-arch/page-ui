import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useMe } from '../lib/auth';
import { acceptFriend, removeFriendship, sendFriendRequest } from '../lib/data';
import { pairId, type Friendship, type Profile } from '../lib/types';
import { Icon } from './Icon';

export function FriendButton({ other, friendships }: { other: Profile; friendships: Friendship[] | null }) {
  const { t } = useI18n();
  const me = useMe();
  const nav = useNavigate();
  if (other.uid === me.uid) return <span className="muted small">{t('friends.you')}</span>;
  const f = friendships?.find((x) => x.id === pairId(me.uid, other.uid));
  if (!f)
    return (
      <button className="btn primary sm" onClick={() => sendFriendRequest(me.uid, other.uid)}>
        <Icon name="userPlus" size={16} /> {t('friends.add')}
      </button>
    );
  if (f.status === 'accepted')
    return (
      <button className="btn ghost sm" onClick={() => nav(`/messages/${other.username}`)}>
        <Icon name="chat" size={16} /> {t('friends.message')}
      </button>
    );
  if (f.requestedBy === me.uid)
    return (
      <button className="btn ghost sm" onClick={() => removeFriendship(f.id)} title={t('common.cancel')}>
        <Icon name="check" size={16} /> {t('friends.pending.out')}
      </button>
    );
  return (
    <span className="row gap-s">
      <button className="btn primary sm" onClick={() => acceptFriend(f.id)}>
        {t('friends.accept')}
      </button>
      <button className="btn ghost sm" onClick={() => removeFriendship(f.id)}>
        {t('friends.decline')}
      </button>
    </span>
  );
}
