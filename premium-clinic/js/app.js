/* Premium Clinic — қосымша логикасы */
(function () {
  const { STAGES, SECTIONS, SOUNDS } = window.PC;
  const app = document.getElementById('app');
  const FAST = /[?&]fast\b/.test(location.search);
  const T = (ms) => (FAST ? ms * 0.05 : ms);
  const ROMAN = ['I', 'II', 'III', 'IV'];

  /* ---------- көмекші функциялар ---------- */
  function el(tag, attrs, ...kids) {
    let id = null;
    tag = tag.replace(/#([\w-]+)/, (_, x) => { id = x; return ''; });
    const [name, ...cls] = tag.split('.');
    const n = document.createElement(name || 'div');
    if (cls.length) n.className = cls.join(' ');
    if (id) n.id = id;
    for (const k in attrs || {}) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (k === 'html') n.innerHTML = v;
      else if (k === 'style') n.style.cssText = v;
      else n.setAttribute(k, v === true ? '' : v);
    }
    kids.flat().forEach((c) => c != null && n.append(c));
    return n;
  }
  const shuffle = (a) => {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);
  const has = (w, L) => w.toLowerCase().includes(L.toLowerCase());

  let cleanups = [];
  const onCleanup = (fn) => cleanups.push(fn);
  const cleanup = () => { stopVoice(); cleanups.forEach((f) => { try { f(); } catch (e) {} }); cleanups = []; };
  const later = (fn, ms) => { const id = setTimeout(fn, T(ms)); onCleanup(() => clearTimeout(id)); return id; };

  /* ---------- прогресс ---------- */
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };
  let progress = store.get('pc-progress', {});
  let unlockAll = store.get('pc-unlock', false);
  const tabKey = (s, sec, i) => `${s.id}:${sec}:${i}`;
  const tabDone = (s, sec, i) => !!progress[tabKey(s, sec, i)];
  const markTab = (s, sec, i) => { progress[tabKey(s, sec, i)] = 1; store.set('pc-progress', progress); };
  const secDone = (s, sec) => tabsFor(s, sec).every((_, i) => tabDone(s, sec, i));
  const secOpen = (s, idx) => unlockAll || idx === 0 || secDone(s, SECTIONS[idx - 1].id);
  const soundPct = (s) => Math.round((SECTIONS.filter((x) => secDone(s, x.id)).length / SECTIONS.length) * 100);
  const secTitle = (s, sec) => (sec.id === '2.2' ? s.where.t : sec.t);

  /* ---------- дыбыс әсерлері ---------- */
  let actx;
  function tone(freqs, dur = 0.12) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      freqs.forEach((f, i) => {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = 'sine'; o.frequency.value = f;
        const t0 = actx.currentTime + i * dur;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(g).connect(actx.destination); o.start(t0); o.stop(t0 + dur + 0.02);
      });
    } catch (e) {}
  }
  const sfx = { ok: () => tone([660, 880]), bad: () => tone([220], 0.18), win: () => tone([523, 659, 784, 1047], 0.13) };

  /* ---------- дауыстық жазбалар ---------- */
  // Кілттер: сөз/буын — кіші әріппен, жеке дыбыс — «дыбыс:Р», түсіндірме — толық мәтін.
  const AUDIO = window.PC_AUDIO || {};
  const src = (k) => AUDIO[k] || AUDIO[String(k).toLowerCase()];
  const sndKey = (L) => 'дыбыс:' + L;
  let voice = null, pending = null;
  function playNow(k) {
    const u = src(k);
    pending = null;
    if (!u) return false;
    try {
      if (voice) { voice.onended = null; voice.pause(); }
      voice = new Audio(u);
      voice.onended = () => { voice = null; if (pending) { const n = pending; pending = null; playNow(n); } };
      voice.play().catch(() => { voice = null; });
    } catch (e) { voice = null; }
    return true;
  }
  // Автоматты ойнату: түсіндірме оқылып жатса, оны үзбей, кезекке қояды
  function speak(k, delay) {
    if (!src(k)) return false;
    const go = () => { if (voice && !voice.ended && !voice.paused) pending = k; else playNow(k); };
    if (delay) later(go, delay); else go();
    return true;
  }
  function stopVoice() { pending = null; if (voice) { try { voice.onended = null; voice.pause(); } catch (e) {} voice = null; } }
  const listenBtn = (k, label) => (src(k)
    ? el('button.listen', { type: 'button', onclick: () => playNow(k) }, '🔊 ' + (label || 'Тыңдау')) : null);

  /* баланың өз дауысын жазып, қайта тыңдауы */
  function recorder(label, onDone, maxMs = 7000) {
    const btn = el('button.btn.rec-btn', { type: 'button' }, '🎤 ' + label);
    const play = el('button.listen.hidden', { type: 'button' }, '▶ Өз дауысыңды тыңда');
    const note = el('p.hint.hidden');
    let mr = null, chunks = [], stream = null, url = null, timer = 0;
    const stop = () => { if (mr && mr.state === 'recording') mr.stop(); };
    const fail = () => {
      note.textContent = 'Микрофон қолжетімсіз. Дауыстап айт та, жалғастыра бер.';
      note.classList.remove('hidden');
      if (onDone) onDone(false);
    };
    btn.addEventListener('click', async () => {
      if (mr && mr.state === 'recording') return stop();
      if (!navigator.mediaDevices || !window.MediaRecorder) return fail();
      try {
        stopVoice();
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        chunks = []; mr = new MediaRecorder(stream);
        mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
        mr.onstop = () => {
          clearTimeout(timer); stream.getTracks().forEach((t) => t.stop());
          if (url) URL.revokeObjectURL(url);
          url = URL.createObjectURL(new Blob(chunks, { type: mr.mimeType }));
          btn.classList.remove('on'); btn.textContent = '🎤 Қайта айтып көр';
          play.classList.remove('hidden');
          new Audio(url).play().catch(() => {});
          if (onDone) onDone(true);
        };
        mr.start(); btn.classList.add('on'); btn.textContent = '⏹ Айтып болдым';
        timer = setTimeout(stop, maxMs);
      } catch (e) { fail(); }
    });
    play.addEventListener('click', () => { if (url) new Audio(url).play().catch(() => {}); });
    onCleanup(() => { clearTimeout(timer); try { if (mr && mr.state === 'recording') { mr.onstop = null; mr.stop(); } if (stream) stream.getTracks().forEach((t) => t.stop()); } catch (e) {} });
    return el('div.rec', {}, btn, play, note);
  }

  /* YouTube бейне үлгісі: басқанда ғана жүктеледі */
  function videoCard(id) {
    const box = el('div.video');
    const open = el('button.video-open', { type: 'button' }, el('span.video-play', {}, '▶'), el('span', {}, 'Бейне үлгіні көру'));
    open.addEventListener('click', () => {
      stopVoice();
      box.innerHTML = '';
      box.append(el('iframe', { src: `https://www.youtube-nocookie.com/embed/${id}?rel=0&autoplay=1`, title: 'Бейне үлгі', allow: 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture', allowfullscreen: true, loading: 'lazy' }));
    });
    box.append(open);
    return el('div.video-wrap', {}, box, el('a.video-link', { href: `https://youtu.be/${id}`, target: '_blank', rel: 'noopener' }, 'YouTube-та ашу ↗'));
  }

  function shake(n) { n.classList.remove('shake'); void n.offsetWidth; n.classList.add('shake'); sfx.bad(); }

  /* ---------- раундтар ---------- */
  function rounds(host, items, draw, done) {
    let i = 0;
    const bar = el('div.rbar'), stage = el('div.rstage');
    host.append(bar, stage);
    (function step() {
      bar.innerHTML = items.map((_, k) => `<i class="${k < i ? 'on' : k === i ? 'cur' : ''}"></i>`).join('');
      if (i >= items.length) return done();
      stage.innerHTML = ''; stage.classList.remove('in'); void stage.offsetWidth; stage.classList.add('in');
      draw(items[i], stage, () => { i++; later(step, 750); }, i);
    })();
  }

  // opts: [{label, ok, cls}] — дұрыс жауап басылғанда next()
  function choices(stage, opts, next, extra = {}) {
    const row = el('div.choices' + (extra.cls ? '.' + extra.cls : ''));
    opts.forEach((o) => {
      const b = el('button.choice' + (o.cls ? '.' + o.cls : ''), { type: 'button' }, o.label);
      b._ok = !!o.ok;
      b.addEventListener('click', () => {
        if (row.classList.contains('locked')) return;
        if (o.ok) {
          row.classList.add('locked'); b.classList.add('ok'); sfx.ok();
          if (extra.onOk) extra.onOk(b);
          if (extra.manual) extra.manual(next); else next();
        } else shake(b);
      });
      row.append(b);
    });
    stage.append(row);
    return row;
  }

  const wordCard = (w, L) => el('div.wordcard', { html: [...w].map((c) => (L && c.toLowerCase() === L.toLowerCase() ? `<b>${c}</b>` : c)).join('') });

  const letterBtn = (x, cls = '') => el('button.bigletter' + cls, { type: 'button', 'aria-label': `${x} дыбысын тыңдау`, onclick: () => playNow(sndKey(x)) }, x);

  /* ---------- деңгей режимдері ---------- */
  const MODES = {
    seq(host, lv, s, done) {
      const target = s.L;
      rounds(host, lv.seq, (x, st, next) => {
        st.append(el('p.hint', {}, src(sndKey(x)) ? 'Дыбысты тыңда. Әріпті бассаң, дыбыс қайта айтылады.' : 'Логопед дыбысты айтады — экранда әріп шығады'), letterBtn(x)); speak(sndKey(x), 350);
        choices(st, [
          { label: '👏 Белгі беру', ok: x === target, cls: 'primary' },
          { label: 'Өткізіп жіберу →', ok: x !== target },
        ], next);
      }, done);
    },
    ab(host, lv, s, done) {
      rounds(host, lv.seq, (x, st, next) => {
        st.append(el('p.hint', {}, 'Қай дыбыс айтылды? Әріпті бассаң, дыбыс қайта айтылады.'), letterBtn(x)); speak(sndKey(x), 350);
        choices(st, lv.opts.map((o) => ({ label: o, ok: o === x, cls: 'letter' })), next);
      }, done);
    },
    yesno(host, lv, s, done) {
      rounds(host, shuffle(lv.w), (w, st, next) => {
        const card = wordCard(w);
        st.append(el('p.hint', {}, `Бұл сөзде ${s.L} дыбысы бар ма?`), card, listenBtn(w)); speak(w, 350);
        choices(st, [
          { label: '✓ Бар', ok: has(w, s.L), cls: 'yes' },
          { label: '✕ Жоқ', ok: !has(w, s.L), cls: 'no' },
        ], next, { onOk: () => card.replaceWith(wordCard(w, s.L)) });
      }, done);
    },
    find(host, lv, s, done) {
      rounds(host, lv.w, (w, st, next) => {
        st.append(el('p.hint', {}, `Сөзді айт та, ${s.L} дыбысы тұрған әріпті бас`));
        const row = el('div.tiles');
        [...w].forEach((c) => {
          const b = el('button.tile', { type: 'button' }, c);
          b._ok = c.toLowerCase() === s.L.toLowerCase();
          b.addEventListener('click', () => {
            if (row.classList.contains('locked')) return;
            if (!b._ok) return shake(b);
            row.classList.add('locked'); sfx.ok();
            row.querySelectorAll('.tile').forEach((t) => t._ok && t.classList.add('ok'));
            next();
          });
          row.append(b);
        });
        st.append(row, listenBtn(w)); speak(w, 350);
      }, done);
    },
    pos(host, lv, s, done) {
      const P = [['start', 'Басында'], ['mid', 'Ортасында'], ['end', 'Соңында']];
      rounds(host, lv.w, (w, st, next) => {
        const set = new Set();
        [...w.toLowerCase()].forEach((c, i, a) => { if (c === s.L.toLowerCase()) set.add(i === 0 ? 'start' : i === a.length - 1 ? 'end' : 'mid'); });
        const card = wordCard(w);
        st.append(el('p.hint', {}, `${s.L} дыбысы сөздің қай жерінде?`), card, listenBtn(w)); speak(w, 350);
        choices(st, P.map(([k, label]) => ({ label, ok: set.has(k) })), next, { onOk: () => card.replaceWith(wordCard(w, s.L)) });
      }, done);
    },
    pair(host, lv, s, done) {
      rounds(host, lv.p, (p, st, next) => {
        st.append(el('p.hint', {}, `Қай сөзде ${s.L} дыбысы бар?`));
        choices(st, shuffle(p).map((w) => ({ label: w, ok: has(w, s.L), cls: 'word' })), next);
      }, done);
    },
    sort(host, lv, s, done) {
      const items = shuffle([...lv.wa.map((w) => [w, 'a']), ...lv.wb.map((w) => [w, 'b'])]);
      const bins = { a: el('div.bin-list'), b: el('div.bin-list') };
      rounds(host, items, ([w, g], st, next) => {
        st.append(el('p.hint', {}, 'Сөзді тыңдап, дұрыс себетке сал'), wordCard(w), listenBtn(w)); speak(w, 350);
        choices(st, [{ label: lv.a, ok: g === 'a', cls: 'letter' }, { label: lv.b, ok: g === 'b', cls: 'letter' }], next, {
          onOk: () => bins[g].append(el('span.chip.pop', {}, w)),
        });
      }, done);
      host.append(el('div.bins', {}, el('div.bin', {}, el('strong', {}, lv.a), bins.a), el('div.bin', {}, el('strong', {}, lv.b), bins.b)));
    },
    say(host, lv, s, done) {
      host.append(el('p.hint', {}, 'Буынды бас — дыбысы шығады. Тыңдап алып, өзің анық қайтала.'));
      const grid = el('div.saygrid');
      let left = lv.w.length;
      lv.w.forEach((w, i) => {
        const b = el('button.saycard', { type: 'button', style: `--d:${i * 70}ms` }, w);
        b._ok = true;
        b.addEventListener('click', () => {
          if (!playNow(w)) sfx.ok();
          if (b.classList.contains('ok')) return;
          b.classList.add('ok');
          if (--left === 0) later(done, 1200);
        });
        grid.append(b);
      });
      host.append(grid);
    },
    missing(host, lv, s, done) {
      const pool = ['р', 'л', 'й', 'у', 'м', 'н', 'ң', 'с', 'т', 'к'].filter((c) => c !== s.L.toLowerCase());
      rounds(host, lv.w, (w, st, next) => {
        const word = el('div.wordcard.gap', { html: w.replace('_', '<i class="blank">_</i>') });
        st.append(el('p.hint', {}, 'Қай әріп түсіп қалды? Тауып, сөзді толық айт.'), word);
        const opts = shuffle([s.L.toLowerCase(), ...shuffle(pool).slice(0, 3)]);
        choices(st, opts.map((c) => ({ label: c, ok: c === s.L.toLowerCase(), cls: 'letter' })), next, {
          onOk: () => { const b = word.querySelector('.blank'); b.textContent = s.L.toLowerCase(); b.classList.add('filled'); speak(w.replace('_', s.L), 300); },
        });
      }, done);
    },
  };

  /* ---------- арнайы ойындар ---------- */
  function gameRocket(host, s, done) {
    let step = 0;
    const rocket = el('div.rocket', {}, el('span', {}, '🚀'));
    const sky = el('div.sky', {}, el('div.stars'), el('div.planet', {}, '🪐'), el('div.track'), rocket, el('div.ground'));
    const txt = el('p.rocket-step'), stepListen = el('div.step-listen');
    const btn = el('button.btn.gold', { type: 'button' }, 'Дұрыс айтылды ✓');
    btn._ok = true;
    const draw = () => {
      rocket.style.setProperty('--h', step / 3);
      sky.dataset.step = step;
      txt.innerHTML = step < 3 ? `<b>${ROMAN[step]} деңгей.</b> ${s.rocket[step]}` : 'Зымыран ғарышқа жетті!';
      stepListen.innerHTML = '';
      if (step < 3) { const b = listenBtn(s.rocket[step], 'Тапсырманы тыңдау'); if (b) stepListen.append(b); speak(s.rocket[step], 300); }
    };
    btn.addEventListener('click', () => {
      if (step >= 3) return;
      step++; sfx.ok(); draw();
      if (step === 3) { btn.disabled = true; later(done, 1400); }
    });
    host.append(el('div.rocket-wrap', {}, sky, el('div.rocket-side', {}, letterBtn(s.L, '.sm'), txt, stepListen,
      recorder('Қанекей, сен айтып көр'), btn,
      el('p.hint', {}, 'Әріпті басып дыбысты тыңда. Өзің айтып көр, дұрыс айтылған сайын батырманы бас — зымыран жоғары көтеріледі.'))));
    draw();
  }

  function gameBox(host, s, done) {
    rounds(host, s.box, ([w, e], st, next) => {
      const box = el('button.magicbox', { type: 'button', 'aria-label': 'Қорапты ашу' },
        el('span.lid'), el('span.body', {}, '✦'), el('span.prize', {}, e));
      box._ok = true;
      const name = el('div.wordcard.hidden', { html: wordCard(w, s.L).innerHTML });
      const ok = el('button.btn.gold.hidden', { type: 'button' }, 'Айттым ✓');
      ok._ok = true;
      const extra = el('div.say-tools.hidden', {}, listenBtn(w), recorder('Қанекей, сен айтып көр'));
      box.addEventListener('click', () => {
        if (box.classList.contains('open')) return;
        box.classList.add('open'); sfx.ok(); speak(w, 400);
        name.classList.remove('hidden'); extra.classList.remove('hidden'); ok.classList.remove('hidden');
      });
      ok.addEventListener('click', () => { ok.disabled = true; next(); });
      st.append(el('p.hint', {}, `Қорапты аш. Суретті атап, ${s.L} дыбысын дұрыс айт.`), box, name, extra, ok);
    }, done);
  }

  function gameChain(host, s, done) {
    rounds(host, s.chain, ([answer, scr], st, next) => {
      const target = answer.toLowerCase();
      let words = scr.split(/,\s*/);
      for (let k = 0; k < 6 && words.join(' ').toLowerCase() === target; k++) words = shuffle(words);
      const line = el('div.chain-line'), bank = el('div.chain-bank');
      const check = () => {
        const placed = [...line.children].map((c) => c.textContent);
        if (placed.length < words.length) return;
        if (placed.join(' ').toLowerCase() === target) {
          line.classList.add('ok'); line.innerHTML = ''; line.append(el('span.sentence', {}, answer + '.'), listenBtn(answer)); speak(answer, 700);
          sfx.ok(); next();
        } else {
          shake(line);
          later(() => { [...line.children].forEach((c) => bank.append(c)); }, 500);
        }
      };
      const order = answer.split(' ');
      words.forEach((w) => {
        const c = el('button.chip.lg', { type: 'button' }, w);
        c._w = w.toLowerCase();
        c.addEventListener('click', () => {
          if (line.classList.contains('ok')) return;
          playNow(w);
          (c.parentNode === bank ? line : bank).append(c); check();
        });
        bank.append(c);
      });
      st._solve = () => order.forEach((w) => [...bank.children].find((c) => c._w === w.toLowerCase())?.click());
      st.append(el('p.hint', {}, 'Сөздерді басып тыңда да, дұрыс ретпен қойып сөйлем құра. Сосын сөйлемді анық айт.'), line, bank);
    }, done);
  }

  function gameErr(host, s, done) {
    rounds(host, s.err, ([good, bad], st, next) => {
      st.append(el('p.hint', {}, 'Логопед сөзді дұрыс немесе қате айтады. Дұрыс айтылған сөзді тап.'));
      choices(st, shuffle([{ label: good, ok: true, cls: 'word' }, { label: bad, ok: false, cls: 'word' }]), next, {
        manual: (go) => {
          const b = el('button.btn.gold', { type: 'button' }, 'Келесі →');
          b._ok = true;
          b.addEventListener('click', () => { b.disabled = true; go(); });
          speak(good, 300);
          st.append(el('p.task.pop', { html: `Дұрыс! Енді <b>«${good}»</b> сөзін қайталап, осы сөзбен сөйлем құра.` }), listenBtn(good), b);
        },
      });
    }, done);
  }

  function gameStory(host, s, done) {
    const st = s.story; let n = 0;
    const count = el('div.story-count'), dots = el('div.story-dots');
    const btn = el('button.btn.line', { type: 'button' }, '+ Сөйлем айтылды (микрофонсыз)');
    btn._ok = true;
    const draw = () => {
      count.innerHTML = `<b>${n}</b> / 5–7 сөйлем`;
      dots.innerHTML = Array.from({ length: 7 }, (_, i) => `<i class="${i < n ? 'on' : ''}${i === 4 ? ' goal' : ''}"></i>`).join('');
    };
    const add = () => {
      if (n >= 7) return;
      n++; sfx.ok(); draw();
      if (n === 5) done();
      if (n === 7) btn.disabled = true;
    };
    btn.addEventListener('click', add);
    // Кез келген айтылған сөйлем есепке алынады
    const rec = recorder('Сөйлем айту', (ok) => { if (ok) add(); }, 15000);
    host.append(
      el('div.story-head', {}, el('span.eyebrow', {}, 'Тақырып'), el('h3', {}, `«${st.t}»`)),
      el('div.story-pics', {}, st.e.map((e, i) => el('div.pic', { style: `--d:${i * 90}ms` }, e))),
      el('p.hint', {}, 'Суреттер бойынша 5–7 сөйлемнен тұратын әңгіме құрастыр. «Сөйлем айту» батырмасын басып, сөйлеміңді айт — кез келген сөйлем есептеледі.'),
      el('div.story-words', {}, st.w.map((w) => {
        const c = el('button.chip.lg', { type: 'button' }, w);
        c.addEventListener('click', () => c.classList.toggle('used'));
        return c;
      })),
      el('div.story-ctrl', {}, count, dots, rec, btn));
    draw();
  }

  /* --- артикуляция --- */
  function gameArtic(host, ex, done, videos) {
    const steps = el('ol.steps', {}, ex.s.map((t) => el('li', {}, t)));
    const ctrl = el('div.artic-ctrl');
    if (ex.hold) {
      const ring = el('div.ring', { style: '--p:0' }, el('span', {}, String(ex.hold)));
      const btn = el('button.btn.gold', { type: 'button' }, 'Бастау');
      btn._ok = true;
      btn.addEventListener('click', () => {
        btn.disabled = true; btn.textContent = 'Ұстап тұр…';
        const total = T(ex.hold * 1000), t0 = performance.now();
        let raf;
        const tick = (now) => {
          const p = Math.min(1, (now - t0) / total);
          ring.style.setProperty('--p', p);
          ring.firstChild.textContent = p >= 1 ? '✓' : String(Math.ceil(ex.hold * (1 - p)));
          if (p < 1) raf = requestAnimationFrame(tick); else { ring.classList.add('ok'); sfx.ok(); btn.textContent = 'Жарайсың!'; done(); }
        };
        raf = requestAnimationFrame(tick);
        onCleanup(() => cancelAnimationFrame(raf));
      });
      ctrl.append(ring, btn);
    } else {
      let n = 0;
      const ring = el('div.ring', { style: '--p:0' }, el('span', {}, `0/${ex.reps}`));
      const btn = el('button.btn.gold', { type: 'button' }, 'Орындадым +1');
      btn._ok = true;
      btn.addEventListener('click', () => {
        if (n >= ex.reps) return;
        n++; sfx.ok();
        ring.style.setProperty('--p', n / ex.reps);
        ring.firstChild.textContent = n >= ex.reps ? '✓' : `${n}/${ex.reps}`;
        if (n >= ex.reps) { ring.classList.add('ok'); btn.disabled = true; btn.textContent = 'Жарайсың!'; done(); }
      });
      ctrl.append(ring, btn);
    }
    host.append(el('div.artic', {}, el('div.artic-face', {}, el('div.mouth' + (ex.hold ? '.hold' : '.reps'))), el('div', {}, steps), ctrl));
    if (videos && videos.length) host.append(el('div.videos', {}, videos.map(videoCard)));
  }

  /* --- тыныс ойындары --- */
  function blowControl(host, onFrame) {
    const st = { on: false, mic: false, level: 0 };
    const btn = el('button.btn.gold.blow', { type: 'button' }, '💨 Үрле (басып тұр)');
    const mic = el('button.btn.ghost', { type: 'button' }, '🎙 Микрофонмен үрлеу');
    const set = (v) => { st.on = v; btn.classList.toggle('active', v); };
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); set(true); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => btn.addEventListener(ev, () => set(false)));
    const kd = (e) => { if (e.code === 'Space') { e.preventDefault(); set(true); } };
    const ku = (e) => { if (e.code === 'Space') set(false); };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    let stream, an, buf, ctx;
    mic.addEventListener('click', async () => {
      if (st.mic) return;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        an = ctx.createAnalyser(); an.fftSize = 1024; buf = new Uint8Array(an.fftSize);
        ctx.createMediaStreamSource(stream).connect(an);
        st.mic = true; mic.textContent = '🎙 Микрофон қосулы — үрле!'; mic.classList.add('on');
      } catch (e) { mic.textContent = 'Микрофон қолжетімсіз — батырманы қолдан'; mic.disabled = true; }
    });
    let raf, last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000) * (FAST ? 12 : 1); last = now;
      let micOn = false;
      if (st.mic) {
        an.getByteTimeDomainData(buf);
        let sum = 0; for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
        micOn = Math.sqrt(sum / buf.length) > 0.09;
      }
      onFrame(st.on || micOn, dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    onCleanup(() => {
      cancelAnimationFrame(raf); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku);
      if (stream) stream.getTracks().forEach((t) => t.stop()); if (ctx) ctx.close();
    });
    host.append(el('div.blow-ctrl', {}, btn, mic));
    return { stop: () => cancelAnimationFrame(raf), btn };
  }

  function gameFlower(host, s, done) {
    const CYCLES = 4; let n = 0, busy = false;
    const flower = el('div.flower', { style: '--open:0' },
      Array.from({ length: 8 }, (_, i) => el('i.petal', { style: `--a:${i * 45}deg` })), el('i.core'));
    const breath = el('div.breath', {}, el('span', {}, 'Дайынсың ба?'));
    const btn = el('button.btn.gold', { type: 'button' }, 'Дем алуды бастау');
    btn._ok = true;
    const say = (t, cls) => { breath.className = 'breath ' + cls; breath.firstChild.textContent = t; };
    btn.addEventListener('click', () => {
      if (busy || n >= CYCLES) return;
      busy = true; btn.disabled = true;
      say('Мұрныңмен дем ал…', 'in');
      later(() => {
        say('Аузыңмен баяу дем шығар…', 'out');
        later(() => {
          n++; flower.style.setProperty('--open', n / CYCLES); sfx.ok(); busy = false;
          if (n >= CYCLES) { say('Гүл ашылды!', 'done'); btn.textContent = 'Жарайсың!'; later(done, 900); }
          else { say(`Тамаша! Тағы ${CYCLES - n} рет`, ''); btn.disabled = false; btn.textContent = 'Тағы дем алу'; }
        }, 4000);
      }, 3000);
    });
    host.append(el('div.flower-wrap', {}, el('div.flower-stage', {}, flower, el('i.stem')), el('div.flower-side', {}, breath, btn,
      el('ol.steps', {}, ['Экранда жабық гүл тұр.', 'Гүлді иіскегендей мұрныңмен дем ал.', 'Аузың арқылы баяу дем шығар.', 'Дұрыс орындаған сайын гүл ашылады.'].map((t) => el('li', {}, t))))));
  }

  function gameFeather(host, s, done) {
    let x = 0, fin = false, bob = 0;
    const item = el('div.feather' + (s.fluff ? '.fluff' : ''), {}, s.fluff ? '' : '🪶');
    const lane = el('div.lane.air', {}, el('div.cloud.c1'), el('div.cloud.c2'), item, el('div.finish', {}, '🏁'));
    host.append(el('p.hint', {}, s.fluff ? 'Экран бетіндегі жеңіл мамықты аузыңмен үрлеп қозғалт.' : 'Экран бетіндегі қауырсынды аузыңмен үрлеп қозғалт.'), lane);
    const ctl = blowControl(host, (on, dt) => {
      if (fin) return;
      x = Math.max(0, Math.min(1, x + (on ? 0.26 : -0.05) * dt)); bob += dt * (on ? 9 : 3);
      item.style.setProperty('--x', x); item.style.setProperty('--y', Math.sin(bob) * (on ? 14 : 6) + 'px');
      item.style.setProperty('--r', Math.sin(bob * 0.7) * (on ? 24 : 8) + 'deg');
      if (x >= 1) { fin = true; ctl.stop(); sfx.ok(); done(); }
    });
  }

  function gameBoat(host, s, done) {
    const LEVELS = [[['🪨', 0.5]]];
    let lvl = 0, x = 0, fin = false, stuck = -1, wasOn = false, bob = 0, obs = [];
    const boat = el('div.boat', {}, '⛵');
    const river = el('div.lane.river', {}, el('div.waves'), boat, el('div.finish', {}, '🏝️'));
    const info = el('p.hint');
    const setup = () => {
      x = 0; stuck = -1;
      river.querySelectorAll('.obs').forEach((o) => o.remove());
      obs = LEVELS[lvl].map(([e, p]) => { const o = el('div.obs', { style: `--x:${p}` }, e); river.append(o); return { p, passed: false, el: o }; });
      info.textContent = 'Қайықты үрлеп, өзеннің арғы бетіне жеткіз. Кедергіге тірелсең — қайта дем алып, тағы үрле.';
    };
    host.append(info, river);
    setup();
    const ctl = blowControl(host, (on, dt) => {
      if (fin) return;
      bob += dt * 4;
      if (stuck >= 0) {
        if (on && !wasOn) { obs[stuck].passed = true; obs[stuck].el.classList.add('passed'); stuck = -1; }
      } else if (on) {
        x += 0.2 * dt;
        const hit = obs.findIndex((o) => !o.passed && x >= o.p - 0.07);
        if (hit >= 0) { x = obs[hit].p - 0.07; stuck = hit; boat.classList.remove('bump'); void boat.offsetWidth; boat.classList.add('bump'); }
      }
      wasOn = on;
      boat.style.setProperty('--x', Math.min(1, x)); boat.style.setProperty('--r', Math.sin(bob) * 5 + 'deg');
      if (x >= 1) {
        sfx.ok();
        if (lvl < LEVELS.length - 1) { lvl++; setup(); } else { fin = true; ctl.stop(); done(); }
      }
    });
  }

  /* ---------- бөлім → қойындылар ---------- */
  function tabsFor(s, id) {
    const lvTabs = (levels) => levels.map((lv, i) => ({ label: `${ROMAN[i]} деңгей`, desc: lv.d, run: (h, d) => MODES[lv.m](h, lv, s, d) }));
    switch (id) {
      case '1.1': return [
        { label: 'Гүлді оят', desc: 'Суретті таңдау және тыныс алу ойыны.', narr: 'Экранда жабық гүл тұр. Гүлді иіскегендей мұрныңмен дем ал. Кейін аузың арқылы баяу дем шығар. Дұрыс орындаған сайын гүл ашылады.', run: (h, d) => gameFlower(h, s, d) },
        { label: s.feather, desc: 'Ауамен үрлеу ойыны.', narr: s.fluff ? 'Экран бетінде жеңіл мамық тұр. Оны аузыңмен үрлеп қозғалт.' : 'Экран бетінде қауырсын тұр. Оны аузыңмен үрлеп қозғалт.', run: (h, d) => gameFeather(h, s, d) },
        { label: 'Қайықты жүзіп өт', desc: 'Онлайн саяхат ойыны. Жолда бір кедергі кездеседі.', narr: 'Экранда өзен мен қағаз қайық тұр. Қайықты үрлеп, өзеннің арғы бетіне жеткіз. Кедергіге тірелсең, қайта дем алып, тағы үрле.', run: (h, d) => gameBoat(h, s, d) },
      ];
      case '1.2': return s.artic.map((ex) => ({ label: ex.t, desc: 'Артикуляциялық жаттығу. Айнаға қарап орында.', narr: `${ex.t}. ${ex.s.join(' ')}`, run: (h, d) => gameArtic(h, ex, d, ex.v ? [ex.v] : s.articV) }));
      case '1.3': return lvTabs(s.listen.lv);
      case '2.1': return [{ label: 'Ұшыру', desc: 'Экранда зымыран және жоғары қарай созылған жол бейнеленеді. Дыбысты дұрыс айту арқылы зымыранды жоғары көтер.', run: (h, d) => gameRocket(h, s, d) }];
      case '2.2': return lvTabs(s.where.lv);
      case '2.3': return lvTabs(s.syl.map((w) => ({ m: 'say', w, d: 'Экранда буындар мен дыбыс тіркестері пайда болады. Логопедтің үлгісі бойынша анық және дұрыс қайтала.' })));
      case '3.1': return [{ label: 'Қорап', desc: 'Сиқырлы қораптың ішінен суреттер шығады. Суретті атап, берілген дыбысты дұрыс айт.', run: (h, d) => gameBox(h, s, d) }];
      case '3.2': return lvTabs(s.miss.map((w) => ({ m: 'missing', w, d: 'Экранда кейбір әріптері түсіп қалған сөздер көрсетіледі. Тиісті әріпті тауып, сөзді толық айт.' })));
      case '3.3': return [{ label: 'Тізбек', desc: `${s.L} дыбысы кездесетін сөздерді пайдаланып, ретсіз берілген сөздерден дұрыс сөйлем құрастыр.`, run: (h, d) => gameChain(h, s, d) }];
      case '4.1': return lvTabs(s.diff);
      case '4.2': return [{ label: 'Қатені тап', desc: 'Қате айтылған сөзді түзеп, дұрыс нұсқасын қайтала және сол сөзбен сөйлем құра.', run: (h, d) => gameErr(h, s, d) }];
      case '4.3': return [{ label: 'Әңгіме', desc: 'Оқиға бейнеленген бірнеше сурет беріледі. Сол суреттер бойынша толық әңгіме құрастыр.', run: (h, d) => gameStory(h, s, d) }];
    }
    return [];
  }

  // Дауыстауға қажет барлық мәтін (жазбаларды дайындау құралы үшін)
  window.PC.collect = () => {
    const out = { narr: new Set(), words: new Set(), syl: new Set(), sent: new Set(), letters: new Set() };
    const low = (w) => w.toLowerCase();
    SOUNDS.forEach((s) => {
      SECTIONS.forEach((sec) => tabsFor(s, sec.id).forEach((t) => out.narr.add(t.narr || t.desc)));
      s.rocket.forEach((t) => out.narr.add(t));
      [...s.listen.lv, ...s.where.lv, ...s.diff].forEach((l) => {
        [...(l.w || []), ...(l.wa || []), ...(l.wb || []), ...(l.p || []).flat()].forEach((w) => out.words.add(low(w)));
        [...(l.seq || []), ...(l.opts || [])].forEach((x) => out.letters.add(x));
      });
      out.letters.add(s.L);
      s.box.forEach(([w]) => out.words.add(low(w)));
      s.miss.flat().forEach((w) => out.words.add(low(w.replace('_', s.L))));
      s.err.forEach(([w]) => out.words.add(low(w)));
      s.syl.flat().forEach((w) => out.syl.add(low(w)));
      s.chain.forEach(([a, scr]) => { out.sent.add(a); scr.split(/,\s*/).forEach((w) => out.words.add(low(w))); });
    });
    const o = {}; for (const k in out) o[k] = [...out[k]]; return o;
  };

  /* ---------- ортақ бөліктер ---------- */
  const logo = () => el('a.logo', { href: '#home' }, el('span.mark', {}, 'P'), el('span', { html: 'Premium <em>Clinic</em>' }));

  function nav(crumbs) {
    return el('header.nav', {}, el('div.wrap', {},
      logo(),
      crumbs
        ? el('nav.crumbs', {}, crumbs.map(([t, href]) => (href ? el('a', { href }, t) : el('span', {}, t))))
        : el('nav.links', {}, el('a', { href: '#sounds' , 'data-scroll': 'sounds' }, 'Дыбыстар'), el('a', { href: '#stages', 'data-scroll': 'stages' }, 'Кезеңдер'), el('a', { href: '#trust', 'data-scroll': 'trust' }, 'Артықшылықтар')),
      el('a.btn.gold.sm', { href: crumbs ? '#home' : '#sounds', 'data-scroll': crumbs ? null : 'sounds' }, crumbs ? 'Басты бет' : 'Сабақты бастау')));
  }

  const footer = () => el('footer.footer', {}, el('div.wrap', {}, logo(),
    el('p', {}, 'Р · Л · Й · У · М · Н · Ң дыбыстарын түзетуге арналған логопедиялық ойын бағдарламасы.'),
    el('p.small', {}, 'Жаттығуларды логопедтің немесе ата-ананың қатысуымен орындаған жөн. Прогресс осы құрылғыда сақталады.')));

  // Фото болса — қояды, болмаса сәнді градиент қалады
  function photo(name, cls, inner) {
    const p = el('div.photo.' + cls, {}, el('div.photo-art', {}, el('i'), el('i'), el('i')), inner);
    const img = new Image();
    const src = (window.PC_IMG && window.PC_IMG[name]) || new URL(`images/${name}`, document.baseURI).href;
    img.onload = () => { p.style.setProperty('--img', `url("${src}")`); p.classList.add('has-img'); };
    img.src = src;
    return p;
  }

  function confetti(host) {
    const c = el('div.confetti');
    for (let i = 0; i < 36; i++) c.append(el('i', { style: `--x:${Math.random() * 100}%;--d:${Math.random() * 0.6}s;--r:${Math.random() * 720 - 360}deg;--c:${['#c8a466', '#e9d7ae', '#2f8f83', '#fff', '#f0b9a0'][i % 5]}` }));
    host.append(c);
    setTimeout(() => c.remove(), 2600);
  }

  /* ---------- беттер ---------- */
  function pageHome() {
    const totalGames = SOUNDS.length * SECTIONS.length;
    const hero = el('section.hero', {},
      photo('hero.jpg', 'hero-photo', el('div.float-letters', {}, SOUNDS.map((s, i) => el('span', { style: `--i:${i}` }, s.L)))),
      el('div.wrap.hero-in', {},
        el('span.eyebrow.reveal', {}, 'Балаларға арналған логопедиялық орталық'),
        el('h1.reveal', { html: 'Әр дыбыс — <em>анық</em>,<br>әр сөз — сенімді' }),
        el('p.lead.reveal', {}, 'Р, Л, Й, У, М, Н, Ң дыбыстарын ойын арқылы кезең-кезеңімен қоятын бағдарлама: тыныс алудан бастап байланыстырып сөйлеуге дейін.'),
        el('div.hero-cta.reveal', {},
          el('a.btn.gold.lg', { href: '#sounds', 'data-scroll': 'sounds' }, 'Дыбысты таңдау'),
          el('a.btn.line.lg', { href: '#stages', 'data-scroll': 'stages' }, 'Бағдарлама қалай құрылған?')),
        el('dl.stats.reveal', {},
          [[SOUNDS.length, 'дыбыс'], [STAGES.length, 'кезең'], [totalGames, 'ойын бөлімі']].map(([n, t]) => el('div', {}, el('dt', { 'data-count': n }, '0'), el('dd', {}, t))))),
      el('a.scroll-cue', { href: '#sounds', 'data-scroll': 'sounds', 'aria-label': 'Төмен' }, el('i')));

    const sounds = el('section.section#sounds', {}, el('div.wrap', {},
      el('div.sec-head.reveal', {}, el('span.eyebrow', {}, 'Бірінші қадам'), el('h2', {}, 'Дыбысты таңдаңыз'),
        el('p', {}, 'Әріпті басыңыз — сол дыбыс бойынша төрт кезең ашылады.')),
      el('div.letters', {}, SOUNDS.map((s, i) => {
        const pct = soundPct(s);
        return el('a.letter-card.reveal', { href: `#s-${s.id}`, style: `--d:${i * 70}ms;--p:${pct}`, 'data-sound': s.id },
          el('span.glyph', {}, s.L), el('span.lc-word', {}, s.word),
          el('span.lc-meta', {}, el('i.bar', {}, el('b')), el('em', {}, pct ? `${pct}%` : 'Бастау →')));
      }))));

    const imgs = ['stage-1.jpg', 'stage-2.jpg', 'stage-3.jpg', 'stage-4.jpg'];
    const stages = el('section.section.dark#stages', {}, el('div.wrap', {},
      el('div.sec-head.reveal', {}, el('span.eyebrow', {}, 'Бағдарлама құрылымы'), el('h2', {}, 'Төрт кезең — бір сенімді жол'),
        el('p', {}, 'Әр дыбыс бірдей дәйекті жолмен өтеді. Алдыңғы ойын аяқталғанда келесісі ашылады.')),
      el('div.stage-rows', {}, STAGES.map((st, i) => el('article.stage-row.reveal', {},
        photo(imgs[i], 'stage-photo', el('span.stage-num', {}, '0' + st.n)),
        el('div.stage-text', {}, el('span.eyebrow', {}, `${st.n}-кезең`), el('h3', {}, st.t), el('p', {}, st.d),
          el('ul.stage-games', {}, SECTIONS.filter((x) => x.stage === st.n).map((x) =>
            el('li', {}, el('span', {}, x.id), x.id === '2.2' ? 'Дыбыс қай жерде жасырынды?' : x.t)))))))));

    const trust = el('section.section#trust', {}, el('div.wrap', {},
      el('div.sec-head.reveal', {}, el('span.eyebrow', {}, 'Неге сенуге болады'), el('h2', {}, 'Сабырлы, жүйелі, балаға түсінікті')),
      el('div.features', {}, [
        ['◈', 'Кезең-кезеңімен', 'Дайындық → дыбыс қою → автоматизациялау → дифференциациялау. Ешбір қадам аттап өтілмейді.'],
        ['❋', 'Ойын арқылы', 'Гүлді ояту, зымыран ұшыру, сиқырлы қорап — бала жаттығуды ойын ретінде қабылдайды.'],
        ['◎', 'Үш деңгейлі күрделілік', 'Тапсырмалар жеңілден күрделіге қарай өседі, сондықтан бала әр жетістігін сезінеді.'],
        ['✓', 'Көрінетін прогресс', 'Аяқталған ойындар белгіленіп, нәтиже осы құрылғыда сақталады. Келесі сабақты тоқтаған жерден жалғастырасыз.'],
      ].map(([i, t, d], k) => el('article.feature.reveal', { style: `--d:${k * 80}ms` }, el('span.f-icon', {}, i), el('h3', {}, t), el('p', {}, d))))));

    const band = el('section.band', {}, photo('band.jpg', 'band-photo'),
      el('div.wrap.reveal', {}, el('h2', { html: 'Бүгін бір дыбыс —<br><em>ертең еркін сөйлеу</em>' }),
        el('a.btn.gold.lg', { href: '#sounds', 'data-scroll': 'sounds' }, 'Сабақты бастау')));

    return [nav(), el('main', {}, hero, sounds, stages, trust, band), footer()];
  }

  function pageSound(s) {
    const pct = soundPct(s);
    const head = el('section.sound-hero', {}, el('div.wrap', {},
      el('div.sh-letter', {}, el('span', {}, s.L)),
      el('div.sh-text', {},
        el('span.eyebrow', {}, 'Дыбыс бойынша бағдарлама'),
        el('h1', { html: `<em>${s.L}</em> дыбысы` }),
        el('p.lead', {}, 'Төрт кезең, он екі ойын бөлімі. Ойындар ретімен ашылады.'),
        el('div.sh-progress', {}, el('i.bar', { style: `--p:${pct}` }, el('b')), el('span', {}, `${pct}% аяқталды`)),
        el('div.sound-switch', {}, SOUNDS.map((x) => el('a' + (x.id === s.id ? '.on' : ''), { href: `#s-${x.id}` }, x.L))))));

    const body = el('section.section', {}, el('div.wrap', {},
      STAGES.map((st) => el('div.stage-block.reveal', {},
        el('header', {}, el('span.stage-badge', {}, st.n), el('div', {}, el('h2', {}, st.t), el('p', {}, st.d))),
        el('div.sec-cards', {}, SECTIONS.map((sec, idx) => {
          if (sec.stage !== st.n) return null;
          const done = secDone(s, sec.id), open = secOpen(s, idx);
          const tabs = tabsFor(s, sec.id), dn = tabs.filter((_, i) => tabDone(s, sec.id, i)).length;
          return el(open ? 'a.sec-card' : 'div.sec-card.locked', { href: open ? `#s-${s.id}-${sec.id.replace('.', '-')}` : null, 'data-sec': sec.id, 'data-state': done ? 'done' : open ? 'open' : 'locked' },
            el('span.sc-icon', {}, open ? sec.i : '🔒'),
            el('span.sc-id', {}, sec.id), el('h3', {}, secTitle(s, sec)), el('p', {}, sec.k),
            el('span.sc-foot', {}, done ? '✓ Аяқталды' : open ? (dn ? `${dn}/${tabs.length} орындалды` : 'Ойнау →') : 'Алдыңғы ойыннан кейін ашылады'));
        })))),
      el('label.unlock', {}, (() => {
        const c = el('input', { type: 'checkbox' }); c.checked = unlockAll;
        c.addEventListener('change', () => { unlockAll = c.checked; store.set('pc-unlock', unlockAll); render(); });
        return c;
      })(), el('span', {}, 'Барлық ойынды ашу (логопедке арналған режим)'))));

    return [nav([['Дыбыстар', '#home'], [`${s.L} дыбысы`]]), el('main', {}, head, body), footer()];
  }

  function pageGame(s, sec) {
    const idx = SECTIONS.indexOf(sec), tabs = tabsFor(s, sec.id), st = STAGES[sec.stage - 1];
    const nextSec = SECTIONS[idx + 1];
    let cur = Math.max(0, tabs.findIndex((_, i) => !tabDone(s, sec.id, i)));
    const tabbar = el('div.tabs', { role: 'tablist' }), desc = el('p.game-desc'), stage = el('div.game-stage');
    const board = el('div.board', {}, tabbar, desc, stage);

    const finish = () => {
      stage.innerHTML = '';
      sfx.win(); confetti(board);
      stage.append(el('div.win.pop', {}, el('span.win-ic', {}, '★'), el('h2', {}, 'Керемет! Ойын аяқталды'),
        el('p', {}, nextSec ? `Келесі ойын ашылды: ${nextSec.id} «${secTitle(s, nextSec)}»` : `${s.L} дыбысы бойынша бағдарлама толық аяқталды!`),
        el('div.win-cta', {},
          nextSec ? el('a.btn.gold.lg', { href: `#s-${s.id}-${nextSec.id.replace('.', '-')}` }, 'Келесі ойын →') : el('a.btn.gold.lg', { href: '#home' }, 'Басқа дыбысты таңдау'),
          el('a.btn.line.lg', { href: `#s-${s.id}` }, 'Кезеңдерге оралу'))));
    };
    const show = (i) => {
      cleanup(); cur = i;
      tabbar.innerHTML = '';
      if (tabs.length > 1) tabs.forEach((t, k) => tabbar.append(el('button.tab' + (k === i ? '.on' : '') + (tabDone(s, sec.id, k) ? '.done' : ''),
        { type: 'button', role: 'tab', onclick: () => show(k) }, el('i', {}, tabDone(s, sec.id, k) ? '✓' : String(k + 1)), t.label)));
      const say = tabs[i].narr || tabs[i].desc;
      desc.innerHTML = '';
      desc.append(...[el('span', {}, tabs[i].desc), listenBtn(say, 'Түсіндірмені тыңдау')].filter(Boolean));
      speak(say, 400);
      stage.innerHTML = ''; stage.classList.remove('in'); void stage.offsetWidth; stage.classList.add('in');
      tabs[i].run(stage, () => {
        markTab(s, sec.id, i);
        const left = tabs.findIndex((_, k) => !tabDone(s, sec.id, k));
        if (left < 0) return later(finish, 500);
        sfx.win();
        const t = el('div.toast.pop', {}, '★ Жарайсың! Келесі тапсырмаға өтеміз…');
        board.append(t);
        later(() => { t.remove(); show(left); }, 1500);
      });
    };
    show(cur);

    return [nav([['Дыбыстар', '#home'], [`${s.L} дыбысы`, `#s-${s.id}`], [sec.id]]),
      el('main.game', {}, el('div.wrap', {},
        el('header.game-head', {},
          el('div', {}, el('span.eyebrow', {}, `${st.n}-кезең · ${st.t}`), el('h1', {}, el('span.gh-id', {}, sec.id), ` «${secTitle(s, sec)}»`)),
          el('div.gh-letter', {}, s.L)),
        board,
        el('div.game-nav', {},
          idx > 0 ? el('a.btn.line', { href: `#s-${s.id}-${SECTIONS[idx - 1].id.replace('.', '-')}` }, '← Алдыңғы') : el('span'),
          el('a.btn.line', { href: `#s-${s.id}` }, 'Барлық ойын'))))];
  }

  /* ---------- маршрут ---------- */
  function render() {
    cleanup();
    const m = location.hash.match(/^#s-([a-z]+)(?:-(\d)-(\d))?$/);
    const s = m && SOUNDS.find((x) => x.id === m[1]);
    const sec = s && m[2] && SECTIONS.find((x) => x.id === `${m[2]}.${m[3]}`);
    let view;
    if (sec && !secOpen(s, SECTIONS.indexOf(sec))) { location.replace(`#s-${s.id}`); return; }
    if (sec) view = pageGame(s, sec); else if (s) view = pageSound(s); else view = pageHome();
    document.body.dataset.page = sec ? 'game' : s ? 'sound' : 'home';
    document.title = (s ? `${s.L} дыбысы — ` : '') + 'Premium Clinic · Логопедиялық орталық';
    app.innerHTML = ''; app.append(...view);
    app.classList.remove('page-in'); void app.offsetWidth; app.classList.add('page-in');
    observe();
    const anchor = !m && location.hash.match(/^#(sounds|stages|trust)$/);
    if (anchor) document.getElementById(anchor[1])?.scrollIntoView(); else window.scrollTo(0, 0);
  }

  let io;
  function observe() {
    if (io) io.disconnect();
    const els = app.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) return els.forEach((e) => e.classList.add('show'));
    io = new IntersectionObserver((ents) => ents.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('show'); io.unobserve(e.target);
      e.target.querySelectorAll('[data-count]').forEach(countUp);
    }), { threshold: 0.12 });
    els.forEach((e) => io.observe(e));
  }
  function countUp(n) {
    const to = +n.dataset.count, t0 = performance.now(), dur = T(1200);
    (function tick(now) {
      const p = Math.min(1, (now - t0) / dur);
      n.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-scroll]');
    if (!a) return;
    const t = document.getElementById(a.dataset.scroll);
    if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth' }); }
  });
  window.addEventListener('scroll', () => document.body.classList.toggle('scrolled', window.scrollY > 24), { passive: true });
  window.addEventListener('hashchange', (e) => {
    if (/^#(sounds|stages|trust)$/.test(location.hash) && document.body.dataset.page === 'home') return;
    render();
  });
  render();
})();
