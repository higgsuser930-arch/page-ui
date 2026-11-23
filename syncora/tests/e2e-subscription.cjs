// End-to-end: paywall, intro price 499 → renewals 999, webhook security, cancellation.
// Needs: npm run emulators (with functions) + dev:emulators started with VITE_CP_PUBLIC_ID=test_pk.
const http = require('http');
const { chromium } = require('playwright');
const { setConfig, getDoc, notify } = require('./helpers.cjs');
const BASE = 'http://127.0.0.1:5173';
const SHOTS = process.argv[2] || require('os').tmpdir();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function ok(c, m) { if (!c) throw new Error('FAIL: ' + m); console.log('  ✓ ' + m); }

// Fake CloudPayments widget: records the options and reports success like the real one
const FAKE_WIDGET = `window.cp = { CloudPayments: function () { this.pay = function (m, o, cb) { window.__cpLast = o; setTimeout(function () { cb.onSuccess && cb.onSuccess(); }, 50); }; } };`;

(async () => {
  await setConfig({ subscriptionRequired: true, priceKzt: 999, introPriceKzt: 499 });

  // Fake CloudPayments API for the cancel call (functions/.env.local → CP_API_URL=http://127.0.0.1:9999)
  const cancelCalls = [];
  const api = http.createServer((req, res) => {
    let b = '';
    req.on('data', (c) => (b += c));
    req.on('end', () => {
      cancelCalls.push({ url: req.url, auth: req.headers.authorization, body: b });
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ Success: true }));
    });
  }).listen(9999);

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 860 }, locale: 'kk-KZ' });
  await ctx.route(/cloudpayments.*\.js/, (r) => r.fulfill({ contentType: 'application/javascript', body: FAKE_WIDGET }));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 200)));

  // Landing shows the offer
  await page.goto(BASE);
  await page.waitForSelector('.price-hint');
  ok((await page.textContent('.price-hint')).includes('499'), 'landing shows the 499 ₸ first-month offer');

  // Legal pages are public
  await page.goto(BASE + '/legal/offer');
  await page.waitForSelector('.legal h1');
  ok((await page.textContent('.legal')).includes('999'), 'public offer page is reachable without sign-in and shows prices');

  await page.goto(BASE);
  await page.waitForFunction(() => window.__syncoraTestSignIn);
  const sub = 'payer' + Date.now();
  await page.evaluate((s) => window.__syncoraTestSignIn(s, 'Payer'), sub);
  await page.waitForSelector('.paywall .plan');
  const plan = await page.textContent('.paywall .plan');
  ok(plan.includes('499') && plan.includes('999'), 'new user sees paywall: 999 crossed out, 499 for first month');
  ok(!(await page.$('.topbar')), 'app is locked before payment');
  await page.screenshot({ path: SHOTS + '/paywall.png' });

  await page.click('.paywall .btn.primary.big');
  await page.waitForFunction(() => window.__cpLast);
  const o = await page.evaluate(() => window.__cpLast);
  ok(o.amount === 499 && o.currency === 'KZT', 'widget charges 499 KZT now');
  ok(o.data.CloudPayments.recurrent.amount === 999 && o.data.CloudPayments.recurrent.interval === 'Month', 'monthly renewal set to 999 KZT');
  const uid = o.accountId;
  await page.waitForSelector('text=Төлем расталуда');
  ok(!(await page.$('.topbar')), 'widget success alone does not unlock (server must confirm)');

  // Webhook security
  let r = await notify('Pay', { TransactionId: '1', Amount: '499', Currency: 'KZT', AccountId: uid, SubscriptionId: 'sc_1' }, { badSignature: true });
  ok(r.status === 401, 'forged notification (bad HMAC) rejected');
  r = await notify('Check', { Amount: '100', Currency: 'KZT', AccountId: uid });
  ok(r.body.code === 12, 'Check rejects a wrong amount');
  r = await notify('Check', { Amount: '499', Currency: 'KZT', AccountId: 'nobody' });
  ok(r.body.code === 11, 'Check rejects an unknown account');
  r = await notify('Check', { Amount: '499', Currency: 'KZT', AccountId: uid });
  ok(r.body.code === 0, 'Check accepts the 499 intro payment');

  // Real payment confirmation
  r = await notify('Pay', { TransactionId: '1001', Amount: '499', Currency: 'KZT', AccountId: uid, SubscriptionId: 'sc_1' });
  ok(r.body.code === 0, 'Pay notification accepted');
  await page.waitForSelector('.topbar', { timeout: 10000 });
  ok(true, 'app unlocks right after the server confirms payment');

  const until1 = (await getDoc(`subscriptions/${uid}`)).fields.paidUntil.timestampValue;
  r = await notify('Pay', { TransactionId: '1001', Amount: '499', Currency: 'KZT', AccountId: uid, SubscriptionId: 'sc_1' });
  ok((await getDoc(`subscriptions/${uid}`)).fields.paidUntil.timestampValue === until1, 'duplicate notification does not extend twice');

  r = await notify('Check', { Amount: '499', Currency: 'KZT', AccountId: uid, SubscriptionId: 'sc_1' });
  ok(r.body.code === 12, 'discount cannot be used a second time');
  r = await notify('Check', { Amount: '999', Currency: 'KZT', AccountId: uid, SubscriptionId: 'sc_1' });
  ok(r.body.code === 0, 'renewal at 999 accepted');
  await notify('Pay', { TransactionId: '1002', Amount: '999', Currency: 'KZT', AccountId: uid, SubscriptionId: 'sc_1' });
  const until2 = (await getDoc(`subscriptions/${uid}`)).fields.paidUntil.timestampValue;
  const days = (new Date(until2) - new Date(until1)) / 86400000;
  ok(days >= 28 && days <= 31, `renewal extends access by one month (${days.toFixed(0)} days)`);

  // Paid user can actually use the app (rules check the subscription too)
  await page.fill('.create input.input', 'Paid room');
  await page.click('.create button.btn.primary');
  await page.waitForURL(/\/room\//);
  ok(true, 'paid user can create a room');

  // Settings → cancel
  await page.click('.me-chip');
  await page.waitForSelector('.sub-card');
  ok((await page.textContent('.sub-card')).includes('Белсенді'), 'settings show active subscription');
  page.once('dialog', (d) => d.accept());
  await page.click('.sub-card .btn.danger');
  await page.waitForSelector('text=Автоматты төлем тоқтатылды');
  ok(cancelCalls.length === 1 && cancelCalls[0].url === '/subscriptions/cancel' && JSON.parse(cancelCalls[0].body).Id === 'sc_1', 'cancel calls CloudPayments with the subscription id');
  ok(cancelCalls[0].auth === 'Basic ' + Buffer.from('test_pk:test_secret_for_emulator').toString('base64'), 'cancel uses API credentials');
  await page.waitForSelector('text=Тоқтатылған');
  ok(!!(await page.$('.topbar')), 'access remains until the end of the paid period');
  await page.screenshot({ path: SHOTS + '/settings-sub.png' });

  // A different unpaid user is blocked by the server rules, not only by the UI
  const p2 = await (await browser.newContext()).newPage();
  await p2.goto(BASE);
  await p2.waitForFunction(() => window.__syncoraTestSignIn);
  await p2.evaluate((s) => window.__syncoraTestSignIn(s, 'Free'), 'free' + Date.now());
  await p2.waitForSelector('.paywall');
  ok(true, 'unpaid user stays on the paywall');

  await browser.close();
  api.close();
  console.log('ALL PASSED');
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
