// Shared helpers for the e2e tests (emulators must be running).
const crypto = require('crypto');
const FS = 'http://127.0.0.1:8080/v1/projects/demo-syncora/databases/(default)/documents';
const FN = 'http://127.0.0.1:5001/demo-syncora/europe-west1';
const SECRET = 'test_secret_for_emulator'; // functions/.secret.local

async function setConfig(fields) {
  const body = { fields: {} };
  for (const [k, v] of Object.entries(fields))
    body.fields[k] = typeof v === 'boolean' ? { booleanValue: v } : { integerValue: String(v) };
  const r = await fetch(`${FS}/config/app`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('setConfig ' + r.status);
}

async function getDoc(path) {
  const r = await fetch(`${FS}/${path}`, { headers: { Authorization: 'Bearer owner' } });
  return r.ok ? r.json() : null;
}

/** Posts a CloudPayments-style form-encoded notification signed with the API secret. */
async function notify(kind, params, { badSignature = false } = {}) {
  const body = new URLSearchParams(params).toString();
  const hmac = crypto.createHmac('sha256', badSignature ? 'wrong' : SECRET).update(body).digest('base64');
  const r = await fetch(`${FN}/cp${kind}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-HMAC': hmac }, body });
  return { status: r.status, body: await r.json().catch(() => null) };
}

module.exports = { setConfig, getDoc, notify };
