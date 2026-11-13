/* Дауысты салыстыру: қазақ тіліне бейімделген "жұмсақ" сәйкестендіру.
   Дауыс тану нәтижесі жиі ә/а, қ/к, ғ/г, ү/у т.б. араластырады, сондықтан әріптерді қалыпқа келтіреміз. */
(function (g) {
  const MAP = { 'ә': 'а', 'ғ': 'г', 'қ': 'к', 'ң': 'н', 'ө': 'о', 'ұ': 'у', 'ү': 'у', 'һ': 'х', 'і': 'и', 'ы': 'и', 'ё': 'е', 'й': 'и', 'э': 'е', 'ъ': '', 'ь': '' };

  function norm(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[әғқңөұүһіыёйэъь]/g, (c) => MAP[c])
      .replace(/[^a-zа-я0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function lev(a, b) {
    const m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[n];
  }

  function sim(a, b) {
    if (!a.length && !b.length) return 1;
    return 1 - lev(a, b) / Math.max(a.length, b.length);
  }

  // Мақсатты сөздердің қаншасы айтылған сөздерде кездеседі (артық сөздер кедергі емес)
  function coverage(tWords, sWords) {
    if (!tWords.length) return 0;
    let sum = 0;
    for (const t of tWords) {
      let b = 0;
      for (const s of sWords) b = Math.max(b, sim(t, s));
      sum += b;
    }
    return sum / tWords.length;
  }

  // texts — дауыс танудың нұсқалары, targets — қабылданатын дұрыс жауаптар
  function bestMatch(texts, targets) {
    let best = 0;
    for (const txt of texts) {
      const n = norm(txt);
      const sw = n.split(' ').filter(Boolean);
      for (const tg of targets) {
        const tn = norm(tg);
        const tw = tn.split(' ').filter(Boolean);
        best = Math.max(best, coverage(tw, sw), sim(n.replace(/ /g, ''), tn.replace(/ /g, '')));
      }
    }
    return best;
  }

  // Түбір (stem) бойынша: айтылған сөздердің басы түбірге сәйкес келе ме
  function stemHit(stem, sWords) {
    const t = norm(stem);
    for (const w of sWords) {
      if (sim(t, w.slice(0, t.length)) >= (t.length <= 2 ? 1 : 0.8)) return true;
    }
    return false;
  }

  function stemScore(texts, stems) {
    let best = 0;
    for (const txt of texts) {
      const sw = norm(txt).split(' ').filter(Boolean);
      const found = stems.filter((s) => stemHit(s, sw)).length;
      best = Math.max(best, found / stems.length);
    }
    return best;
  }

  const api = { norm, lev, sim, bestMatch, stemScore, stemHit };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else g.Match = api;
})(typeof window !== 'undefined' ? window : globalThis);
