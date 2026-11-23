// SYNCORA subscriptions: CloudPayments webhooks + cancel.
// Prices live in Firestore `config/app` (priceKzt, introPriceKzt) so they can be changed without a redeploy.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { defineSecret, defineString } from 'firebase-functions/params';
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';

initializeApp();
const db = getFirestore();

const CP_PUBLIC_ID = defineString('CP_PUBLIC_ID', { default: '' });
const CP_API_URL = defineString('CP_API_URL', { default: 'https://api.cloudpayments.ru' });
const CP_API_SECRET = defineSecret('CP_API_SECRET');

const DEFAULTS = { priceKzt: 999, introPriceKzt: 499 };
const DAY = 24 * 60 * 60 * 1000;
const GRACE_DAYS = 2; // keep access a little after the period ends, while a renewal is being retried

// CloudPayments answer codes
const OK = 0, BAD_ACCOUNT = 11, BAD_AMOUNT = 12, REJECT = 13;

async function prices() {
  const snap = await db.doc('config/app').get();
  return { ...DEFAULTS, ...(snap.exists ? snap.data() : {}) };
}

/** Parses both form-encoded and JSON notifications and checks the HMAC signature. */
function readNotification(req, secret) {
  const raw = req.rawBody ?? Buffer.from('');
  const sig = req.get('Content-HMAC') || req.get('X-Content-HMAC') || '';
  const expected = createHmac('sha256', secret).update(raw).digest('base64');
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (!sig || a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const text = raw.toString('utf8');
  if ((req.get('content-type') || '').includes('json')) return JSON.parse(text || '{}');
  return Object.fromEntries(new URLSearchParams(text));
}

function addMonth(from) {
  const d = new Date(from);
  d.setMonth(d.getMonth() + 1);
  return d;
}

async function handle(kind, n) {
  const uid = n.AccountId;
  const amount = Number(n.Amount);
  const p = await prices();
  if (kind === 'recurrent') {
    // subscription status change: Active, PastDue, Cancelled, Rejected, Expired
    const snap = await db.collection('subscriptions').where('cpSubscriptionId', '==', n.Id).limit(1).get();
    if (!snap.empty) {
      await snap.docs[0].ref.set(
        {
          status: String(n.Status || '').toLowerCase(),
          nextChargeAt: n.NextTransactionDate ? Timestamp.fromDate(new Date(n.NextTransactionDate)) : null,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }
    return OK;
  }

  if (!uid || !(await db.doc(`users/${uid}`).get()).exists) return BAD_ACCOUNT;
  if (n.Currency && n.Currency !== 'KZT') return BAD_AMOUNT;

  const subRef = db.doc(`subscriptions/${uid}`);
  const sub = (await subRef.get()).data() || {};
  const isRenewal = Boolean(n.SubscriptionId && sub.cpSubscriptionId === n.SubscriptionId);
  const introAllowed = !sub.introUsed && !isRenewal;
  const allowed = amount === p.priceKzt || (introAllowed && amount === p.introPriceKzt);

  if (kind === 'check') return allowed ? OK : BAD_AMOUNT;
  if (kind === 'fail') {
    await db.collection('payments').add({ uid, amount, status: 'failed', reason: n.Reason || '', at: FieldValue.serverTimestamp() });
    return OK;
  }
  if (kind !== 'pay') return OK;

  // Idempotent: CloudPayments may resend the same notification
  const payRef = db.doc(`payments/${n.TransactionId}`);
  if ((await payRef.get()).exists) return OK;
  if (!allowed) {
    logger.warn('Unexpected amount', { uid, amount, introAllowed });
    await payRef.set({ uid, amount, status: 'rejected-amount', at: FieldValue.serverTimestamp() });
    return OK; // already charged — accept the notification, but grant nothing; refund manually
  }

  await db.runTransaction(async (tx) => {
    const cur = (await tx.get(subRef)).data() || {};
    const now = Date.now();
    const base = Math.max(now, cur.paidUntil?.toMillis?.() ?? 0);
    const paidUntil = addMonth(base);
    tx.set(payRef, { uid, amount, status: 'paid', subscriptionId: n.SubscriptionId || null, at: FieldValue.serverTimestamp() });
    tx.set(
      subRef,
      {
        uid,
        status: 'active',
        paidUntil: Timestamp.fromDate(paidUntil),
        // rules check this field: paid period + a short grace for retried renewals
        activeUntil: Timestamp.fromMillis(paidUntil.getTime() + GRACE_DAYS * DAY),
        introUsed: true,
        cpSubscriptionId: n.SubscriptionId || cur.cpSubscriptionId || null,
        lastAmount: amount,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });
  return OK;
}

function webhook(kind) {
  return onRequest({ secrets: [CP_API_SECRET], region: 'europe-west1' }, async (req, res) => {
    if (req.method !== 'POST') return void res.status(405).send('POST only');
    const n = readNotification(req, CP_API_SECRET.value());
    if (!n) {
      logger.warn('Bad HMAC', { kind });
      return void res.status(401).json({ code: REJECT });
    }
    try {
      res.json({ code: await handle(kind, n) });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ code: REJECT });
    }
  });
}

export const cpCheck = webhook('check');
export const cpPay = webhook('pay');
export const cpFail = webhook('fail');
export const cpRecurrent = webhook('recurrent');

/** Stops future renewals. Access stays until the paid period ends. */
export const cancelSubscription = onCall({ secrets: [CP_API_SECRET], region: 'europe-west1' }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first');
  const ref = db.doc(`subscriptions/${uid}`);
  const sub = (await ref.get()).data();
  if (!sub?.cpSubscriptionId) throw new HttpsError('failed-precondition', 'No subscription');
  const r = await fetch(`${CP_API_URL.value()}/subscriptions/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Basic ' + Buffer.from(`${CP_PUBLIC_ID.value()}:${CP_API_SECRET.value()}`).toString('base64'),
    },
    body: JSON.stringify({ Id: sub.cpSubscriptionId }),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok || body.Success === false) throw new HttpsError('internal', body.Message || 'Cancel failed');
  await ref.set({ status: 'cancelled', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true };
});
