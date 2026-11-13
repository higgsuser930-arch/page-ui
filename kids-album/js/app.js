/* Дыбыс сиқыры — логопедиялық интерактивті альбом (37 дыбыс x 7 ойын + тыныс/артикуляция) */
(() => {
'use strict';
const D = window.ALBUM_DATA, EMO = window.WORD_EMOJI || {}, MAN = window.AUDIO_MANIFEST || {};
const $ = (s, r = document) => r.querySelector(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pic = w => EMO[w] || '🖼️';
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  kids.flat().forEach(c => c != null && c !== false && e.append(c.nodeType ? c : document.createTextNode(c)));
  return e;
}

/* ---------- сақтау ---------- */
const KEY = 'dybys-siqyry.v1';
let S = { name: '', mute: false, logo: false, res: {}, note: '', warm: {} };
try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
const rkey = (L, g, lv) => `${L}.${g}.${lv}`;
const LV = ['easy', 'medium', 'hard'], LVN = { easy: 'Жеңіл', medium: 'Орта', hard: 'Күрделі' };
const starsOf = (L, g) => { const r = LV.map(l => (S.res[rkey(L, g, l)] || {}).stars || 0); return r; };

/* ---------- дыбыс ---------- */
let audioEl = null, soundCtx = null;
function beep(freqs, dur = .12, type = 'sine') {
  if (S.mute) return;
  try {
    soundCtx = soundCtx || new (window.AudioContext || window.webkitAudioContext)();
    let t = soundCtx.currentTime;
    freqs.forEach(f => { const o = soundCtx.createOscillator(), g = soundCtx.createGain(); o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.18, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      o.connect(g).connect(soundCtx.destination); o.start(t); o.stop(t + dur + .02); t += dur * .8; });
  } catch (e) {}
}
const sfx = { ok: () => beep([523, 659, 784, 1046], .13), no: () => beep([330, 262], .18, 'triangle'), tap: () => beep([700], .05), star: () => beep([880, 1175], .1) };
function say(key, textFallback) {
  stopSay();
  if (S.mute) return Promise.resolve();
  return new Promise(res => {
    const f = MAN[key];
    const speak = () => {
      try {
        const t = textFallback || key.replace(/^(ui|snd|intro|done):/, ''), u = new SpeechSynthesisUtterance(t);
        const v = speechSynthesis.getVoices(); u.lang = 'kk-KZ';
        const kk = v.find(x => /^kk/i.test(x.lang)) || v.find(x => /^ru/i.test(x.lang)); if (kk) { u.voice = kk; u.lang = kk.lang; }
        u.rate = .85; u.onend = u.onerror = () => res(); speechSynthesis.cancel(); speechSynthesis.speak(u);
      } catch (e) { res(); }
    };
    if (!f) return speak();
    audioEl = new Audio('audio/' + f); audioEl.onended = () => res(); audioEl.onerror = speak;
    audioEl.play().catch(speak);
  });
}
function stopSay() { try { audioEl && audioEl.pause(); speechSynthesis.cancel(); } catch (e) {} }

/* ---------- эффектілер ---------- */
function confetti(n = 26) {
  const fx = $('#fx'), set = ['🎉', '⭐', '✨', '🎈', '💫', '🌟', '🍭'];
  for (let i = 0; i < n; i++) { const s = h('span', { class: 'conf' }, set[i % set.length]); s.style.left = Math.random() * 100 + 'vw'; s.style.animationDelay = Math.random() * .6 + 's'; s.style.fontSize = 22 + Math.random() * 28 + 'px'; fx.append(s); setTimeout(() => s.remove(), 3200); }
}

/* ---------- камера ---------- */
let camStream = null;
async function camOn(box) {
  const holder = h('div', { class: 'cam' }, h('span', { class: 'tag' }, '🪞 Айна'));
  box.append(holder);
  try {
    if (!camStream) camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 }, audio: false });
    const v = h('video', { autoplay: true, playsinline: true, muted: true }); v.muted = true; v.srcObject = camStream; holder.prepend(v); v.play().catch(() => {});
  } catch (e) { holder.append(h('div', { class: 'nocam' }, '📷 Камераға рұқсат берілмеді. Үлкен кісіден браузерде камераны қосуды сұра.')); }
  return holder;
}
function camOff() { if (camStream) { camStream.getTracks().forEach(t => t.stop()); camStream = null; } }

