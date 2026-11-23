import { doc, onSnapshot, type Timestamp } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import { useEffect, useState } from 'react';
import { serverNow } from './clock';
import { app, db, useEmulators } from './firebase';
import type { Profile } from './types';

export type AppConfig = { subscriptionRequired: boolean; priceKzt: number; introPriceKzt: number };
export type Subscription = {
  status?: string;
  paidUntil?: Timestamp;
  activeUntil?: Timestamp;
  introUsed?: boolean;
  cpSubscriptionId?: string | null;
};

export const DEFAULT_CONFIG: AppConfig = { subscriptionRequired: true, priceKzt: 999, introPriceKzt: 499 };

export function useAppConfig() {
  const [cfg, setCfg] = useState<AppConfig | null>(null);
  useEffect(
    () =>
      onSnapshot(
        doc(db, 'config', 'app'),
        (s) => setCfg({ ...DEFAULT_CONFIG, ...(s.exists() ? (s.data() as Partial<AppConfig>) : {}) }),
        () => setCfg(DEFAULT_CONFIG),
      ),
    [],
  );
  return cfg;
}

export function useSubscription(uid: string | undefined) {
  const [sub, setSub] = useState<Subscription | null | undefined>(undefined); // undefined = loading
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      doc(db, 'subscriptions', uid),
      (s) => setSub(s.exists() ? (s.data() as Subscription) : null),
      () => setSub(null),
    );
  }, [uid]);
  return sub;
}

export function isActive(sub: Subscription | null | undefined) {
  return Boolean(sub?.activeUntil && sub.activeUntil.toMillis() > serverNow());
}

export function introEligible(sub: Subscription | null | undefined) {
  return !sub?.introUsed;
}

/* ---------- CloudPayments widget ---------- */

const WIDGET_URL = import.meta.env.VITE_CP_WIDGET_URL || 'https://widget.cloudpayments.ru/bundles/cloudpayments.js';
const PUBLIC_ID = import.meta.env.VITE_CP_PUBLIC_ID || '';
export const paymentsConfigured = Boolean(PUBLIC_ID);

type CpWidget = { pay(method: 'charge', opts: unknown, cb: { onSuccess?: () => void; onFail?: (reason: string) => void; onComplete?: () => void }): void };
declare global {
  interface Window {
    cp?: { CloudPayments: new (opts?: unknown) => CpWidget };
  }
}

let widgetPromise: Promise<void> | null = null;
function loadWidget() {
  if (window.cp) return Promise.resolve();
  widgetPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = WIDGET_URL;
    s.onload = () => resolve();
    s.onerror = () => {
      widgetPromise = null;
      reject(new Error('Payment widget failed to load'));
    };
    document.head.appendChild(s);
  });
  return widgetPromise;
}

/**
 * Opens the card form. First charge is the intro price (new users) or the full price,
 * and it creates a monthly recurring subscription at the full price.
 * Access is granted only by the server webhook, never by this callback.
 */
export async function startCheckout(me: Profile, cfg: AppConfig, sub: Subscription | null | undefined, lang: 'kk' | 'en', description: string) {
  await loadWidget();
  if (!window.cp) throw new Error('Payment widget unavailable');
  const first = introEligible(sub) ? cfg.introPriceKzt : cfg.priceKzt;
  const widget = new window.cp.CloudPayments({ language: lang === 'en' ? 'en-US' : 'kk' });
  return new Promise<'success' | 'fail'>((resolve) => {
    widget.pay(
      'charge',
      {
        publicId: PUBLIC_ID,
        description,
        amount: first,
        currency: 'KZT',
        accountId: me.uid,
        invoiceId: `${me.uid}-${Date.now()}`,
        skin: 'modern',
        data: {
          CloudPayments: {
            recurrent: { interval: 'Month', period: 1, amount: cfg.priceKzt },
          },
        },
      },
      { onSuccess: () => resolve('success'), onFail: () => resolve('fail') },
    );
  });
}

let functionsReady = false;
function fns() {
  const f = getFunctions(app, 'europe-west1');
  if (useEmulators && !functionsReady) {
    connectFunctionsEmulator(f, location.hostname, 5001);
    functionsReady = true;
  }
  return f;
}

export async function cancelSubscription() {
  await httpsCallable(fns(), 'cancelSubscription')();
}
