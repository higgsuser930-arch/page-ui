import { Link, NavLink, Outlet } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useAuth, useMe } from '../lib/auth';
import { isUnread, useDmThreads, useFriendships } from '../lib/data';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { LangSwitch } from './LangSwitch';
import { Logo } from './Logo';

export function Layout() {
  const { t } = useI18n();
  const { signOut } = useAuth();
  const me = useMe();
  const friendships = useFriendships(me.uid);
  const threads = useDmThreads(me.uid);
  const incoming = friendships?.filter((f) => f.status === 'pending' && f.requestedBy !== me.uid).length ?? 0;
  const unread = threads?.filter((th) => isUnread(th, me.uid)).length ?? 0;

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          <Logo />
        </Link>
        <nav className="nav">
          <NavLink to="/" end>
            <Icon name="film" size={18} />
            <span>{t('nav.rooms')}</span>
          </NavLink>
          <NavLink to="/friends">
            <Icon name="users" size={18} />
            <span>{t('nav.friends')}</span>
            {incoming > 0 && <em className="badge">{incoming}</em>}
          </NavLink>
          <NavLink to="/messages">
            <Icon name="chat" size={18} />
            <span>{t('nav.messages')}</span>
            {unread > 0 && <em className="badge">{unread}</em>}
          </NavLink>
        </nav>
        <div className="top-right">
          <LangSwitch />
          <NavLink to="/settings" className="me-chip" title={t('nav.settings')}>
            <Avatar p={me} size={30} />
            <span className="me-name">@{me.username}</span>
          </NavLink>
          <button className="btn ghost icon-only" onClick={signOut} title={t('auth.signout')} aria-label={t('auth.signout')}>
            <Icon name="logout" size={18} />
          </button>
        </div>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
