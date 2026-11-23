import { useParams } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { FriendButton } from '../components/FriendButton';
import { useI18n } from '../i18n';
import { useMe } from '../lib/auth';
import { useFriendships, useProfileByUsername } from '../lib/data';

export function UserPage() {
  const { username = '' } = useParams();
  const { t } = useI18n();
  const me = useMe();
  const { loading, profile } = useProfileByUsername(username.toLowerCase());
  const friendships = useFriendships(me.uid);
  if (loading) return <div className="page center muted">{t('common.loading')}</div>;
  if (!profile) return <div className="page center muted">{t('notfound')}</div>;
  return (
    <div className="page narrow">
      <div className="card profile-card">
        <Avatar p={profile} size={96} />
        <h1>{profile.displayName}</h1>
        <p className="muted">@{profile.username}</p>
        {profile.bio && <p>{profile.bio}</p>}
        <FriendButton other={profile} friendships={friendships} />
      </div>
    </div>
  );
}