/* ---------- микрофон ---------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const Mic = { stream: null, ctx: null, an: null, buf: null, async init() {
  if (this.an) return true;
  try {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: true } });
    this.ctx = new (window.AudioContext || window.webkitAudioContext)(); await this.ctx.resume();
    const src = this.ctx.createMediaStreamSource(this.stream); this.an = this.ctx.createAnalyser(); this.an.fftSize = 1024; src.connect(this.an); this.buf = new Float32Array(this.an.fftSize); return true;
  } catch (e) { return false; }
}, rms() { if (!this.an) return 0; this.an.getFloatTimeDomainData(this.buf); let s = 0; for (const x of this.buf) s += x * x; return Math.sqrt(s / this.buf.length); } };

/* listen: дауысты тыңдап, SpeechRecognition арқылы мәтінге айналдырады */
function listen({ maxMs = 8000, quietMs = 1400, onLevel, stopSignal } = {}) {
  return new Promise(async resolve => {
    const ok = await Mic.init();
    const res = { texts: [], voicedMs: 0, peak: 0, mic: ok, sr: !!SR, srErr: null };
    if (!ok) return resolve(res);
    let rec = null, done = false, srEnded = !SR, t0 = performance.now(), last = t0, lastVoice = 0, floor = null, raf;
    if (SR) {
      try {
        rec = new SR(); rec.lang = 'kk-KZ'; rec.interimResults = true; rec.maxAlternatives = 5; rec.continuous = true;
        rec.onresult = ev => { for (let i = ev.resultIndex; i < ev.results.length; i++) if (ev.results[i].isFinal) for (let j = 0; j < ev.results[i].length; j++) res.texts.push(ev.results[i][j].transcript); };
        rec.onerror = ev => { if (ev.error !== 'no-speech' && ev.error !== 'aborted') res.srErr = ev.error; };
        rec.onend = () => { srEnded = true; };
        rec.start();
      } catch (e) { res.srErr = 'start'; srEnded = true; }
    }
    const finish = async () => {
      if (done) return; done = true; cancelAnimationFrame(raf);
      try { rec && rec.stop(); } catch (e) {}
      const w = performance.now(); while (!srEnded && performance.now() - w < 1800) await sleep(50);
      onLevel && onLevel(0); resolve(res);
    };
    const tick = () => {
      if (done) return;
      const now = performance.now(), dt = now - last, r = Mic.rms(); last = now;
      if (floor === null) floor = r; if (now - t0 < 400) floor = Math.min(floor, r) * .5 + floor * .5;
      const thr = Math.max(.03, floor * 3);
      if (r > thr) { res.voicedMs += dt; lastVoice = now; res.peak = Math.max(res.peak, r); }
      onLevel && onLevel(Math.min(1, r / (thr * 4)));
      if ((res.voicedMs > 250 && now - lastVoice > quietMs) || now - t0 > maxMs || (stopSignal && stopSignal.stop)) return finish();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  });
}

/* ---------- сөзді салыстыру ---------- */
const LOOSE = { 'ә': 'а', 'ө': 'о', 'ү': 'у', 'ұ': 'у', 'і': 'и', 'ы': 'и', 'қ': 'к', 'ғ': 'г', 'ң': 'н', 'һ': 'х', 'э': 'е', 'ё': 'е', 'ю': 'у', 'я': 'а', 'й': 'и', 'щ': 'ш', 'ц': 'с', 'ч': 'ш', 'ь': '', 'ъ': '', 'ж': 'ж' };
const loose = s => [...String(s).toLowerCase().replace(/[^a-zа-яёәғқңөұүһі]/g, '')].map(c => LOOSE[c] ?? c).join('');
function lev(a, b) { const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]); for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[m][n]; }
const tol = w => Math.floor(w.length / 4);
const toks = t => t.toLowerCase().split(/[^a-zа-яёәғқңөұүһі]+/).filter(Boolean);
function hasWord(alt, word) {
  const lw = loose(word), T = toks(alt);
  if (loose(alt) === lw) return true;
  if (lev(loose(T.join('')), lw) <= tol(lw) && T.length <= 4) return true;
  return T.some(t => { const lt = loose(t); return lev(lt, lw) <= tol(lw) || (lw.length >= 3 && lt.startsWith(lw.slice(0, Math.max(3, lw.length - 1))) && lt.length <= lw.length + 3); });
}
/* spec: {mode:'voice'|'word'|'sentence'|'words', target, words, min, minTokens} */
function judge(spec, r) {
  if (!r.mic) return { ok: false, reason: 'nomic' };
  if (r.voicedMs < 180) return { ok: false, reason: 'silent' };
  if (spec.mode === 'voice') return { ok: true };
  if (!r.texts.length) return r.sr && !r.srErr ? { ok: false, reason: 'nospeech' } : { ok: false, adult: true, reason: 'nosr' };
  let best = null;
  for (const alt of r.texts) {
    let ok = false, n = 0;
    if (spec.mode === 'word') ok = hasWord(alt, spec.target);
    else if (spec.mode === 'sentence') ok = spec.target.split(/\s+/).every(w => hasWord(alt, w.replace(/[.!?]/g, '')));
    else { n = [...new Set(spec.words)].filter(w => hasWord(alt, w)).length; ok = n >= (spec.min || 1) && toks(alt).length >= (spec.minTokens || 1); }
    if (ok) return { ok: true, heard: alt };
    best = best || alt;
  }
  return { ok: false, heard: best, reason: 'mismatch' };
}

/* ---------- маршрутизация ---------- */
const app = $('#app');
let cleanup = null, nav = null;
function go(fn, ...a) { if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; } stopSay(); camOff(); window.scrollTo(0, 0); app.replaceChildren(); nav = () => go(fn, ...a); fn(...a); renderTop(); }
function setCrumb(t) { const c = $('.crumb'); if (c) c.textContent = t; crumb = t; }
let crumb = '';
function renderTop() {
  const top = $('#top');
  top.replaceChildren(
    h('button', { class: 'chip', onclick: () => go(Home), 'aria-label': 'Басты бет' }, '🏠 Басты'),
    h('span', { class: 'crumb' }, crumb),
    h('button', { class: 'chip', onclick: () => go(Picker), title: 'Дыбыс таңдау' }, '🔤 Дыбыстар'),
    h('button', { class: 'chip' + (S.logo ? ' on' : ''), title: 'Логопед режимі', onclick: e => { S.logo = !S.logo; save(); e.currentTarget.classList.toggle('on', S.logo); } }, '👩‍⚕️'),
    h('button', { class: 'chip' + (S.mute ? '' : ' on'), title: 'Дыбыс', onclick: e => { S.mute = !S.mute; save(); stopSay(); e.currentTarget.classList.toggle('on', !S.mute); e.currentTarget.textContent = S.mute ? '🔇' : '🔊'; } }, S.mute ? '🔇' : '🔊'));
}
function mascot(text, mood) {
  const face = h('div', { class: 'face' + (mood === 'cheer' ? ' cheer' : '') }, mood === 'sad' ? '🐯' : '🐯');
  return h('div', { class: 'mascot' }, face, h('div', { class: 'bubble' }, text));
}
const isV = L => D.find(x => x.letter === L).type === 'vowel';
const RARE = new Set(['В', 'Ф', 'Э', 'Ц', 'Ч', 'Щ', 'Һ']);

