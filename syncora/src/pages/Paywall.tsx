import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { LangSwitch } from '../components/LangSwitch';
import { Logo } from '../components/Logo';
import { useI18n } from '../i18n';
import { useAuth, useMe } from '../lib/auth';
import { introEligible, paymentsConfigured, startCheckout, type AppConfig, type Subscription } from '../lib/subscription';

export function Paywall({ cfg, sub }: { cfg: AppConfig; sub: Subscription | null }) {
  const { t, lang } = useI18n();
  const { signOut } = useAuth();
  const me = useMe();
  const [state, setState] = useState<'idle' | 'opening' | 'waiting' | 'failed'>('idle');
  const intro = introEligible(sub);
  const amount = intro ? cfg.introPriceKzt : cfg.priceKzt;

  async function pay() {
    setState('opening');
    try {
      const r = await startCheckout(me, cfg, sub, lang, t('sub.title'));
      // Access opens when the server confirms the payment (the subscription document updates live).
      setState(r === 'success' ? 'waiting' : 'failed');
    } catch {
      setState('failed');
    }
  }

  return (
    <div className="landing paywall">
      <header className="landing-top">
        <Logo size={26} />
        <div className="row gap-s">
          <LangSwitch />
          <button className="btn ghost icon-only" onClick={signOut} title={t('auth.signout')} aria-label={t('auth.signout')}>
            <Icon name="logout" size={18} />
          </button>
        </div>
      </header>
      <section className="plan card">
        <h1>{t('sub.title')}</h1>
        <p className="muted">{t('sub.lead')}</p>
        {intro ? (
          <>
            <span className="tag big">{t('sub.intro.badge')}</span>
            <div className="price">
              <s className="muted">{cfg.priceKzt} ₸</s> <b>{cfg.introPriceKzt} ₸</b>
            </div>
            <p>
              {t('sub.intro.price', { intro: cfg.introPriceKzt })}, <span className="muted">{t('sub.intro.then', { price: cfg.priceKzt })}</span>
            </p>
          </>
        ) : (
          <div className="price">
            <b>{cfg.priceKzt} ₸</b> <span className="muted small">/ {lang === 'en' ? 'month' : 'ай'}</span>
          </div>
        )}
        <ul className="plan-features">
          {(['sub.f1', 'sub.f2', 'sub.f3', 'sub.f4'] as const).map((k) => (
            <li key={k}>
              <Icon name="check" size={18} /> {t(k)}
            </li>
          ))}
        </ul>
        {paymentsConfigured ? (
          <button className="btn primary big" onClick={pay} disabled={state === 'opening' || state === 'waiting'}>
            {state === 'waiting' ? t('sub.waiting') : t('sub.pay', { amount })}
          </button>
        ) : (
          <p className="note">{t('sub.notReady')}</p>
        )}
        {state === 'failed' && <p className="error small">{t('sub.failed')}</p>}
        <p className="muted xsmall">{t('sub.auto')}</p>
        <p className="muted xsmall">
          {t('sub.agree', { offer: '§1', privacy: '§2' })
            .split(/(§1|§2)/)
            .map((part, i) =>
              part === '§1' ? (
                <Link key={i} to="/legal/offer">
                  {t('legal.offer')}
                </Link>
              ) : part === '§2' ? (
                <Link key={i} to="/legal/privacy">
                  {t('legal.privacy')}
                </Link>
              ) : (
                part
              ),
            )}
        </p>
      </section>
      <LegalFooter />
    </div>
  );
}

export function LegalFooter() {
  const { t } = useI18n();
  return (
    <footer className="landing-foot muted small legal-links">
      <span>© {new Date().getFullYear()} SYNCORA</span>
      <Link to="/legal/offer">{t('legal.offer')}</Link>
      <Link to="/legal/privacy">{t('legal.privacy')}</Link>
      <Link to="/legal/refund">{t('legal.refund')}</Link>
    </footer>
  );
}
