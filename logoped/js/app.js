/* Сөйле — негізгі қосымша: бағыттау, экрандар, ойындар */
(() => {
  const { say, sfx, settings } = Eng;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const rnd = (a) => a[Math.floor(Math.random() * a.length)];
  const shuffle = (a) => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
  const shuffleNot = (a) => { let r = shuffle(a); for (let i = 0; i < 5 && r.every((x, k) => x === a[k]); i++) r = shuffle(a); return r; };
  const view = $('#view');

  /* ---------- прогресс ---------- */
  const P = Object.assign({ stars: 0, done: {}, days: [], today: { d: '', n: 0 }, last: 1 }, Eng.store.get('progress', {}));
  const save = () => Eng.store.set('progress', P);
  const dayStr = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  function addStars(n) { P.stars += n; save(); const el = $('#starc'); if (el) el.textContent = '⭐ ' + P.stars; }
  function markDone(k) {
    P.done[k] = 1;
    const d = dayStr();
    if (P.today.d !== d) P.today = { d, n: 0 };
    P.today.n++;
    if (!P.days.includes(d)) P.days.push(d);
    save();
  }
  function streak() {
    let n = 0; const d = new Date();
    if (!P.days.includes(dayStr(d))) d.setDate(d.getDate() - 1);
    while (P.days.includes(dayStr(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  const secUnits = (id) => (id === 1 ? BREATH.map((e) => 'b' + e.id) : id === 2 ? ARTIC.map((e) => 'a' + e.id) : [0, 1, 2].map((l) => `g${id}l${l}`));
  const secPct = (id) => { const u = secUnits(id); return Math.round((u.filter((k) => P.done[k]).length / u.length) * 100); };
  const totalPct = () => Math.round(SECTIONS.reduce((s, x) => s + secPct(x.id), 0) / SECTIONS.length);
  const todayN = () => (P.today.d === dayStr() ? P.today.n : 0);

  /* ---------- көмекші UI ---------- */
  function mascot(mood = 'happy', cls = '') {
    const mouth = mood === 'cheer' ? '<path d="M44 70q16 22 32 0z" fill="#7a2a55"/><path d="M50 78q10 8 20 0" fill="#ff8fb0"/>' : mood === 'think' ? '<path d="M50 76h20" stroke="#4a2f8f" stroke-width="4" stroke-linecap="round"/>' : '<path d="M46 72q14 14 28 0" stroke="#4a2f8f" stroke-width="4.5" fill="none" stroke-linecap="round"/>';
    return `<svg class="mascot ${mood === 'cheer' ? 'cheer' : ''} ${cls}" viewBox="0 0 120 120" aria-hidden="true">
      <defs><radialGradient id="mg" cx="35%" cy="28%"><stop offset="0" stop-color="#d9ccff"/><stop offset=".6" stop-color="#9a7df5"/><stop offset="1" stop-color="#7557e6"/></radialGradient></defs>
      <circle cx="30" cy="22" r="11" fill="#9a7df5"/><circle cx="90" cy="22" r="11" fill="#9a7df5"/>
      <path d="M60 14c27 0 47 20 47 48 0 28-20 48-47 48S13 90 13 62c0-28 20-48 47-48z" fill="url(#mg)"/>
      <ellipse cx="42" cy="34" rx="16" ry="8" fill="#fff" opacity=".35"/>
      <circle cx="44" cy="55" r="11" fill="#fff"/><circle cx="76" cy="55" r="11" fill="#fff"/>
      <circle cx="46" cy="57" r="6" fill="#2b2354"/><circle cx="74" cy="57" r="6" fill="#2b2354"/>
      <circle cx="48" cy="54" r="2.2" fill="#fff"/><circle cx="76" cy="54" r="2.2" fill="#fff"/>
      <circle cx="30" cy="72" r="6" fill="#ff9fc2" opacity=".7"/><circle cx="90" cy="72" r="6" fill="#ff9fc2" opacity=".7"/>
      ${mouth}</svg>`;
  }
  function confetti(n = 40) {
    const cols = ['#8a6cf0', '#ffd45e', '#ff8fb0', '#6fe3b4', '#7cc4ff', '#ffb38a'];
    for (let i = 0; i < n; i++) {
      const c = document.createElement('i'); c.className = 'confetti';
      c.style.left = Math.random() * 100 + 'vw'; c.style.background = rnd(cols);
      c.style.animationDuration = 1.6 + Math.random() * 1.8 + 's'; c.style.animationDelay = Math.random() * 0.5 + 's';
      document.body.appendChild(c); setTimeout(() => c.remove(), 4000);
    }
  }
  function modal({ title, text, stars = 0, buttons }) {
    const o = h(`<div class="overlay"><div class="clay modal">${mascot('cheer')}<h2>${title}</h2><p>${text || ''}</p>${stars ? `<div class="stars-line">${'⭐'.repeat(stars)}</div>` : ''}<div class="row" style="justify-content:center" id="mb"></div></div></div>`);
    buttons.forEach((b) => {
      const el = h(`<button class="btn ${b.cls || ''}">${b.label}</button>`);
      el.onclick = () => { o.remove(); b.fn && b.fn(); };
      $('#mb', o).appendChild(el);
    });
    document.body.appendChild(o); confetti(); sfx.star();
    return o;
  }
  const header = (title, back) => h(`<div class="ph"><a class="iconbtn" href="${back}" aria-label="Артқа" style="text-decoration:none">◀</a><h2>${title}</h2><span class="clay-s stars" id="starc">⭐ ${P.stars}</span></div>`);
  const sayBtn = (text, label = '🔊 Түсіндірме') => { const b = h(`<button class="btn soft sm">${label}</button>`); b.onclick = () => say(text); return b; };

  /* ---------- дауыс тану компоненті ---------- */
  function voiceBox(box, opts) {
    const E = Eng.epoch(); let attempts = 0, rec = null, listening = false;
    box.innerHTML = `<div class="voice">
      <button class="mic" aria-label="Микрофон">🎤</button>
      <div class="vstatus">${opts.continuous ? 'Микрофонды бас, әңгімені айт, соңында қайта бас' : 'Микрофонды бас та, сөйле'}</div>
      <div class="heard"></div><div class="vres"></div><div class="vhelp row" style="justify-content:center;margin-top:8px"></div></div>`;
    const mic = $('.mic', box), st = $('.vstatus', box), hd = $('.heard', box), vr = $('.vres', box), vh = $('.vhelp', box);
    const verdict = (ok, msg) => { vr.innerHTML = `<div class="verdict ${ok ? 'ok' : 'no'}">${msg}</div>`; };

    if (!Eng.sttSupported) {
      mic.style.display = 'none';
      st.textContent = '';
      box.firstElementChild.insertAdjacentHTML('afterbegin', '<div class="note">Бұл браузер дауысты тани алмайды (Chrome немесе Edge қолданыңыз). Қазір жауапты ересек адам бағалайды:</div>');
      const ok = h('<button class="btn ok sm">✅ Дұрыс айтты</button>'), no = h('<button class="btn bad sm">❌ Қате</button>');
      ok.onclick = () => { verdict(true, '✅ Дұрыс!'); sfx.ok(); opts.onOk && opts.onOk({ score: 1 }); };
      no.onclick = () => { verdict(false, '❌ Тағы бір рет айтайық'); sfx.bad(); };
      vh.append(ok, no); return;
    }
    const help = () => {
      if (vh.childElementCount) return;
      const hb = h('<button class="btn soft sm">💡 Көмек</button>'), sk = h('<button class="btn soft sm">Өткізу ➜</button>');
      hb.onclick = () => { opts.onHelp && opts.onHelp(); say(opts.hint || ''); };
      sk.onclick = () => opts.onSkip && opts.onSkip();
      vh.append(hb, sk);
    };
    mic.onclick = () => {
      if (listening) { rec && rec.stop(); return; }
      listening = true; mic.classList.add('on'); vr.innerHTML = ''; hd.textContent = '';
      st.textContent = 'Тыңдап тұрмын… 🎧';
      rec = Eng.listen({
        continuous: !!opts.continuous,
        onInterim: (t) => { hd.textContent = '«' + t + '»'; },
        onDone: ({ texts, err }) => {
          listening = false; mic.classList.remove('on');
          if (!Eng.alive(E) || !box.isConnected) return;
          if (err === 'not-allowed' || err === 'service-not-allowed') { st.textContent = '🔒 Браузерде микрофонға рұқсат беріңіз'; return; }
          if (!texts.length) { st.textContent = 'Дыбыс естілмеді 🙉 Микрофонды басып, қайта айт'; return; }
          hd.textContent = 'Мен естідім: «' + texts[0] + '»';
          const r = opts.check(texts);
          if (r.ok) { st.textContent = ''; verdict(true, '✅ Дұрыс! ' + rnd(PRAISE)); sfx.ok(); opts.onOk && opts.onOk(r); }
          else { attempts++; st.textContent = ''; verdict(false, '❌ ' + (r.msg || 'Қате') + '. ' + rnd(RETRY)); sfx.bad(); say(rnd(RETRY)); if (attempts >= 2) help(); }
        },
      });
      if (opts.continuous) setTimeout(() => listening && rec && rec.stop(), 60000);
    };
  }

  /* ---------- бағыттау ---------- */
  function route() {
    Eng.stopAll();
    $$('.overlay').forEach((x) => x.remove());
    const [a, b, c] = location.hash.replace(/^#\/?/, '').split('/');
    view.innerHTML = ''; window.scrollTo(0, 0);
    $$('#nav a').forEach((x) => x.classList.toggle('on', x.dataset.r === (a === 's' ? 'sections' : a || 'home')));
    if (!a) home();
    else if (a === 'sections') sections();
    else if (a === 'rewards') rewards();
    else if (a === 'settings') settingsPage();
    else if (a === 's') {
      const id = +b; P.last = id; save();
      if (id === 1) (c ? breathEx(+c) : breathList());
      else if (id === 2) artic(+c || 1);
      else if (GAMES[id]) game(id);
      else home();
    } else home();
  }
  window.addEventListener('hashchange', route);

  /* ---------- басты бет ---------- */
  const secCard = (s) => `<a class="clay scard" href="#/s/${s.id}" style="text-decoration:none;color:inherit">
    <div class="ic c-${s.color}">${s.icon}</div><div class="meta"><h3>${s.id}. ${s.title}</h3><p>${s.desc}</p><div class="bar dark"><i style="width:${secPct(s.id)}%"></i></div></div><div class="go">➜</div></a>`;

  function home() {
    const last = SECTIONS[(P.last || 1) - 1];
    const n = todayN(), goal = 3;
    view.innerHTML = `
      <div class="clay hello"><div class="grow"><h1>Сәлем, ${settings.name || 'Чемпион'}! 👋</h1><p>Бүгін жаңа сөздер үйренейік. Сөйлеуге дайынсың ба?</p></div>${mascot('happy')}</div>
      <div class="tiles">${SECTIONS.map((s) => `<a class="tile" href="#/s/${s.id}" style="text-decoration:none"><div class="ic c-${s.color}">${s.icon}</div>${s.short}</a>`).join('')}</div>
      <div class="goal"><div class="grow"><h3>Бүгінгі мақсат</h3><p>${n >= goal ? 'Керемет! Мақсат орындалды 🎉' : `${goal} жаттығу орында · ${n}/${goal}`}</p><div class="bar"><i style="width:${Math.min(100, (n / goal) * 100)}%"></i></div></div><div class="big">🌟</div></div>
      <div class="sec-title">Жалғастыру</div><div class="cards">${secCard(last)}</div>
      <div class="sec-title">Барлық бөлімдер <small><a href="#/sections" style="color:inherit">Бәрі ➜</a></small></div>
      <div class="cards">${SECTIONS.filter((s) => s.id !== last.id).map(secCard).join('')}</div>
      <div class="sec-title">Менің жетістіктерім</div>
      <div class="clay stats"><div><b>⭐ ${P.stars}</b><span>Жұлдыз</span></div><div><b>🔥 ${streak()}</b><span>Күн қатарынан</span></div><div><b>${totalPct()}%</b><span>Прогресс</span></div></div>`;
  }
  function sections() {
    view.append(h('<div class="ph"><h2>Бөлімдер</h2><span class="clay-s stars">⭐ ' + P.stars + '</span></div>'));
    view.append(h(`<div class="cards">${SECTIONS.map(secCard).join('')}</div>`));
  }
  function rewards() {
    const done = (k) => !!P.done[k];
    const B = [
      ['⭐', 'Алғашқы жұлдыз', P.stars >= 1], ['🌟', '10 жұлдыз', P.stars >= 10], ['🏅', '30 жұлдыз', P.stars >= 30], ['🏆', '60 жұлдыз', P.stars >= 60],
      ['🌬️', 'Тыныс шебері', BREATH.every((e) => done('b' + e.id))], ['👅', 'Артикуляция шебері', ARTIC.every((e) => done('a' + e.id))],
      ['👂', 'Тыңдаушы', secPct(3) === 100], ['🎁', 'Сөз жинаушы', secPct(4) === 100], ['🚂', 'Машинист', secPct(5) === 100], ['📖', 'Әңгімеші', secPct(6) === 100],
      ['🔥', '3 күн қатарынан', streak() >= 3], ['👑', 'Логопед достығы', totalPct() === 100],
    ];
    view.innerHTML = `<div class="ph"><h2>Марапаттар</h2></div>
      <div class="clay stats"><div><b>⭐ ${P.stars}</b><span>Жұлдыз</span></div><div><b>🔥 ${streak()}</b><span>Күн қатарынан</span></div><div><b>${totalPct()}%</b><span>Прогресс</span></div></div>
      <div class="sec-title">Белгілер</div>
      <div class="badges">${B.map(([i, t, ok]) => `<div class="clay-s badge ${ok ? '' : 'lock'}"><span class="ic">${i}</span>${t}</div>`).join('')}</div>`;
  }
  function settingsPage() {
    view.innerHTML = `<div class="ph"><h2>Баптау</h2></div>
      <div class="clay-s set"><span>Баланың аты</span><input type="text" id="nm" maxlength="20" placeholder="Атың кім?" value="${settings.name || ''}"></div>
      <div class="clay-s set"><span>🔊 Түсіндірмелерді дауыспен оқу</span><button class="switch ${settings.voice ? 'on' : ''}" data-k="voice" aria-label="Дауыс"></button></div>
      <div class="clay-s set"><span>🎵 Дыбыс эффектілері</span><button class="switch ${settings.sfx ? 'on' : ''}" data-k="sfx" aria-label="Эффект"></button></div>
      <div class="clay-s set"><span>🎤 Дауыс тану: <b>${Eng.sttSupported ? 'қолдау бар' : 'жоқ (Chrome/Edge керек)'}</b></span></div>
      <div class="clay-s set"><span>🗣️ Қазақша дауыс: <b>${Eng.hasKazakhVoice() ? 'бар' : 'құрылғыда жоқ (орысша дауыс қолданылады)'}</b></span><button class="btn sm soft" id="tt">Тексеру</button></div>
      <div class="clay-s set"><span>📷 Камера мен микрофон рұқсаты</span><button class="btn sm soft" id="perm">Тексеру</button></div>
      <div id="pmsg" class="note" style="display:none"></div>
      <div class="clay-s set"><span>Прогрессті өшіру</span><button class="btn sm bad" id="reset">Өшіру</button></div>`;
    $('#nm').oninput = (e) => { settings.name = e.target.value.trim(); Eng.saveSettings(); };
    $$('.switch').forEach((s) => (s.onclick = () => { settings[s.dataset.k] = !settings[s.dataset.k]; s.classList.toggle('on'); Eng.saveSettings(); }));
    $('#tt').onclick = () => say('Сәлем! Мен сенімен бірге сөйлеймін.');
    $('#perm').onclick = async () => {
      const m = $('#pmsg'); m.style.display = 'block'; m.textContent = 'Тексеруде…';
      try { const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true }); s.getTracks().forEach((t) => t.stop()); m.textContent = '✅ Камера мен микрофон жұмыс істейді.'; }
      catch (e) { m.textContent = '❌ Рұқсат жоқ немесе құрылғы табылмады: ' + (e.name || e) + '. Сайт HTTPS немесе localhost арқылы ашылуы керек.'; }
    };
    $('#reset').onclick = () => { if (confirm('Барлық жұлдыздар мен прогресс өшеді. Жалғастырасың ба?')) { localStorage.removeItem('sz_progress'); location.hash = '#/'; location.reload(); } };
  }

  /* ---------- 1-бөлім: тыныс алу ---------- */
  function breathList() {
    view.append(header('1. Тыныс алу жаттығулары', '#/sections'));
    view.append(h(`<div class="cards">${BREATH.map((e, i) => `<a class="clay scard" href="#/s/1/${e.id}" style="text-decoration:none;color:inherit"><div class="ic c-sky">${e.icon}</div><div class="meta"><h3>${e.id}. «${e.title}»</h3><p>${e.steps[1]}</p><div class="bar dark"><i style="width:${P.done['b' + e.id] ? 100 : 0}%"></i></div></div><div class="go">➜</div></a>`).join('')}</div>`));
  }

  const SCENES = {
    flower: {
      html: () => `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMax meet"><rect y="230" width="400" height="70" fill="#bfeec0"/>
        <path d="M200 250V150" stroke="#52b86b" stroke-width="9" stroke-linecap="round"/><path d="M200 215q-34-6-42-34 30 0 42 34z" fill="#6fd186"/><path d="M200 195q34-6 42-34-30 0-42 34z" fill="#6fd186"/>
        <g transform="translate(200 120)"><g id="petals">${[0, 1, 2, 3, 4, 5, 6, 7].map(() => '<ellipse cx="0" cy="-34" rx="17" ry="34" fill="#ff9fc6" stroke="#ff7fb0" stroke-width="2"/>').join('')}</g><circle id="fc" r="20" fill="#ffd45e" stroke="#f0b73a" stroke-width="3" opacity=".25"/></g></svg>`,
      update(el, p) {
        const pt = $$('#petals ellipse', el);
        pt.forEach((e, i) => e.setAttribute('transform', `rotate(${i * 45 * p}) scale(${0.62 + 0.38 * p})`));
        $('#fc', el).setAttribute('opacity', 0.25 + 0.75 * p);
      },
    },
    feather: {
      html: () => '<div class="feather-track"></div><div id="feather">🪶</div><div style="position:absolute;right:14px;top:44%;font-size:2.4rem">🏁</div>',
      update(el, p) { const f = $('#feather', el); f.style.left = 4 + p * 80 + '%'; f.style.transform = `rotate(${Math.sin(p * 14) * 14}deg)`; },
    },
    boat: {
      html: (rounds) => `<div class="river"></div><div id="boat">⛵</div>${Array.from({ length: rounds }, (_, i) => `<div class="stn" id="stn${i}" style="left:${((i + 1) / rounds) * 80 + 8}%">${i === rounds - 1 ? '🏝️' : '🚩'}</div>`).join('')}`,
      update(el, p, round, rounds) {
        const x = (round + p) / rounds;
        $('#boat', el).style.left = 2 + x * 78 + '%';
        for (let i = 0; i < rounds; i++) $('#stn' + i, el).classList.toggle('on', i < round || (i === round && p >= 1));
      },
    },
  };

  function breathEx(id) {
    const ex = BREATH[id - 1]; if (!ex) return home();
    const E = Eng.epoch(); const sc = SCENES[ex.scene];
    view.append(header(`«${ex.title}»`, '#/s/1'));
    view.append(h(`<div class="clay panel"><div class="row"><div class="grow"><b>Жаттығу қадамдары</b></div></div><ol class="steps">${ex.steps.map((s, i) => `<li><b>${i + 1}</b><span>${s}</span></li>`).join('')}</ol><div class="row" style="margin-top:12px" id="intro"></div></div>`));
    view.append(h(`<div class="scene" id="scene"><div class="coach" id="coach">Бастау батырмасын бас 👇</div>${sc.html(ex.rounds)}</div>`));
    view.append(h(`<div class="clay panel"><div class="row"><span>Дем күші</span><div class="grow meter lv"><i id="lvl"></i></div></div>
      <div class="row" style="margin-top:12px"><span>Жаттығу</span><div class="grow meter"><i id="prog"></i></div><span id="rcount">0/${ex.rounds}</span></div>
      <div class="row center" style="justify-content:center;margin-top:16px"><button class="btn" id="go">▶ Бастау</button><button class="btn soft hold" id="hold">🌬️ Басып тұрып үрле</button></div>
      <div class="note" id="mnote">Микрофон дем шығарғаныңды естиді. Микрофон болмаса, «Басып тұрып үрле» батырмасын қолдан.</div></div>`));
    $('#intro').append(sayBtn(ex.steps.join(' ')));
    const scene = $('#scene'), coach = $('#coach'), lvl = $('#lvl'), prog = $('#prog');
    sc.update(scene, 0, 0, ex.rounds);

    let running = false, holding = false, level = 0, micOk = false, micTried = false, base = [], phase = '';
    const hold = $('#hold');
    ['pointerdown'].forEach((ev) => hold.addEventListener(ev, (e) => { e.preventDefault(); holding = true; }));
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => hold.addEventListener(ev, () => { holding = false; }));
    const frame = () => new Promise((r) => requestAnimationFrame(r));
    const onLevel = (v) => { level = v; if (phase === 'inhale') base.push(v); lvl.style.width = Math.min(100, v * 600) + '%'; };

    async function cycle(round) {
      phase = 'inhale'; base = []; prog.style.width = '0%';
      sc.update(scene, 0, round, ex.rounds);
      coach.textContent = '👃 Мұрныңмен баяу дем ал'; await say('Мұрныңмен баяу дем ал');
      if (!Eng.alive(E)) return null;
      const t0 = performance.now();
      while (performance.now() - t0 < 3800) { if (!Eng.alive(E)) return null; await frame(); }
      phase = 'exhale'; coach.textContent = '😮‍💨 Ауызбен жай шығар'; await say('Енді ауызбен жай шығар');
      if (!Eng.alive(E)) return null;
      const sorted = [...base].sort((a, b) => a - b);
      const med = sorted.length ? sorted[Math.floor(sorted.length * 0.6)] : 0.01;
      const thr = Math.max(0.025, med * 3 + 0.015);
      let p = 0, last = performance.now(), t1 = last, warned = 0;
      while (Eng.alive(E) && performance.now() - t1 < 14000) {
        await frame();
        const now = performance.now(), dt = (now - last) / 1000; last = now;
        const lv = holding ? 1 : level;
        const good = holding || lv > thr, strong = !holding && micOk && lv > Math.max(thr * 8, 0.4);
        if (strong) { p = Math.max(0, p - dt * 0.08); coach.textContent = '🪶 Жайырақ! Баяу шығар'; warned = now; }
        else if (good) { p = Math.min(1, p + dt / 3.2); if (now - warned > 800) coach.textContent = '😮‍💨 Жарайсың, жалғастыр!'; }
        else p = Math.max(0, p - dt / 12);
        sc.update(scene, p, round, ex.rounds); prog.style.width = p * 100 + '%';
        if (p >= 1) return true;
      }
      return false;
    }

    async function start() {
      if (running) return; running = true; $('#go').disabled = true;
      if (!micTried) {
        micTried = true;
        try { await Eng.startBlow(onLevel); micOk = true; $('#mnote').textContent = '🎤 Микрофон қосылды. Ауызыңды микрофонға жақындатып, жай үрле.'; }
        catch { micOk = false; $('#mnote').textContent = 'Микрофон қолжетімсіз — «Басып тұрып үрле» батырмасын қолдан.'; }
      }
      let round = 0, fails = 0;
      while (round < ex.rounds) {
        const ok = await cycle(round);
        if (ok === null || !Eng.alive(E)) return;
        if (ok) {
          sfx.ok(); round++; $('#rcount').textContent = `${round}/${ex.rounds}`; addStars(1);
          coach.textContent = '🌟 ' + rnd(PRAISE); await say(rnd(PRAISE));
          if (!Eng.alive(E)) return;
          if (round < ex.rounds) { await Eng.sleep(900, E); if (!Eng.alive(E)) return; }
        } else { fails++; coach.textContent = 'Тағы байқап көрейік 💪'; sfx.bad(); await say(rnd(RETRY)); }
      }
      Eng.stopBlow(); markDone('b' + id); addStars(2);
      modal({ title: 'Жарайсың!', text: `«${ex.title}» жаттығуы аяқталды`, stars: 3, buttons: [id < BREATH.length ? { label: 'Келесі жаттығу ➜', fn: () => (location.hash = `#/s/1/${id + 1}`) } : { label: 'Бөлімдерге ➜', fn: () => (location.hash = '#/sections') }, { label: 'Қайталау', cls: 'soft', fn: route }] });
    }
    $('#go').onclick = start;
    setTimeout(() => Eng.alive(E) && say(ex.steps.join(' ')), 400);
  }

  /* ---------- 2-бөлім: артикуляция (алдыңғы камера) ---------- */
  function artic(id) {
    const ex = ARTIC[id - 1] || ARTIC[0]; id = ex.id;
    const E = Eng.epoch();
    view.append(header('2. Артикуляциялық жаттығулар', '#/sections'));
    view.append(h(`<div class="chips">${ARTIC.map((a) => `<a class="chip ${a.id === id ? 'on' : ''} ${P.done['a' + a.id] ? 'done' : ''}" href="#/s/2/${a.id}" style="text-decoration:none">${a.icon} ${a.title}</a>`).join('')}</div>`));
    view.append(h(`<div class="artic">
      <div class="cam" id="cam"><span class="tag">🪞 Айнаға қарап жаттық</span><video id="vid" autoplay playsinline muted></video><div class="faceguide"></div><div class="face">${ex.icon}</div><div class="ring" id="ring"></div>
        <div class="nocam" id="nocam" style="display:none"><div>📷<br>Камераға рұқсат беріңіз<br><br><button class="btn sm" id="camb">Камераны қосу</button></div></div></div>
      <div><div class="clay panel"><h3 style="font-size:1.3rem">${ex.icon} «${ex.title}»</h3>
        <ol class="steps" id="steps">${ex.steps.map((s, i) => `<li><b>${i + 1}</b><span>${s}</span></li>`).join('')}</ol>
        <div class="reps" id="reps">${Array.from({ length: ex.reps }, (_, i) => `<i>${i + 1}</i>`).join('')}</div>
        <div class="row"><button class="btn" id="go">▶ Бастау</button><button class="btn soft sm" id="rd">🔊 Түсіндірме</button></div></div>
        <div class="note">Камера құрылғыда ғана көрсетіледі, ешқайда жіберілмейді.</div></div></div>`));
    const vid = $('#vid'), nocam = $('#nocam'), ring = $('#ring');
    async function cam() {
      try { await Eng.startCam(vid); nocam.style.display = 'none'; }
      catch { nocam.style.display = 'grid'; }
    }
    $('#camb').onclick = cam; cam();

    let token = 0, running = false;
    const lis = $$('#steps li'), reps = $$('#reps i');
    async function readSteps() {
      const T = ++token;
      for (let i = 0; i < lis.length; i++) { if (T !== token || !Eng.alive(E)) return false; lis[i].classList.add('hl'); await say(ex.steps[i]); lis[i].classList.remove('hl'); }
      return T === token;
    }
    $('#rd').onclick = () => { running = false; readSteps(); };
    async function run() {
      if (running) { running = false; token++; ring.classList.remove('on'); $('#go').textContent = '▶ Бастау'; Eng.stopSpeak(); return; }
      running = true; $('#go').textContent = '⏹ Тоқтату'; reps.forEach((r) => (r.className = ''));
      if (!(await readSteps()) || !running) return;
      await say('Бастайық! Айнаға қара.');
      for (let r = 0; r < ex.reps; r++) {
        if (!running || !Eng.alive(E)) return;
        reps[r].className = 'cur'; ring.classList.add('on');
        say(NUM_KK[r + 1] || String(r + 1));
        for (let s = ex.hold; s > 0; s--) {
          ring.textContent = s;
          if (ex.kind === 'horse') { sfx.clop(); await Eng.sleep(500, E); sfx.clop(); await Eng.sleep(500, E); } else { sfx.tick(); await Eng.sleep(1000, E); }
          if (!running || !Eng.alive(E)) return;
        }
        reps[r].className = 'fin'; ring.textContent = '✓'; sfx.pop(); await Eng.sleep(900, E);
      }
      ring.classList.remove('on'); running = false; $('#go').textContent = '▶ Бастау';
      markDone('a' + id); addStars(2);
      modal({ title: 'Жарайсың!', text: `«${ex.title}» жаттығуы дайын`, stars: 2, buttons: [id < ARTIC.length ? { label: 'Келесі жаттығу ➜', fn: () => (location.hash = `#/s/2/${id + 1}`) } : { label: 'Бөлімдерге ➜', fn: () => (location.hash = '#/sections') }, { label: 'Қайталау', cls: 'soft', fn: route }] });
    }
    $('#go').onclick = run;
    setTimeout(() => Eng.alive(E) && !running && readSteps(), 600);
  }

  /* ---------- 3–6: ойын қабығы ---------- */
  const RUNNERS = {};
  function game(id) {
    const S = SECTIONS[id - 1], G = GAMES[id]; const E = Eng.epoch();
    let lv = G.levels.findIndex((_, i) => !P.done[`g${id}l${i}`]); if (lv < 0) lv = 0;
    view.append(header(`${id}. ${G.title}`, '#/sections'));
    view.append(h(`<div class="clay panel" id="intro"><div class="row"><div class="grow">${G.intro}</div></div><div class="row" style="margin-top:10px" id="introb"></div></div>`));
    $('#introb').append(sayBtn(G.intro));
    view.append(h('<div class="chips" id="lvls"></div>'));
    view.append(h('<div class="clay stage" id="stage"></div>'));
    const stage = $('#stage');
    let idx = 0;
    function chips() {
      $('#lvls').innerHTML = G.levels.map((l, i) => `<button class="chip ${i === lv ? 'on' : ''} ${P.done[`g${id}l${i}`] ? 'done' : ''}" data-i="${i}">${i + 1}. ${l.name}</button>`).join('') + `<span class="chip" style="box-shadow:none;background:none" id="linfo"></span>`;
      $$('#lvls .chip[data-i]').forEach((b) => (b.onclick = () => { Eng.abortListen(); Eng.stopSpeak(); lv = +b.dataset.i; idx = 0; chips(); render(); }));
      $('#linfo').textContent = G.levels[lv].info;
    }
    function render() {
      const tasks = G.levels[lv].tasks; stage.innerHTML = ''; Eng.abortListen();
      const bar = h(`<div class="row" style="justify-content:space-between"><b>${lv + 1}-деңгей · ${idx + 1}/${tasks.length}</b><div class="dots">${tasks.map((_, i) => `<i class="${i < idx ? 'fin' : i === idx ? 'on' : ''}"></i>`).join('')}</div></div>`);
      const body = h('<div id="body"></div>'); stage.append(bar, body);
      let won = false;
      RUNNERS[id](body, tasks[idx], lv, {
        E, win(noStar) {
          if (won) return; won = true;
          if (!noStar) addStars(1);
          sfx.ok(); confetti(14);
          const nb = h('<div class="center" style="margin-top:16px"><button class="btn">Келесі ➜</button></div>');
          nb.firstElementChild.onclick = () => {
            if (idx + 1 < tasks.length) { idx++; render(); }
            else {
              markDone(`g${id}l${lv}`); addStars(3); chips();
              modal({ title: 'Деңгей аяқталды!', text: `${lv + 1}-деңгей: ${G.levels[lv].name}`, stars: 3, buttons: [lv < 2 ? { label: 'Келесі деңгей ➜', fn: () => { lv++; idx = 0; chips(); render(); } } : { label: 'Бөлімдерге ➜', fn: () => (location.hash = '#/sections') }, { label: 'Қайталау', cls: 'soft', fn: () => { idx = 0; render(); } }] });
            }
          };
          body.append(nb); say(rnd(PRAISE));
        },
      });
    }
    chips(); render();
    setTimeout(() => Eng.alive(E) && say(G.intro), 500);
  }

  /* --- 3-ойын: логопедтің тапсырмасы --- */
  RUNNERS[3] = (box, t, lv, api) => {
    let step = 0;
    box.innerHTML = `<div class="big-say clay-s c-yellow">«${t.say}»</div>
      <div class="row" style="justify-content:center;margin-top:10px"><button class="btn soft sm" id="rep">🔊 Қайта тыңдау</button></div>
      <div class="seqdots" style="margin-top:12px">${t.seq.map(() => '<i></i>').join('')}</div>
      <div class="items">${shuffle(t.items).map(([e, k]) => `<button class="item" data-k="${k}"><span class="e">${e}</span><small>${k}</small></button>`).join('')}</div>`;
    const dots = $$('.seqdots i', box);
    $('#rep', box).onclick = () => say(t.say);
    setTimeout(() => Eng.alive(api.E) && say(t.say), 300);
    $$('.item', box).forEach((b) => (b.onclick = () => {
      if (step >= t.seq.length) return;
      if (b.dataset.k === t.seq[step]) {
        b.classList.remove('good'); void b.offsetWidth; b.classList.add('good'); sfx.pop(); dots[step].classList.add('fin'); step++;
        if (step === t.seq.length) api.win();
      } else {
        b.classList.remove('wrong'); void b.offsetWidth; b.classList.add('wrong'); sfx.bad(); step = 0; dots.forEach((d) => d.classList.remove('fin'));
        say('Тапсырманы қайта тыңдайық. ' + t.say);
      }
    }));
  };

  /* --- 4-ойын: сиқырлы сандық --- */
  RUNNERS[4] = (box, t, lv, api) => {
    const hintWord = t.word.slice(0, Math.min(2, t.word.length)) + '…';
    box.innerHTML = '<div class="center"><div class="big-say">Сиқырлы сандықты бас!</div><button class="chest" id="chest" aria-label="Сандық">🎁</button></div>';
    say('Сиқырлы сандықты бас!');
    $('#chest', box).onclick = () => {
      sfx.pop(); sfx.star();
      if (lv === 0) {
        const others = shuffle(GAMES[4].levels[0].tasks.filter((x) => x.word !== t.word)).slice(0, 2);
        box.innerHTML = `<div class="big-say">Сандықтан сурет шықты! Тыңда:</div><div class="items">${shuffle([t, ...others]).map((x) => `<button class="item" data-w="${x.word}"><span class="e">${x.e}</span></button>`).join('')}</div><div class="center"><button class="btn soft sm" id="rp">🔊 Қайта тыңдау</button></div>`;
        const q = `Қайсысы — ${t.word}?`; say(q); $('#rp', box).onclick = () => say(q);
        $$('.item', box).forEach((b) => (b.onclick = () => {
          if (b.dataset.w === t.word) { sfx.pop(); b.classList.add('good'); setTimeout(() => speakStage(), 700); } else { b.classList.add('wrong'); sfx.bad(); say('Тағы тыңда. ' + q); setTimeout(() => b.classList.remove('wrong'), 500); }
        }));
      } else speakStage();
    };
    function speakStage() {
      const targets = lv === 0 ? [t.word] : t.ans;
      const prompt = lv === 0 ? `Бұл — ${t.word}. Енді өзің айт: ${t.word}` : lv === 1 ? t.q : t.q + ' Заттың атын да айт!';
      box.innerHTML = `<div class="pic">${t.e}</div><div class="big-say">${lv === 0 ? `«${t.word}»` : t.q}</div><div class="center"><div id="hint" class="caption"></div><button class="btn soft sm" id="rp">🔊 Қайта тыңдау</button></div><div id="vb"></div>`;
      say(prompt); $('#rp', box).onclick = () => say(prompt);
      const full = lv === 0 ? t.word : t.show;
      voiceBox($('#vb', box), {
        hint: lv === 0 ? `${t.word}. Қайтала: ${t.word}` : `Былай айтуға болады: ${t.show}`,
        onHelp: () => { $('#hint', box).textContent = lv === 0 ? hintWord : t.show; if (lv === 0) say(hintWord); },
        check: (texts) => { const s = Match.bestMatch(texts, targets); return { ok: s >= 0.72, score: s, msg: 'Дұрыс жауап: ' + full }; },
        onOk: () => { $('#hint', box).textContent = full; api.win(); },
        onSkip: () => api.win(true),
      });
    }
  };

  /* --- 5-ойын: пойыз (сүйреу + дауыс) --- */
  RUNNERS[5] = (box, t, lv, api) => {
    const W = t.words, n = W.length, sentence = W.join(' ') + (lv > 0 ? '.' : '');
    const pool = shuffleNot(W.map((_, i) => i)); let placed = Array(n).fill(null); let locked = false;
    const style = t.big ? 'transform:scale(1.5)' : t.small ? 'transform:scale(.6)' : '';
    box.innerHTML = `<div class="center" style="font-size:3.4rem;${style}">${t.pic}</div><div class="center caption">Сөздерді вагондарға сүйреп апар</div><div class="train" id="train"></div><div class="pool" id="pool"></div><div id="after"></div>`;
    const train = $('#train', box), poolEl = $('#pool', box);
    const intro = lv === 0 ? 'Суретке сәйкес екі сөзді вагондарға орналастыр' : lv === 1 ? 'Сөздерді дұрыс ретпен орналастырып, сөйлем құрастыр' : 'Сөздерді реттеп, толық сөйлем құрастыр';
    say(intro);
    function render() {
      train.innerHTML = '<div class="loco">🚂</div>' + placed.map((wi, si) => `<div class="slotwrap">${t.labels ? `<small>${t.labels[si]}</small>` : '<small>&nbsp;</small>'}<div class="slot" data-s="${si}">${wi !== null ? `<div class="chip2" data-w="${wi}" data-from="${si}">${W[wi]}</div>` : ''}</div><div class="wheels">●●</div></div>`).join('');
      poolEl.innerHTML = pool.filter((wi) => !placed.includes(wi)).map((wi) => `<div class="chip2" data-w="${wi}" data-from="-1">${W[wi]}</div>`).join('') || '<span style="color:var(--muted)">Барлық сөз вагондарда ✓</span>';
      if (!locked) $$('.chip2', box).forEach(drag);
    }
    function drag(el) {
      el.onpointerdown = (e) => {
        e.preventDefault(); const sx = e.clientX, sy = e.clientY; let g = null, moved = false;
        const wi = +el.dataset.w, from = +el.dataset.from;
        const mv = (ev) => {
          if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 8) { moved = true; g = el.cloneNode(true); g.className = 'chip2 ghost'; document.body.appendChild(g); el.style.opacity = '.3'; }
          if (g) { g.style.left = ev.clientX + 'px'; g.style.top = ev.clientY + 'px'; $$('.slot', box).forEach((s) => s.classList.remove('over')); const s = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.slot'); s && s.classList.add('over'); }
        };
        const up = (ev) => {
          window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
          g && g.remove();
          if (!moved) { // шерту
            if (from >= 0) placed[from] = null; else { const k = placed.indexOf(null); if (k >= 0) placed[k] = wi; }
          } else {
            const s = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.slot');
            if (s) { const si = +s.dataset.s; if (from >= 0) placed[from] = null; placed[si] = wi; }
            else if (from >= 0) placed[from] = null;
          }
          sfx.pop(); render(); if (placed.every((x) => x !== null)) check();
        };
        window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
      };
    }
    function check() {
      if (placed.every((wi, si) => wi === si)) {
        locked = true; render(); train.classList.add('go'); sfx.choo();
        $('#after', box).innerHTML = `<div class="sentence">${sentence}</div><div class="center caption">Енді дайын сөйлемді дауыстап айт!</div><div id="vb"></div>`;
        say(sentence);
        voiceBox($('#vb', box), {
          hint: sentence, onHelp: () => { $('.sentence', box).style.fontSize = '2rem'; },
          check: (texts) => { const s = Match.bestMatch(texts, [sentence]); return { ok: s >= (n <= 2 ? 0.72 : 0.7), score: s, msg: 'Сөйлем: ' + sentence }; },
          onOk: () => api.win(), onSkip: () => api.win(true),
        });
      } else { sfx.bad(); train.classList.remove('shake'); void train.offsetWidth; train.classList.add('shake'); say('Сөздердің орнын ауыстырып көр'); }
    }
    render();
  };

  /* --- 6-ойын: оқиғаны жалғастыр --- */
  RUNNERS[6] = (box, t, lv, api) => {
    const pics = t.pics, n = pics.length; let k = 0;
    const order = shuffleNot(pics.map((_, i) => i));
    box.innerHTML = `<div class="center big-say">«${t.title}»</div><div class="center caption" id="cap">Суреттерді оқиға ретімен орналастыр</div>
      <div class="slots6" id="slots">${pics.map((_, i) => `<div class="s6"><em>${i + 1}</em></div>`).join('')}</div>
      <div class="story" id="cards">${order.map((i) => `<button class="card6" data-i="${i}">${pics[i].e}</button>`).join('')}</div><div id="vb"></div>`;
    const cap = $('#cap', box), slots = $$('#slots .s6', box);
    say('Суреттерді оқиға ретімен орналастыр');
    $$('.card6', box).forEach((b) => (b.onclick = () => {
      const i = +b.dataset.i;
      if (i === k) {
        const s = slots[k]; s.classList.add('fill'); s.insertAdjacentHTML('beforeend', `${pics[i].e}<small>${pics[i].cap}</small>`); b.remove();
        cap.textContent = pics[i].cap; sfx.pop(); say(pics[i].cap); k++;
        if (k === n) setTimeout(speakPhase, 1400);
      } else { b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); sfx.bad(); say('Бұл суреттен бұрын не болды? Қайта ойлан'); }
    }));
    const tick = (j) => slots[j].insertAdjacentHTML('beforeend', '<span class="tick">✅</span>');
    function speakPhase() {
      $('#cards', box).remove();
      if (lv < 2) {
        const ask = (j) => {
          slots.forEach((s, x) => (s.style.outline = x === j ? '4px solid #ffd45e' : ''));
          cap.textContent = `${j + 1}-сурет: не болды? Бір сөйлем айт`; say(`${j + 1}-сурет. Не болды? Бір сөйлем айт`);
          voiceBox($('#vb', box), {
            hint: pics[j].cap, onHelp: () => { cap.textContent = pics[j].cap; },
            check: (texts) => { const s = Math.max(Match.stemScore(texts, pics[j].kw), Match.bestMatch(texts, [pics[j].cap]) >= 0.65 ? 1 : 0); return { ok: s >= 0.5, score: s, msg: 'Үлгі: ' + pics[j].cap }; },
            onOk: () => { tick(j); if (j + 1 < n) setTimeout(() => ask(j + 1), 1500); else { slots.forEach((s) => (s.style.outline = '')); cap.textContent = 'Әңгіме дайын! 🎉'; api.win(); } },
            onSkip: () => { if (j + 1 < n) ask(j + 1); else api.win(true); },
          });
        };
        ask(0);
      } else {
        cap.textContent = 'Енді оқиғаны басынан аяғына дейін 4–5 сөйлеммен айт!'; say('Енді оқиғаны басынан аяғына дейін төрт-бес сөйлеммен айтып бер');
        const need = Math.ceil(n * 0.6);
        voiceBox($('#vb', box), {
          continuous: true, hint: pics.map((p) => p.cap).join('. '), onHelp: () => { cap.textContent = pics.map((p) => p.cap).join('. '); },
          check: (texts) => {
            $$('.tick', box).forEach((x) => x.remove());
            const full = texts[texts.length - 1] && texts.length > 1 ? [texts[texts.length - 1], ...texts] : texts;
            let c = 0; pics.forEach((p, j) => { if (Match.stemScore(full, p.kw) >= 0.5) { c++; tick(j); } });
            return { ok: c >= need, score: c / n, msg: `Суреттердің ${c}/${n} бөлігі айтылды, кемі ${need} керек` };
          },
          onOk: () => api.win(), onSkip: () => api.win(true),
        });
      }
    }
  };

  route();
})();
