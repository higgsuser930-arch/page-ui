import { useI18n, type Lang } from '../i18n';
import { useAuth } from '../lib/auth';
import { updateProfile } from '../lib/data';

export function LangSwitch() {
  const { lang, setLang } = useI18n();
  const { profile } = useAuth();
  const pick = (l: Lang) => {
    setLang(l);
    if (profile && profile.lang !== l) updateProfile(profile.uid, { lang: l }).catch(() => undefined);
  };
  return (
    <div className="lang-switch" role="group" aria-label="Language">
      <button className={lang === 'kk' ? 'on' : ''} onClick={() => pick('kk')}>ҚАЗ</button>
      <button className={lang === 'en' ? 'on' : ''} onClick={() => pick('en')}>ENG</button>
    </div>
  );
}
