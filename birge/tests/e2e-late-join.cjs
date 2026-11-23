// End-to-end: late joiner, autoplay block, admin reload. Needs: emulators + dev:emulators + public/test.webm (see README).
const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:5173';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function ok(c, m) { if (!c) throw new Error('FAIL: ' + m); console.log('  ✓ ' + m); }
(async () => {
  const free = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const strict = await chromium.launch({ args: ['--autoplay-policy=user-gesture-required'] });
  const mk = async (br, sub) => {
    const page = await (await br.newContext({ viewport: { width: 1300, height: 820 } })).newPage();
    page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 200)));
    await page.goto(BASE);
    await page.waitForFunction(() => window.__birgeTestSignIn);
    await page.evaluate((s) => window.__birgeTestSignIn(s, s), sub);
    await page.waitForSelector('.me-chip');
    return page;
  };
  const A = await mk(free, 'adm' + Date.now());
  await A.fill('.create input.input', 'Late join test');
  await A.click('.create button.btn.primary');
  await A.waitForURL(/\/room\//);
  await A.fill('.admin-bar input.grow', BASE + '/test.webm');
  await A.click('.admin-bar button.btn.primary');
  await A.waitForSelector('.stage video');
  await sleep(3500);
  await A.evaluate(() => { const v = document.querySelector('.stage video'); v.currentTime = 30; v.play(); });
  await sleep(3000);

  const carolId = 'carol' + Date.now();
  let C = await mk(strict, carolId);
  await C.goto(A.url());
  await C.click('.join-card button');
  await C.waitForSelector('.stage video');
  await sleep(3000);
  ok(!(await C.evaluate(() => document.querySelector('.stage video').paused)), 'joining by click starts playback directly');
  const ctxC = C.context(); await C.close();
  C = await ctxC.newPage(); // new tab: no user gesture yet
  // Emulate a browser autoplay block: play() rejects until the user clicks somewhere
  await C.addInitScript(() => {
    let allowed = false;
    document.addEventListener('click', () => (allowed = true), true);
    const orig = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (!allowed) return Promise.reject(new DOMException('blocked', 'NotAllowedError'));
      return orig.call(this);
    };
  });
  await C.goto(A.url());
  await C.waitForSelector('.stage-blocked', { timeout: 10000 });
  ok(true, 'autoplay-blocked overlay shown to late joiner');
  await C.screenshot({ path: (process.argv[2] || require('os').tmpdir()) + '/blocked.png' });
  await C.click('.stage-blocked');
  await sleep(3000);
  const st = (p) => p.evaluate(() => { const v = document.querySelector('.stage video'); return { t: v.currentTime, paused: v.paused }; });
  const a = await st(A), c = await st(C);
  console.log('  ', a, c);
  ok(!c.paused && Math.abs(a.t - c.t) < 1.2 && c.t > 33, 'late joiner synced mid-movie');

  // admin reloads mid-movie with strict autoplay: must NOT pause everyone
  await A.reload();
  await A.waitForSelector('.stage video');
  await sleep(4500);
  const c2 = await st(C);
  ok(!c2.paused, 'admin reload does not pause viewers');
  await free.close(); await strict.close();
  console.log('ALL PASSED');
})().catch((e) => { console.error(e.message); process.exit(1); });
