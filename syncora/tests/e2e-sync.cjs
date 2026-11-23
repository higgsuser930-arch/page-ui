// End-to-end: two users, sync of play/seek/pause, room chat, friends, DMs. Needs: emulators + dev:emulators + public/test.webm (see README).
const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:5173';
const SHOTS = process.argv[2] || require('os').tmpdir();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function ok(cond, msg) { if (!cond) { throw new Error('FAIL: ' + msg); } console.log('  ✓ ' + msg); }

(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const mk = async (sub, name) => {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 860 }, locale: 'kk-KZ' });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log(`[${name} pageerror]`, e.message));
    page.on('console', (m) => { if (m.type() === 'error') console.log(`[${name} console]`, m.text().slice(0, 200)); });
    await page.goto(BASE);
    await page.waitForFunction(() => window.__syncoraTestSignIn);
    await page.evaluate(([s, n]) => window.__syncoraTestSignIn(s, n), [sub, name]);
    await page.waitForSelector('.me-chip', { timeout: 15000 });
    return page;
  };
  const A = await mk('alice' + Date.now(), 'Alice Test');
  const B = await mk('bob' + Date.now(), 'Bob Test');
  const nameA = (await A.textContent('.me-name')).trim();
  ok(/^@[a-z0-9_]{3,20}$/.test(nameA), 'random username assigned: ' + nameA);

  // change username
  const uname = 'alice_' + String(Date.now()).slice(-6);
  await A.click('.me-chip');
  await A.fill('.prefix-input input', uname);
  await A.waitForSelector('small.ok');
  await A.click('form.form button.btn.primary');
  await A.waitForFunction((u) => document.querySelector('.me-name')?.textContent === '@' + u, uname);
  ok(true, 'username changed to @' + uname);
  await A.screenshot({ path: SHOTS + '/settings.png' });

  // create room
  await A.click('.nav a[href="/"]');
  await A.fill('.create input.input', 'Жұма кешкі кино');
  await A.click('.create button.btn.primary');
  await A.waitForURL(/\/room\//);
  const roomUrl = A.url();
  ok(true, 'room created ' + roomUrl);

  // bob joins
  await B.goto(roomUrl);
  await B.click('text=Бөлмеге қосылу').catch(async () => B.click('text=Join room'));
  await B.waitForSelector('.stage');
  ok(true, 'bob joined');

  // admin sets video
  await A.fill('.admin-bar input.grow', BASE + '/test.webm');
  await A.fill('.admin-bar .title-input', 'Test film');
  await A.click('.admin-bar button.btn.primary');
  await A.waitForSelector('.stage video');
  await B.waitForSelector('.stage video');
  await A.waitForFunction(() => document.querySelector('.stage video').readyState >= 1);
  ok(true, 'video loaded for both');
  await sleep(3500); // let the initial suppression window pass

  const state = (p) => p.evaluate(() => { const v = document.querySelector('.stage video'); return { t: v.currentTime, paused: v.paused }; });

  await A.evaluate(() => document.querySelector('.stage video').play());
  await sleep(4000);
  let a = await state(A), b = await state(B);
  console.log('   after play', a, b);
  ok(!b.paused && Math.abs(a.t - b.t) < 1.2, 'bob follows play (drift ' + (a.t - b.t).toFixed(2) + 's)');

  await A.evaluate(() => { document.querySelector('.stage video').currentTime = 60; });
  await sleep(3000);
  a = await state(A); b = await state(B);
  console.log('   after seek', a, b);
  ok(b.t > 58 && Math.abs(a.t - b.t) < 1.2, 'bob follows seek (drift ' + (a.t - b.t).toFixed(2) + 's)');

  await A.evaluate(() => document.querySelector('.stage video').pause());
  await sleep(2500);
  a = await state(A); b = await state(B);
  console.log('   after pause', a, b);
  ok(b.paused && Math.abs(a.t - b.t) < 1.0, 'bob follows pause');

  // bob tries to play on his own -> gets corrected back
  await B.evaluate(() => document.querySelector('.stage video').play());
  await sleep(2000);
  b = await state(B);
  ok(b.paused, 'non-admin cannot override playback');

  // chat
  await B.fill('.composer input', 'Сәлем! Кино керемет 🍿');
  await B.press('.composer input', 'Enter');
  await A.waitForSelector('text=Сәлем! Кино керемет 🍿');
  ok(true, 'room chat delivered');
  await A.evaluate(() => document.querySelector('.stage video').play());
  await sleep(1500);
  await A.screenshot({ path: SHOTS + '/room-admin.png' });
  await B.screenshot({ path: SHOTS + '/room-viewer.png' });

  // friends
  await B.click('.nav a[href="/friends"]');
  await B.fill('.search input', uname);
  await B.waitForSelector('.list .person');
  await B.click('.list .person button.btn.primary');
  await A.waitForSelector('.nav a[href="/friends"] .badge');
  ok(true, 'friend request badge shown to alice');
  await A.click('.nav a[href="/friends"]');
  await A.click('button:has-text("Қабылдау")');
  await A.waitForSelector('text=Достарым');
  await A.click('.list button:has-text("Жазу")');
  await A.waitForURL(/\/messages\//);
  await A.fill('.composer input', 'Бүгін кешке кино көрейік пе?');
  await A.press('.composer input', 'Enter');
  await B.waitForSelector('.nav a[href="/messages"] .badge');
  ok(true, 'unread DM badge shown to bob');
  await B.click('.nav a[href="/messages"]');
  await B.click('.dm-item');
  await B.waitForSelector('text=Бүгін кешке кино көрейік пе?');
  ok(true, 'DM delivered');

  // invite from room
  await A.goto(roomUrl);
  await A.click('button:has-text("Шақыру")');
  await A.waitForSelector('.modal .person button');
  await A.screenshot({ path: SHOTS + '/invite.png' });
  await A.keyboard.press('Escape');
  await B.screenshot({ path: SHOTS + '/dm.png' });
  await B.click('.nav a[href="/"]');
  await B.waitForSelector('.room-card');
  await B.screenshot({ path: SHOTS + '/home.png' });

  // English
  await B.click('.lang-switch button:has-text("ENG")');
  await B.waitForSelector('text=Your rooms');
  ok(true, 'english UI');

  // mobile
  const m = await browser.newContext({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 1 });
  const mp = await m.newPage();
  await mp.goto(BASE);
  await mp.screenshot({ path: SHOTS + '/landing-mobile.png' });
  const big = await browser.newContext({ viewport: { width: 1400, height: 860 } });
  const lp = await big.newPage();
  await lp.goto(BASE);
  await lp.waitForSelector('.hero');
  await lp.screenshot({ path: SHOTS + '/landing.png' });
  await browser.close();
  console.log('ALL PASSED');
})().catch((e) => { console.error(e.message); process.exit(1); });