/* ---------- басты бет ---------- */
function Home() {
  crumb = '';
  const inp = h('input', { type: 'text', placeholder: 'Атың кім?', value: S.name, maxlength: 30, 'aria-label': 'Баланың аты', oninput: () => { S.name = inp.value; save(); } });
  const done = Object.keys(S.res).length;
  app.append(h('section', { class: 'screen hero' },
    h('div', {}, h('h1', {}, 'Дыбыс сиқыры ✨'),
      mascot(S.name ? `Сәлем, ${S.name}! Бірге ойнайық!` : 'Сәлем! Мен Жолбарыспын. Бірге ойнайық, дыбыстарды үйренейік!'),
      h('p', { class: 'lead' }, '37 дыбыс • 259 ойын • микрофонмен сөйле, камерамен айнаға қара!'),
      h('div', { class: 'namebox' }, inp),
      h('div', { class: 'row', style: 'justify-content:flex-start' },
        h('button', { class: 'btn big', onclick: () => { say('ui:welcome'); go(Breath, 0); } }, '▶ Бастаймыз!'),
        h('button', { class: 'btn ghost sky', onclick: () => go(Picker) }, '🔤 Дыбыс таңдау'),
        done ? h('button', { class: 'btn ghost', onclick: () => go(Report) }, '📋 Қорытынды') : null)),
    h('div', { class: 'big-emoji', 'aria-hidden': 'true' }, '🐯')));
  setTimeout(() => say('ui:welcome'), 300);
}

