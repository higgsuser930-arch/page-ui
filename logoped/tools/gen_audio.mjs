// Барлық айтылатын фразаларды ElevenLabs арқылы mp3-ке айналдырады.
// Іске қосу: node tools/gen_audio.mjs   (api.elevenlabs.io-ға қолжетімділік керек; кілт прокси арқылы қойылады)
// Қолданбаның say() шақыруларындағы мәтіндермен дәл сәйкес болуы керек (js/app.js).
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root, 'js/data.js'), 'utf8') + '\n;this.D={SECTIONS,BREATH,ARTIC,NUM_KK,GAMES,PRAISE,RETRY}', ctx);
const { BREATH, ARTIC, NUM_KK, GAMES, PRAISE, RETRY } = ctx.D;

const P = new Set();
const add = (...a) => a.flat().forEach((t) => t && P.add(t));
add(PRAISE, RETRY, 'Сәлем! Мен сенімен бірге сөйлеймін.');
BREATH.forEach((e) => add(e.steps)); add('Мұрныңмен баяу дем ал', 'Енді ауызбен жай шығар');
ARTIC.forEach((e) => add(e.steps)); add('Бастайық! Айнаға қара.', NUM_KK.filter(Boolean));
Object.values(GAMES).forEach((g) => add(g.intro));
// 3
GAMES[3].levels.forEach((l) => l.tasks.forEach((t) => add(t.say)));
add('Тапсырманы қайта тыңдайық.');
// 4
add('Сиқырлы сандықты бас!', 'Тағы тыңда.', 'Заттың атын да айт!');
GAMES[4].levels.forEach((l, lv) => l.tasks.forEach((t) => {
  if (lv === 0) add(`Қайсысы — ${t.word}?`, `Бұл — ${t.word}. Енді өзің айт: ${t.word}`, `${t.word}. Қайтала: ${t.word}`);
  else add(t.q, `Былай айтуға болады: ${t.show}`);
}));
// 5
add('Суретке сәйкес екі сөзді вагондарға орналастыр', 'Сөздерді дұрыс ретпен орналастырып, сөйлем құрастыр', 'Сөздерді реттеп, толық сөйлем құрастыр', 'Сөздердің орнын ауыстырып көр');
GAMES[5].levels.forEach((l, lv) => l.tasks.forEach((t) => add(t.words.join(' ') + (lv > 0 ? '.' : ''))));
// 6
add('Суреттерді оқиға ретімен орналастыр', 'Бұл суреттен бұрын не болды? Қайта ойлан', 'Енді оқиғаны басынан аяғына дейін төрт-бес сөйлеммен айтып бер');
GAMES[6].levels.forEach((l, lv) => l.tasks.forEach((t) => {
  t.pics.forEach((p, j) => add(p.cap, `${j + 1}-сурет. Не болды? Бір сөйлем айт`));
  if (lv === 2) add(t.pics.map((p) => p.cap).join('. '));
}));

const VOICE = process.env.VOICE_ID || 'EXAVITQu4vr4xnSDxMaL'; // Sarah — жұмсақ әйел дауысы
const MODEL = 'eleven_v3';
const dir = path.join(root, 'audio'); fs.mkdirSync(dir, { recursive: true });
const mfile = path.join(dir, 'manifest.json');
const manifest = fs.existsSync(mfile) ? JSON.parse(fs.readFileSync(mfile, 'utf8')) : {};
const name = (t) => crypto.createHash('sha1').update(VOICE + MODEL + t).digest('hex').slice(0, 12) + '.mp3';

const todo = [...P].filter((t) => !manifest[t] || !fs.existsSync(path.join(dir, manifest[t])));
console.log(`Фраза: ${P.size}, жасалатыны: ${todo.length}`);
let ok = 0, fail = [];
import { execFile } from 'node:child_process';
// curl қолданамыз: ол ортадағы HTTPS прокси баптауын автоматты пайдаланады
const curl = (t, outFile) => new Promise((res) => {
  const body = JSON.stringify({ text: t, model_id: MODEL, language_code: 'kk' });
  execFile('curl', ['-sS', '-X', 'POST', `https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_64`,
    '-H', 'Content-Type: application/json', '-d', body, '-o', outFile, '-w', '%{http_code}'], (e, out) => res(e ? 0 : +out));
});
async function one(t) {
  const f = name(t), fp = path.join(dir, f);
  for (let a = 0; a < 4; a++) {
    const code = await curl(t, fp);
    if (code === 200) { manifest[t] = f; ok++; return; }
    const msg = fs.existsSync(fp) ? fs.readFileSync(fp, 'utf8').slice(0, 200) : '';
    if (code === 429 || code >= 500 || code === 0) { await new Promise((s) => setTimeout(s, 1500 * (a + 1))); continue; }
    fs.rmSync(fp, { force: true }); fail.push([t, code, msg]); return;
  }
  fs.rmSync(fp, { force: true }); fail.push([t, 'retries']);
}
const q = [...todo];
await Promise.all(Array.from({ length: 3 }, async () => { while (q.length) await one(q.shift()); }));
// тек қолданыстағы фразалар қалады
const out = Object.fromEntries([...P].filter((t) => manifest[t]).map((t) => [t, manifest[t]]));
fs.writeFileSync(mfile, JSON.stringify(out, null, 1));
console.log(`Дайын: ${ok}, қате: ${fail.length}`); fail.forEach((f) => console.log(f));
