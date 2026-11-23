import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { useI18n } from '../i18n';
import { useMe } from '../lib/auth';
import { cancelSubscription, isActive, useAppConfig, useSubscription } from '../lib/subscription';
import { updateProfile } from '../lib/data';
import { changeUsername, isUsernameFree, normalizeUsername, randomUsername, USERNAME_RE } from '../lib/usernames';

export function Settings() {
  const { t, lang, setLang } = useI18n();
  const me = useMe();
  const [username, setUsername] = useState(me.username);
  const [displayName, setDisplayName] = useState(me.displayName);
  const [bio, setBio] = useState(me.bio ?? '');
  const [status, setStatus] = useState<'idle' | 'checking' | 'free' | 'taken' | 'invalid'>('idle');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const norm = normalizeUsername(username);
  useEffect(() => {
    if (norm === me.username) return setStatus('idle');
    if (!USERNAME_RE.test(norm)) return setStatus('invalid');
    setStatus('checking');
    const id = setTimeout(async () => setStatus((await isUsernameFree(norm, me.uid)) ? 'free' : 'taken'), 300);
    return () => clearTimeout(id);
  }, [norm, me.username, me.uid]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      if (norm !== me.username) await changeUsername(me.uid, norm);
      await updateProfile(me.uid, { displayName: displayName.trim().slice(0, 40) || norm, bio: bio.slice(0, 160), lang });
      setMsg(t('settings.saved'));
    } catch (err) {
      const m = (err as Error).message;
      setMsg(m === 'taken' ? t('settings.username.taken') : m === 'invalid' ? t('settings.username.invalid') : t('common.error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page narrow">
      <h1>{t('settings.title')}</h1>
      <form className="card form" onSubmit={save}>
        <div className="row gap">
          <Avatar p={{ ...me, displayName }} size={64} />
          <div>
            <b>{displayName}</b>
            <div className="muted">@{norm}</div>
          </div>
        </div>
        <label className="field">
          <span>{t('settings.username')}</span>
          <div className="row gap-s">
            <div className="prefix-input grow">
              <i>@</i>
              <input className="input" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} maxLength={21} autoComplete="off" spellCheck={false} />
            </div>
            <button type="button" className="btn ghost sm" onClick={() => setUsername(randomUsername())}>
              {t('settings.random')}
            </button>
          </div>
          <small className={status === 'taken' || status === 'invalid' ? 'error' : status === 'free' ? 'ok' : 'muted'}>
            {status === 'taken'
              ? t('settings.username.taken')
              : status === 'invalid'
                ? t('settings.username.invalid')
                : status === 'free'
                  ? '✓ ' + t('settings.username.ok')
                  : t('settings.username.help')}
          </small>
        </label>
        <label className="field">
          <span>{t('settings.displayName')}</span>
          <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} />
        </label>
        <label className="field">
          <span>{t('settings.bio')}</span>
          <textarea className="input" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={160} rows={3} />
        </label>
        <label className="field">
          <span>{t('settings.lang')}</span>
          <select className="input" value={lang} onChange={(e) => setLang(e.target.value as 'kk' | 'en')}>
            <option value="kk">Қазақша</option>
            <option value="en">English</option>
          </select>
        </label>
        <div className="row gap">
          <button className="btn primary" disabled={busy || status === 'taken' || status === 'invalid' || status === 'checking'}>
            {t('common.save')}
          </button>
          {msg && <span className="small">{msg}</span>}
        </div>
      </form>
      <SubscriptionCard uid={me.uid} />
    </div>
  );
}

function SubscriptionCard({ uid }: { uid: string }) {
  const { t, lang } = useI18n();
  const sub = useSubscription(uid);
  const cfg = useAppConfig();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  if (!cfg?.subscriptionRequired && !sub) return null;
  const active = isActive(sub);
  const cancelled = sub?.status === 'cancelled' || sub?.status === 'expired' || sub?.status === 'rejected';
  const date = sub?.paidUntil?.toDate().toLocaleDateString(lang === 'en' ? 'en-GB' : 'kk-KZ', { day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <div className="card form sub-card">
      <h2>{t('sub.section')}</h2>
      <div className="row between wrap gap">
        <div>
          <span className={`tag big ${active && !cancelled ? '' : 'off'}`}>
            {!active ? t('sub.status.none') : cancelled ? t('sub.status.cancelled') : t('sub.status.active')}
          </span>
          {date && <p className="small" style={{ marginTop: 8 }}>{t('sub.until', { date })}</p>}
          {active && !cancelled && cfg && <p className="muted small">{t('sub.next', { price: cfg.priceKzt })}</p>}
        </div>
        {active && !cancelled && sub?.cpSubscriptionId && (
          <button
            className="btn danger sm"
            disabled={busy}
            onClick={async () => {
              if (!confirm(t('sub.cancel.confirm'))) return;
              setBusy(true);
              setMsg('');
              try {
                await cancelSubscription();
                setMsg(t('sub.cancelled'));
              } catch {
                setMsg(t('common.error'));
              } finally {
                setBusy(false);
              }
            }}
          >
            {t('sub.cancel')}
          </button>
        )}
      </div>
      {msg && <p className="small">{msg}</p>}
      <div className="legal-links small">
        <Link to="/legal/offer">{t('legal.offer')}</Link>
        <Link to="/legal/privacy">{t('legal.privacy')}</Link>
        <Link to="/legal/refund">{t('legal.refund')}</Link>
      </div>
    </div>
  );
}