/* ---------- тыныс алу жаттығулары ---------- */
const BREATH = [
  { id: 'butterfly', t: 'Көбелекті ұшыр', goal: 'Ауаны бірқалыпты шығар', a: '🦋', g: '🌸', need: 3000, decay: 0, hint: 'Мұрынмен дем ал, ауызбен жай үрле!', done: 'Жарайсың! Көбелекті гүлге жеткіздің!' },
  { id: 'candle', t: 'Шамды үрле', goal: 'Дем шығару күшін реттеу', a: '🕯️', g: '', need: 3500, decay: 0, hint: 'Мұрынмен дем ал, ауызбен бірқалыпты үрле!', done: 'Тамаша! Шам сөнді. Тағы бір рет қайталап көр!' },
  { id: 'boat', t: 'Желкенді қайық', goal: 'Ұзақ, үздіксіз дем шығару', a: '⛵', g: '🏁', need: 5000, decay: .6, hint: 'Ұзақ әрі үздіксіз үрле — қайық алға жүзсін!', done: 'Керемет! Қайық мәреге жетті, жұлдызша жанды! ⭐' },
];
async function Breath(i) {
  const B = BREATH[i]; setCrumb(`🌬️ Тыныс алу • ${i + 1}/3`);
  const bar = h('div', { class: 'bar' }, h('div')), msg = h('div', { class: 'feedback' }, B.hint), meter = h('div', { class: 'meter' }, ...Array.from({ length: 8 }, () => h('i')));
  let scene;
  if (B.id === 'candle') scene = h('div', { class: 'scene candle' }, h('div', { class: 'flame' }, '🔥'));
  else scene = h('div', { class: 'scene' + (B.id === 'boat' ? ' sea' : '') }, h('div', { class: 'a', style: 'left:2%' }, B.a), h('div', { class: 'goal' }, B.g));
  let blowing = false, prog = 0, finished = false, mic = false;
  const holdBtn = h('button', { class: 'btn sky', onpointerdown: () => blowing = true, onpointerup: () => blowing = false, onpointerleave: () => blowing = false, onpointercancel: () => blowing = false }, '💨 Үрлеу (ұстап тұр)');
  app.append(h('section', { class: 'screen' }, h('div', { class: 'gbar' }, h('div', { class: 'title' }, B.t), h('span', { class: 'lvl' }, B.goal)),
    h('div', { class: 'stage' }, mascot(B.hint), scene, bar, msg, h('div', { class: 'row' }, meter), h('div', { class: 'row noprint' }, holdBtn, h('button', { class: 'btn ghost', onclick: () => next() }, 'Өткізу ⏭'))), ));
  say('ui:' + B.id);
  mic = await Mic.init();
  if (!mic) msg.textContent = 'Микрофон жоқ — «Үрлеу» батырмасын ұстап тұр 👇';
  let last = performance.now(), floor = null, stopped = false, raf;
  cleanup = () => { stopped = true; cancelAnimationFrame(raf); };
  const frame = () => {
    if (stopped) return; const now = performance.now(), dt = now - last; last = now;
    let lvl = 0; if (mic) { const r = Mic.rms(); floor = floor === null ? r : Math.min(floor * 1.002, floor * .98 + r * .02); lvl = Math.max(0, (r - Math.max(.02, floor * 2.5)) / .12); if (lvl > .05) blowing = true; else if (!holdBtn.matches(':active')) blowing = false; }
    if (blowing && !finished) { prog += dt; } else if (!finished) prog = Math.max(0, prog - dt * B.decay);
    const p = Math.min(1, prog / B.need); bar.firstChild.style.width = p * 100 + '%';
    [...meter.children].forEach((b, k) => { const on = blowing && k < 2 + (lvl * 8 | 0) || (blowing && !mic); b.classList.toggle('on', on); b.style.height = 10 + k * 5 + 'px'; });
    const a = $('.a', scene), fl = $('.flame', scene);
    if (a) { a.style.left = 2 + p * 70 + '%'; a.style.transform = `translateY(${Math.sin(now / 150) * 6}px)`; }
    if (fl) { fl.style.transform = `scale(${1 - p * .95}) rotate(${blowing ? 14 : 0}deg)`; fl.style.opacity = 1 - p * .9; }
    if (p >= 1 && !finished) { finished = true; win(); }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  async function win() { sfx.ok(); confetti(); msg.className = 'feedback ok'; msg.textContent = B.done; if ($('.flame', scene)) $('.flame', scene).textContent = '💨'; S.warm['b' + i] = 1; save(); await sleep(1800); next(); }
  function next() { go(i < 2 ? Breath : Artic, i < 2 ? i + 1 : 0); }
}

/* ---------- артикуляциялық жаттығулар ---------- */
const ARTIC = [
  { t: 'Күлімсіреу', e: '😁', goal: 'Ерінді екі жаққа соз', how: 'Тістеріңді көрсетіп күлімсіре. Ұста!', s: 4 },
  { t: 'Түтікше', e: '😗', goal: 'Ерінді алға созып, дөңгелет', how: 'Ерініңді түтікше етіп жина. Ұста!', s: 4 },
  { t: 'Күрекше', e: '😛', goal: 'Тілді жалпақ әрі босаңсыта ұста', how: 'Ауызды сәл аш, жалпақ тілді төменгі ерінге қой.', s: 4 },
  { t: 'Инеше', e: '👅', goal: 'Тілді жіңішкертіп алға соз', how: 'Тілді жіңішке етіп алға шығар. Қайтар!', s: 3 },
  { t: 'Сағат', e: '🕐', goal: 'Тіл ұшын оңға-солға қозғалт', how: 'Ауызды аш. Тіл ұшын ауыздың бұрыштарына кезекпен апар.', s: 6 },
];
async function Artic(i) {
  const A = ARTIC[i]; setCrumb(`😁 Артикуляция • ${i + 1}/5`);
  let reps = 0, running = false;
  const repsEl = h('div', { class: 'reps' }), ring = h('div', { class: 'ring' }, h('span', {}, A.e)), msg = h('div', { class: 'feedback' }, A.how);
  const camBox = h('div'), startBtn = h('button', { class: 'btn', onclick: run }, '▶ Бастадым!');
  const paint = () => repsEl.textContent = '⭐'.repeat(reps) + '☆'.repeat(3 - reps);
  paint();
  const nextBtn = h('button', { class: 'btn sun', disabled: true, onclick: () => go(i < 4 ? Artic : Picker, i + 1) }, i < 4 ? 'Келесі жаттығу ➜' : 'Дыбыстарға өту ➜');
  const logo = S.logo ? h('div', { class: 'row' }, h('span', {}, '👩‍⚕️'), h('button', { class: 'btn ghost', onclick: () => mark('Орындалды') }, '✓ Орындалды'), h('button', { class: 'btn ghost', onclick: () => mark('Көмек қажет') }, '🤝 Көмек қажет')) : null;
  function mark(v) { S.warm['a' + i] = v; save(); sfx.tap(); msg.textContent = 'Белгіленді: ' + v; }
  app.append(h('section', { class: 'screen' }, h('div', { class: 'gbar' }, h('div', { class: 'title' }, A.t), h('span', { class: 'lvl' }, A.goal)),
    h('div', { class: 'stage' }, h('div', { class: 'split' }, h('div', {}, h('div', { class: 'pic sm' }, A.e), ring, msg, repsEl, h('div', { class: 'row' }, startBtn, h('button', { class: 'btn ghost', onclick: () => { reps = Math.min(3, reps + 1); paint(); sfx.tap(); check(); } }, 'Қайталадым ✓')), logo), camBox), h('div', { class: 'row' }, nextBtn)),
    h('p', { class: 'lead center' }, 'Бұл жаттығулар дыбысты тексерудің орнына жүрмейді — дайындық кезеңі.')));
  camOn(camBox);
  cleanup = () => { running = false; };
  function check() { if (reps >= 3) { nextBtn.disabled = false; msg.className = 'feedback ok'; msg.textContent = 'Жарайсың! Жаттығуды орындадың!'; sfx.ok(); confetti(14); } }
  async function run() {
    if (running) return; running = true; startBtn.disabled = true;
    for (let t = 0; t < A.s * 10 && running; t++) { ring.style.setProperty('--p', t / (A.s * 10) * 100); if (t % 10 === 0) { msg.textContent = `${A.s - t / 10}…`; sfx.tap(); } await sleep(100); }
    if (!running) return; ring.style.setProperty('--p', 100); running = false; startBtn.disabled = false; reps++; paint(); sfx.star(); msg.textContent = 'Босаңсыт! 😌'; check();
  }
}

/* ---------- дыбыс таңдау ---------- */
function Picker() {
  setCrumb('🔤 Дыбысты таңда'); camOff();
  const mk = (L, i) => { const sum = LV.length && [1, 2, 3, 4, 5, 6, 7].reduce((a, g) => a + (starsOf(L, g).every(x => x > 0) ? 1 : 0), 0);
    return h('button', { class: `letter ${isV(L) ? 'v' : 'c'}${i % 2 ? ' alt' : ''}${RARE.has(L) ? ' rare' : ''}`, onclick: () => { sfx.tap(); say('snd:' + L.toLowerCase(), L); go(SoundMenu, L); }, 'aria-label': `${L} дыбысы` }, L, h('span', { class: 'st' }, sum ? `${sum}/7 ✓` : '')); };
  const vow = D.filter(x => x.type === 'vowel'), con = D.filter(x => x.type !== 'vowel');
  app.append(h('section', { class: 'screen' }, h('h1', {}, 'Қай дыбыспен ойнаймыз?'),
    mascot('Бір дыбысты бас — сол дыбысқа арналған 7 ойын ашылады!'),
    h('h2', {}, '🔴 Дауыстылар (12)'), h('div', { class: 'grid' }, vow.map((x, i) => mk(x.letter, i))),
    h('h2', {}, '🔵 Дауыссыздар (25)'), h('div', { class: 'grid' }, con.map((x, i) => mk(x.letter, i))),
    h('div', { class: 'legend' }, h('span', {}, '★ — көбіне кірме сөздерде кездеседі (В, Ф, Э, Ц, Ч, Щ, Һ): таныс сөздермен ғана ойна.')),
    h('div', { class: 'row' }, h('button', { class: 'btn ghost', onclick: () => go(Report) }, '📋 Қорытынды мен логопед бағасы'))));
}

/* ---------- ойындар тізімі ---------- */
const GAMES = [
  { t: 'Дыбысты таны', e: '👂', d: 'Дыбысты естіп ажырат' },
  { t: 'Дыбысты айт', e: '🎤', d: 'Дыбысты жеке айт' },
  { t: 'Буын пойызы', e: '🚂', d: 'Сөзді буынға бөл' },
  { t: 'Суретті ата', e: '🖼️', d: 'Суреттегі затты ата' },
  { t: 'Дыбыс қайда?', e: '📍', d: 'Басында, ортасында, соңында' },
  { t: 'Сөйлем құрастыр', e: '💬', d: 'Сөйлемді айт' },
  { t: 'Сурет бойынша әңгіме', e: '📖', d: 'Әңгіме құрастыр' },
];
function SoundMenu(L) {
  const s = D.find(x => x.letter === L); setCrumb(`${L} дыбысы`);
  say('intro:' + L, `${L} дыбысын тексеруді бастаймыз!`);
  const total = starsOf;
  app.append(h('section', { class: 'screen center' },
    h('div', { class: 'bigletter ' + (isV(L) ? 'v' : 'c'), onclick: () => say('snd:' + L.toLowerCase(), L) }, L),
    h('h1', {}, `${L} дыбысын тексеруді бастаймыз!`),
    h('p', { class: 'lead' }, `Сөздер: ${s.words.join(', ')}`),
    RARE.has(L) ? h('div', { class: 'lognote' }, '★ Бұл дыбыс көбіне кірме сөздерде кездеседі. Логопед баланың сөзді білетінін алдын ала тексеруі керек.') : null,
    h('div', { class: 'games' }, GAMES.map((g, i) => { const st = starsOf(L, i + 1).filter(x => x > 0).length;
      return h('button', { class: 'gcard', onclick: () => go(Game, L, i + 1, 0) }, h('span', { class: 'n' }, i + 1), h('div', { class: 'e' }, g.e), h('div', { class: 't' }, g.t), h('div', { class: 'd' }, g.d), h('div', { class: 's' }, '⭐'.repeat(st) + '☆'.repeat(3 - st))); })),
    h('div', { class: 'row' }, h('button', { class: 'btn big', onclick: () => go(Game, L, 1, 0) }, '▶ Бастау'), h('button', { class: 'btn ghost', onclick: () => go(Picker) }, '🔤 Басқа дыбыс'))));
}

/* ---------- ойын ядросы ---------- */
const pos = (word, L) => { const w = word.toLowerCase(), l = L.toLowerCase(), r = new Set(); [...w].forEach((c, i) => { if (c === l) r.add(i === 0 ? 'start' : i === w.length - 1 ? 'end' : 'mid'); }); return r; };
const has = (w, L) => w.toLowerCase().includes(L.toLowerCase());

/* Деңгей тапсырмалары: әр қадам {kind,...} */
function buildSteps(s, g, lv) {
  const L = s.letter, l = L.toLowerCase(), steps = [];
  if (g === 1) {
    if (lv === 'hard') for (const w of s.g1.hard) steps.push({ kind: 'findword', word: w, opts: shuffle([w, ...shuffle(s.g1.wrong).slice(0, 2)]) });
    else for (const x of s.g1[lv]) steps.push({ kind: 'sound', snd: x });
  }
  if (g === 2) { const n = lv === 'easy' ? 1 : 3; for (let i = 0; i < n; i++) steps.push({ kind: 'speak', mode: 'voice', n, i, say: 'snd:' + l, show: L, hintText: lv === 'hard' ? ['Жай айт', 'Қалыпты айт', 'Сәл қатты айт'][i] : lv === 'medium' ? `${i + 1}-ші рет` : 'Тыңда да, қайтала!', cam: true }); }
  if (g === 3) for (const w of s.g3[lv]) { steps.push({ kind: 'train', word: w, syl: s.syl[w], pick: lv === 'medium', both: lv === 'hard' }); }
  if (g === 4) { for (const w of s.g4[lv]) steps.push({ kind: 'speak', mode: 'word', target: w, show: pic(w), word: w, hintText: 'Суретке қарап, атауын айт!', reveal: true });
    if (lv === 'hard') steps.push({ kind: 'speak', mode: 'words', words: s.g4.hard, min: 2, minTokens: 3, show: s.g4.hard.slice(0, 4).map(pic).join(' '), hintText: 'Екі сөзді қатыстырып, сөйлем айт!', sentenceHint: true }); }
  if (g === 5) { const ws = shuffle([...s.g5[lv].map(w => ({ w, none: false })), { w: shuffle(s.g1.wrong)[0], none: true }]); for (const x of ws) steps.push({ kind: 'pos', word: x.w, none: x.none, ok: pos(x.w, L) }); }
  if (g === 6) {
    if (lv === 'easy') steps.push({ kind: 'speak', mode: 'sentence', target: s.g6.sentence, say: s.g6.sentence, show: '💬', text: s.g6.sentence, hintText: 'Сөйлемді тыңда да, қайтала!' });
    else { const ws = s.g6[lv]; steps.push({ kind: 'speak', mode: 'words', words: ws, min: 2, minTokens: lv === 'hard' ? 3 : 2, show: ws.map(pic).join(' '), words_: ws, hintText: lv === 'medium' ? 'Осы сөздермен сөйлем құра!' : `Кемінде екі сөзді қатыстырып, толық сөйлем айт!`, support: ws }); }
  }
  if (g === 7) {
    const ws = s.g7[lv];
    if (lv === 'easy') steps.push({ kind: 'speak', mode: 'words', words: ws, min: 1, minTokens: 3, show: ws.map(pic).join(' '), hintText: 'Суретке қарап, 1–2 сөйлем айт!', support: ws, long: true });
    if (lv === 'medium') ws.slice(0, 3).forEach((w, i) => steps.push({ kind: 'speak', mode: 'words', words: ws, min: 1, minTokens: 2, show: pic(w), hintText: `${i + 1}-сурет: бір сөйлем айт!`, support: ws, tag: `${i + 1}/3`, long: true }));
    if (lv === 'hard') steps.push({ kind: 'speak', mode: 'words', words: ws, min: 3, minTokens: 7, show: ws.map(pic).join(' '), hintText: '4–5 сөйлемнен әңгіме құра! Кемінде үш сөзді қолдан.', support: ws, long: true, maxMs: 30000, quiet: 3000 });
  }
  return steps;
}
const GINTRO = {
  1: 'Дыбысты мұқият тыңда да, дұрыс жауапты бас!', 2: 'Микрофонды басып, дыбысты өзің айт!', 3: 'Сөзді буынға бөліп айт!',
  4: 'Суретке қарап, не екенін өзің ата!', 5: 'Дыбыстың сөздегі орнын тап!', 6: 'Сөйлем айтайық!', 7: 'Сурет бойынша әңгіме құрайық!' };

async function Game(L, g, li) {
  const s = D.find(x => x.letter === L), lv = LV[li], G = GAMES[g - 1];
  setCrumb(`${L} • ${g}. ${G.t} • ${LVN[lv]}`);
  const steps = buildSteps(s, g, lv); let idx = 0, fails = 0;
  const dots = h('div', { class: 'dots' }, steps.map(() => h('i'))), stage = h('div', { class: 'stage' });
  app.append(h('section', { class: 'screen' }, h('div', { class: 'gbar' }, h('div', { class: 'title' }, `${G.e} ${G.t}`), h('span', { class: 'lvl' }, `${LVN[lv]} деңгей`), dots), stage));
  let alive = true; cleanup = () => { alive = false; stopSay(); };
  stage.append(mascot(`${GINTRO[g]}`)); say('ui:level_' + lv); await sleep(900); if (!alive) return;
  for (; idx < steps.length && alive; idx++) {
    [...dots.children].forEach((d, k) => { d.className = k < idx ? 'on' : k === idx ? 'cur' : ''; });
    const f = await runStep(stage, steps[idx], { L, s, g, lv, lvl: () => alive });
    fails += f; if (!alive) return; await sleep(450);
  }
  [...dots.children].forEach(d => d.className = 'on');
  const stars = fails === 0 ? 3 : fails <= 2 ? 2 : 1;
  S.res[rkey(L, g, lv)] = Object.assign(S.res[rkey(L, g, lv)] || {}, { stars: Math.max(stars, (S.res[rkey(L, g, lv)] || {}).stars || 0), fails }); save();
  LevelEnd(stage, L, g, li, stars);
}

function LevelEnd(stage, L, g, li, stars) {
  sfx.ok(); confetti(40); say('ui:ok');
  const lv = LV[li], key = rkey(L, g, lv), r = S.res[key] || {}, last = li === 2;
  const marks = ['дұрыс айтты', 'көмекпен айтты', 'алмастырды', 'бұрмалады', 'түсіріп айтты', 'қайталау қажет'];
  stage.replaceChildren(mascot('Жарайсың! Дұрыс орындадың! Келесі тапсырмаға өттің!', 'cheer'),
    h('div', { class: 'stars' }, [1, 2, 3].map(n => h('span', { class: 's' + (n <= stars ? ' on' : '') }, '⭐'))),
    h('h2', {}, `${LVN[lv]} деңгей аяқталды!`),
    (S.logo && g !== 1) || (S.logo && lv === 'hard') ? h('div', {}, h('div', { class: 'lognote' }, '👩‍⚕️ Логопед белгісі:'), h('div', { class: 'marks' }, marks.map(m => h('button', { class: 'mk' + ((r.marks || []).includes(m) ? ' on' : ''), onclick: e => { const rr = S.res[key] = S.res[key] || {}; rr.marks = rr.marks || []; const k = rr.marks.indexOf(m); k < 0 ? rr.marks.push(m) : rr.marks.splice(k, 1); e.currentTarget.classList.toggle('on', k < 0); save(); sfx.tap(); } }, '☐ ' + m)))) : null,
    h('div', { class: 'row' },
      h('button', { class: 'btn big', onclick: () => last ? (g < 7 ? go(GameDone, L, g) : go(SoundDone, L)) : go(Game, L, g, li + 1) }, last ? (g < 7 ? 'Келесі ойын ➜' : 'Қорытынды ➜') : 'Келесі кезеңге өту ➜'),
      h('button', { class: 'btn ghost', onclick: () => go(Game, L, g, li) }, '↻ Қайта ойнау')));
}
function GameDone(L, g) { go(Game, L, g + 1, 0); }
function SoundDone(L) {
  setCrumb(`${L} дыбысы • қорытынды`); const i = D.findIndex(x => x.letter === L), nx = D[i + 1];
  sfx.ok(); confetti(60); say('done:' + L, `Жарайсың! Сен ${L} дыбысына арналған ойындарды аяқтадың!`);
  app.append(h('section', { class: 'screen center' }, mascot(`Жарайсың! Сен [${L.toLowerCase()}] дыбысына арналған ойындарды аяқтадың! Енді келесі дыбысты таңдай аласың!`, 'cheer'),
    h('div', { class: 'bigletter ' + (isV(L) ? 'v' : 'c') }, L), h('div', { class: 'games' }, GAMES.map((g, k) => h('div', { class: 'gcard' }, h('div', { class: 'e' }, g.e), h('div', { class: 't' }, g.t), h('div', { class: 's' }, starsOf(L, k + 1).map(x => x ? '⭐' : '☆').join(''))))),
    S.logo ? h('div', { class: 'lognote' }, 'Логопедтің ескертпесін «Қорытынды» бетінде жазыңыз.') : null,
    h('div', { class: 'row' }, nx ? h('button', { class: 'btn big', onclick: () => go(SoundMenu, nx.letter) }, `Келесі: ${nx.letter} ➜`) : null,
      h('button', { class: 'btn sky', onclick: () => go(Picker) }, 'Келесі дыбысты таңдау'), h('button', { class: 'btn ghost', onclick: () => go(Report) }, '📋 Қорытынды'))));
}

/* ---------- қадамдар ---------- */
function feedback(el, ok) { el.className = 'feedback ' + (ok ? 'ok' : 'no'); el.textContent = ok ? 'Жарайсың! Дұрыс орындадың! 🎉' : 'Қайтадан байқап көр. Мұқият тыңда/айт. Сенің қолыңнан келеді! 💪'; ok ? (sfx.ok(), confetti(16)) : sfx.no(); }
const earBtn = (key, fb) => { const b = h('button', { class: 'ear', 'aria-label': 'Тыңдау', onclick: async () => { b.classList.add('playing'); await say(key, fb); b.classList.remove('playing'); } }, '👂'); return b; };

async function runStep(stage, st, ctx) {
  let fails = 0; const { L, s } = ctx, l = L.toLowerCase();
  const fb = h('div', { class: 'feedback' });
  if (st.kind === 'sound') {
    const ear = earBtn('snd:' + st.snd, st.snd);
    const opts = [h('button', { class: 'choice' }, `Бұл «${L}»`), h('button', { class: 'choice' }, 'Басқа дыбыс')];
    stage.replaceChildren(h('div', { class: 'prompt' }, `Тыңда: «${L}» дыбысы естілді ме?`), ear, h('div', { class: 'soundcard ' + (isV(L) ? '' : 'c'), style: 'display:none' }), h('div', { class: 'choices' }, opts), fb);
    setTimeout(() => ear.click(), 250);
    return new Promise(res => opts.forEach((b, k) => b.onclick = async () => { const ok = (k === 0) === (st.snd === l); b.classList.add(ok ? 'good' : 'bad'); feedback(fb, ok); if (ok) { opts.forEach(o => o.disabled = true); await sleep(900); res(fails); } else fails++; }));
  }
  if (st.kind === 'findword') {
    const opts = st.opts.map(w => h('button', { class: 'choice pic-ch', 'aria-label': 'Сурет', onclick: async e => { say(w); const ok = has(w, L); const b = e.currentTarget; if (done) return; b.classList.add(ok ? 'good' : 'bad'); feedback(fb, ok); if (ok) { done = true; await sleep(1100); resolve(fails); } else fails++; } }, pic(w)));
    let done = false, resolve; stage.replaceChildren(h('div', { class: 'prompt' }, `Қайсысында «${L}» дыбысы бар? Басып тыңда 👇`), h('div', { class: 'choices' }, opts), fb);
    setTimeout(() => say(st.word), 300);
    return new Promise(r => resolve = r);
  }
  if (st.kind === 'pos') {
    const cells = [['start', 'Басында'], ['mid', 'Ортасында'], ['end', 'Соңында'], ...(st.none ? [['none', 'Жоқ']] : [])];
    const ear = earBtn(st.word); let done = false;
    const btns = cells.map(([k, t]) => h('button', { class: 'choice', onclick: async e => { if (done) return; const ok = k === 'none' ? st.none : st.ok.has(k); const b = e.currentTarget; b.classList.add(ok ? 'good' : 'bad'); feedback(fb, ok); if (ok) { done = true; await sleep(1000); resolveP(fails); } else fails++; } }, t));
    let resolveP; stage.replaceChildren(h('div', { class: 'prompt' }, `«${L}» дыбысы сөздің қай жерінде?`), h('div', { class: 'pic' }, pic(st.word)), h('div', {}, ear), h('div', { class: 'choices' }, btns), fb);
    setTimeout(() => ear.click(), 250);
    return new Promise(r => resolveP = r);
  }
  if (st.kind === 'train') return trainStep(stage, st, ctx);
  if (st.kind === 'speak') return speakStep(stage, st, ctx);
  return 0;
}

/* буын пойызы */
async function trainStep(stage, st, ctx) {
  const { L } = ctx; let fails = 0;
  const fb = h('div', { class: 'feedback' }), wagons = st.syl.map(sy => h('button', { class: 'wagon', onclick: () => say(sy) }, sy));
  const train = h('div', { class: 'train' }, h('div', { class: 'wagon engine', 'aria-hidden': 'true' }, '🚂'), wagons);
  const hint = st.both ? 'Алдымен буынға бөліп айт, сосын тұтас сөзді айт!' : 'Сөзді буынға бөліп айт!';
  const r = await speakStep(stage, { kind: 'speak', mode: 'word', target: st.word, show: pic(st.word), word: st.word, hintText: hint, extra: train, noReveal: true }, ctx);
  fails += r;
  if (st.pick) {
    await new Promise(res => {
      const c = ctx.L, ok = st.syl.map(x => has(x, c));
      const ws = st.syl.map((sy, k) => h('button', { class: 'wagon', onclick: async e => { const b = e.currentTarget; if (ok[k]) { b.className = 'wagon glow'; feedback(fb, true); await sleep(900); res(); } else { b.className = 'wagon bad'; feedback(fb, false); fails++; } } }, sy));
      stage.replaceChildren(h('div', { class: 'prompt' }, `Қай буында «${c}» дыбысы бар?`), h('div', { class: 'pic sm' }, pic(st.word)), h('div', { class: 'train' }, h('div', { class: 'wagon engine' }, '🚂'), ws), fb);
    });
  }
  return fails;
}

/* сөйлеу қадамы: микрофон арқылы тексеріледі */
async function speakStep(stage, st, ctx) {
  let fails = 0, tries = 0, busy = false;
  const fb = h('div', { class: 'feedback' }), heard = h('div', { class: 'heard' }), msg = h('div', { class: 'micmsg' }, SR ? '🎤 Микрофонды бас та, айт!' : '🎤 Микрофонды бас та, айт! (мәтінді логопед растайды)');
  const meter = h('div', { class: 'meter' }, ...Array.from({ length: 10 }, (_, k) => { const i = h('i'); i.style.height = 10 + k * 3 + 'px'; return i; }));
  const mic = h('button', { class: 'mic', 'aria-label': 'Микрофон' }, '🎤');
  const sig = { stop: false }, adult = h('div', { class: 'adult' });
  const left = h('div', {}, h('div', { class: 'prompt' }, st.hintText),
    st.show && /^[A-ZА-ЯӘҒҚҢӨҰҮҺІ]$/.test(st.show) ? h('div', { class: 'soundcard ' + (isV(ctx.L) ? '' : 'c') }, st.show) : h('div', { class: 'pic' + (st.show && st.show.length > 4 ? ' sm' : '') }, st.show),
    st.text ? h('div', { class: 'prompt' }, '«' + st.text + '»') : null, st.tag ? h('div', { class: 'lvl' }, st.tag) : null,
    st.support ? h('div', { class: 'heard' }, 'Тірек сөздер: ' + st.support.join(', ')) : null, st.extra || null);
  const ear = st.say ? earBtn(st.say, st.text || ctx.L) : null;
  const camBox = h('div'), side = st.cam ? h('div', {}, camBox) : null;
  const micWrap = h('div', { class: 'micwrap' }, mic, meter, msg, heard, fb, adult);
  stage.replaceChildren(side ? h('div', { class: 'split' }, h('div', {}, left, ear, micWrap), camBox) : h('div', {}, left, ear, micWrap));
  if (st.cam) camOn(camBox);
  if (st.say) setTimeout(() => ear.click(), 250);
  const setLevel = v => [...meter.children].forEach((b, k) => b.classList.toggle('on', v * 10 > k));
  const replay = (!st.say && st.word) ? h('button', { class: 'btn ghost', style: 'display:none', onclick: () => say(st.word) }, '🔁 Қайта тыңдау') : null;
  if (replay) micWrap.append(replay);
  return new Promise(resolve => {
    const pass = async (note) => { feedback(fb, true); mic.disabled = true; adult.replaceChildren(); if (replay) { replay.style.display = ''; } if (st.reveal) heard.textContent = `Сөз: ${st.word}`; if (st.word) await say(st.word); await sleep(700); resolve(fails); };
    const askAdult = () => { adult.replaceChildren(h('button', { class: 'btn ghost', onclick: () => pass() }, '👩‍⚕️ Дұрыс айтты'), h('button', { class: 'btn ghost', onclick: () => { adult.replaceChildren(); fails++; feedback(fb, false); } }, '🔁 Қайталау керек')); };
    mic.onclick = async () => {
      if (busy) { sig.stop = true; return; } busy = true; sig.stop = false; tries++;
      mic.classList.add('rec'); fb.textContent = ''; fb.className = 'feedback'; heard.textContent = ''; adult.replaceChildren();
      msg.textContent = '🎙️ Тыңдап тұрмын… айт! (аяқтасаң, қайта бас)';
      const r = await listen({ onLevel: setLevel, stopSignal: sig, maxMs: st.maxMs || (st.long ? 15000 : 7000), quietMs: st.quiet || (st.long ? 2200 : 1300) });
      mic.classList.remove('rec'); busy = false; msg.textContent = '🎤 Микрофонды бас та, айт!';
      const j = judge(st, r);
      if (r.texts[0]) heard.textContent = 'Естіген: «' + r.texts[0] + '»';
      if (j.ok) { return pass(); }
      if (j.reason === 'nomic') { msg.textContent = '⚠️ Микрофон қосылмады — браузерде рұқсат беріңіз. Логопед растай алады.'; return askAdult(); }
      if (j.adult) { msg.textContent = 'Дауысың естілді! Бұл браузер сөзді өздігінен тани алмайды.'; return askAdult(); }
      fails++; feedback(fb, false);
      if (j.reason === 'silent') heard.textContent = 'Дауыс естілмеді. Микрофонға жақынырақ айтып көр.';
      if (tries >= 2) askAdult();
      if (replay) replay.style.display = '';
      if (st.say === undefined && st.word && tries === 1) { /* тыңдау үлгісі сәтсіз әрекеттен кейін ғана */ }
    };
  });
}

/* ---------- қорытынды ---------- */
function Report() {
  setCrumb('📋 Қорытынды'); camOff();
  const rows = D.map(x => h('tr', {}, h('td', {}, x.letter), [1, 2, 3, 4, 5, 6, 7].map(g => { const st = starsOf(x.letter, g); const t = st.reduce((a, b) => a + b, 0); const mk = LV.flatMap(l => (S.res[rkey(x.letter, g, l)] || {}).marks || []); return h('td', { title: mk.join(', ') }, t ? st.map(n => n ? '★' : '·').join('') : '–', mk.length ? ' 📝' : ''); })));
  const total = Object.values(S.res).filter(r => r.stars).length;
  const note = h('textarea', { class: 'note', placeholder: 'Логопедтің ескертпесі…', oninput: () => { S.note = note.value; save(); } }); note.value = S.note || '';
  const warm = ARTIC.map((a, i) => S.warm['a' + i] ? `${a.t}: ${S.warm['a' + i]}` : null).filter(Boolean);
  app.append(h('section', { class: 'screen' }, h('h1', {}, 'Қорытынды және логопед бағалауы'),
    h('p', { class: 'lead' }, `${S.name ? S.name + ' • ' : ''}${new Date().toLocaleDateString('kk-KZ')} • аяқталған деңгей: ${total}/777`),
    h('div', { style: 'overflow:auto;border-radius:20px' }, h('table', { class: 'rep' }, h('thead', {}, h('tr', {}, h('th', {}, 'Дыбыс'), GAMES.map((g, i) => h('th', { title: g.t }, `${i + 1}. ${g.e}`)))), h('tbody', {}, rows))),
    warm.length ? h('p', { class: 'lead' }, 'Артикуляция: ' + warm.join('; ')) : null,
    h('div', { class: 'lognote' }, 'Бағдарлама жеке дыбыстарды, буынды, сөйлемді диагноз ретінде бағаламайды. Ол — тексеруді ұйымдастыруға арналған көмекші құрал. Нәтижені логопед баланың жасын, тілдік ортасын, есту жағдайын ескере отырып түсіндіреді. ★ — деңгей аяқталды, 📝 — логопед белгісі бар.'),
    note, h('div', { class: 'row noprint' }, h('button', { class: 'btn sky', onclick: () => print() }, '🖨️ Басып шығару'), h('button', { class: 'btn ghost', onclick: () => { if (confirm('Барлық нәтижені өшіру керек пе?')) { S.res = {}; S.warm = {}; S.note = ''; save(); go(Report); } } }, '🗑️ Нәтижені тазалау'), h('button', { class: 'btn ghost', onclick: () => go(Picker) }, '🔤 Дыбыстарға'))));
}

window.addEventListener('beforeunload', camOff);
window.__album = { go, Home, Picker, SoundMenu, Game, Breath, Artic, Report, listen, judge, hasWord, D, S };
go(Home);
})();
