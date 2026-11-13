/* Қозғалтқыш: дыбыс, дауыс шығару (TTS), дауыс тану (STT), камера, дем шығаруды анықтау, сақтау */
const Eng = (() => {
  /* ---------- сақтау ---------- */
  const store = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem('sz_' + k)); return v == null ? d : v; } catch { return d; } },
    set(k, v) { try { localStorage.setItem('sz_' + k, JSON.stringify(v)); } catch { /* ignore */ } },
  };
  const settings = Object.assign({ voice: true, sfx: true, name: '' }, store.get('settings', {}));
  const saveSettings = () => store.set('settings', settings);

  /* ---------- "тірі" белгісі: бет ауысқанда ескі асинхронды әрекеттер тоқтайды ---------- */
  let epoch = 0;
  const alive = (e) => e === epoch;
  const sleep = (ms, e) => new Promise((r) => setTimeout(() => r(alive(e)), ms));

  /* ---------- дыбыс эффектілері ---------- */
  let ac;
  const actx = () => {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ac = ac || new C();
    if (ac.state === 'suspended') ac.resume();
    return ac;
  };
  function tone(f, t0, d, type = 'sine', vol = 0.18) {
    const a = actx(); if (!a || !settings.sfx) return;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.value = f;
    const t = a.currentTime + t0;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(a.destination);
    o.start(t); o.stop(t + d + 0.05);
  }
  const sfx = {
    ok() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.28, 'triangle')); },
    bad() { tone(300, 0, 0.18, 'sine', 0.2); tone(230, 0.16, 0.3, 'sine', 0.2); },
    pop() { tone(660, 0, 0.12, 'triangle'); tone(990, 0.05, 0.12, 'triangle'); },
    star() { [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.07, 0.25, 'sine', 0.16)); },
    tick() { tone(880, 0, 0.06, 'square', 0.05); },
    clop() { tone(180, 0, 0.07, 'square', 0.12); tone(140, 0.12, 0.07, 'square', 0.1); },
    choo() { [220, 247, 220, 247].forEach((f, i) => tone(f, i * 0.12, 0.1, 'sawtooth', 0.06)); },
    whoosh() { tone(400, 0, 0.3, 'sine', 0.05); tone(600, 0.1, 0.3, 'sine', 0.04); },
  };

  /* ---------- дауыс шығару (TTS) ---------- */
  let voices = [];
  const loadVoices = () => { try { voices = speechSynthesis.getVoices(); } catch { voices = []; } };
  if ('speechSynthesis' in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
  const pickVoice = () =>
    voices.find((v) => /^kk/i.test(v.lang)) || voices.find((v) => /^ru/i.test(v.lang)) || voices.find((v) => /^tr/i.test(v.lang)) || null;
  const hasKazakhVoice = () => voices.some((v) => /^kk/i.test(v.lang));

  /* дайын аудио (ElevenLabs): audio/manifest.json -> {фраза: файл}. Жоқ болса браузер TTS қолданылады */
  let manifest = {};
  fetch('audio/manifest.json').then((r) => (r.ok ? r.json() : {})).then((m) => { manifest = m || {}; }).catch(() => {});
  let cur = null; // {a, fin}

  function say(text, { rate = 0.85 } = {}) {
    return new Promise((res) => {
      if (!settings.voice) return res();
      stopSpeak();
      const file = manifest[text];
      if (file) {
        const a = new Audio('audio/' + file);
        let done = false;
        const fin = () => { if (!done) { done = true; if (cur && cur.a === a) cur = null; res(); } };
        cur = { a, fin };
        a.onended = fin; a.onerror = () => { fin(); };
        a.play().catch(fin);
        return;
      }
      if (!('speechSynthesis' in window)) return res();
      try {
        const u = new SpeechSynthesisUtterance(text);
        const v = pickVoice();
        if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'kk-KZ';
        u.rate = rate; u.pitch = 1.1;
        let done = false;
        const fin = () => { if (!done) { done = true; res(); } };
        u.onend = fin; u.onerror = fin;
        setTimeout(fin, 2500 + text.length * 140);
        speechSynthesis.speak(u);
      } catch { res(); }
    });
  }
  async function sayAll(arr, e) {
    for (const t of arr) { if (e !== undefined && !alive(e)) return; await say(t); }
  }
  function stopSpeak() {
    if (cur) { const c = cur; cur = null; try { c.a.pause(); } catch { /* ignore */ } c.fin(); }
    try { speechSynthesis.cancel(); } catch { /* ignore */ }
  }

  /* ---------- дауыс тану (STT) ---------- */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const sttSupported = !!SR;
  let curRec = null;

  function listen({ continuous = false, onInterim, onDone }) {
    stopSpeak();
    const r = new SR();
    r.lang = 'kk-KZ'; r.interimResults = true; r.maxAlternatives = 5; r.continuous = continuous;
    const finals = []; let interim = '', err = null, ended = false;
    r.onresult = (e) => {
      interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finals.push([...res].map((a) => a.transcript));
        else interim += res[0].transcript;
      }
      onInterim && onInterim((finals.map((a) => a[0]).join(' ') + ' ' + interim).trim());
    };
    r.onerror = (e) => { err = e.error; };
    r.onend = () => {
      if (ended) return; ended = true; curRec = null;
      if (!finals.length && interim) finals.push([interim]);
      // әр финал үшін нұсқалар + барлығын біріктірілген нұсқа
      const texts = finals.flat();
      if (finals.length > 1) texts.push(finals.map((a) => a[0]).join(' '));
      onDone({ texts, err });
    };
    try { r.start(); curRec = r; } catch (e) { onDone({ texts: [], err: 'start-failed' }); }
    return { stop: () => { try { r.stop(); } catch { /* ignore */ } } };
  }
  const abortListen = () => { try { curRec && curRec.abort(); } catch { /* ignore */ } curRec = null; };

  /* ---------- камера (алдыңғы) ---------- */
  let camStream = null;
  async function startCam(video) {
    stopCam();
    camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 } }, audio: false });
    video.srcObject = camStream;
    video.muted = true; video.playsInline = true;
    await video.play().catch(() => {});
  }
  function stopCam() { if (camStream) { camStream.getTracks().forEach((t) => t.stop()); camStream = null; } }

  /* ---------- дем шығаруды микрофонмен анықтау ---------- */
  let blowStream = null, blowRaf = 0;
  async function startBlow(cb) {
    stopBlow();
    blowStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    const a = actx();
    const src = a.createMediaStreamSource(blowStream);
    const an = a.createAnalyser(); an.fftSize = 1024;
    src.connect(an);
    const buf = new Float32Array(an.fftSize);
    const loop = () => {
      an.getFloatTimeDomainData(buf);
      let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
      cb(Math.sqrt(s / buf.length));
      blowRaf = requestAnimationFrame(loop);
    };
    loop();
  }
  function stopBlow() {
    cancelAnimationFrame(blowRaf);
    if (blowStream) { blowStream.getTracks().forEach((t) => t.stop()); blowStream = null; }
  }

  function stopAll() { epoch++; stopSpeak(); abortListen(); stopCam(); stopBlow(); }

  return { store, settings, saveSettings, sfx, say, sayAll, stopSpeak, sttSupported, listen, abortListen, startCam, stopCam, startBlow, stopBlow, stopAll, hasKazakhVoice, epoch: () => epoch, alive, sleep };
})();
