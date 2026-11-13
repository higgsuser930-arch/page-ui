#!/usr/bin/env python3
"""ElevenLabs арқылы аудио дайындау (v3, kk). Нәтиже: audio/*.mp3 + audio/manifest.js. Қолдану: python3 tools/gen_audio.py"""
import json, hashlib, os, sys, time, urllib.request, concurrent.futures as cf
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
raw = open(f'{ROOT}/data/album-data.js', encoding='utf8').read()
D = json.loads(raw[raw.index('=') + 1:].strip().rstrip(';'))
VOICE = '21m00Tcm4TlvDq8ikWAM'
# Жеке дыбыстарды TTS "әріп аты" деп оқымауы үшін фонетикалық жазу
PHON = {'а': 'аааа', 'ә': 'әәәә', 'о': 'оооо', 'ө': 'өөөө', 'ы': 'ыыыы', 'і': 'іііі', 'ұ': 'ұұұұ', 'ү': 'үүүү', 'е': 'еее', 'э': 'эээ', 'и': 'иии', 'у': 'ууу',
        'в': 'вввв', 'ж': 'жжжж', 'з': 'зззз', 'й': 'йййй', 'л': 'лллл', 'м': 'мммм', 'н': 'нннн', 'ң': 'ңңңң', 'р': 'рррр', 'с': 'сссс', 'ф': 'фффф', 'х': 'хххх', 'һ': 'һһһһ', 'ш': 'шшшш', 'щ': 'щщщщ', 'ғ': 'ғғғғ',
        'б': 'бы', 'г': 'гы', 'д': 'ды', 'к': 'кы', 'қ': 'қы', 'п': 'пы', 'т': 'ты', 'ц': 'цы', 'ч': 'чы'}
T = {}  # key -> text spoken
def add(key, text=None): T[key] = text or key
def walk(x):
    if isinstance(x, str):
        if ' ' not in x: add(x)
    elif isinstance(x, list): [walk(i) for i in x]
    elif isinstance(x, dict): [walk(v) for k, v in x.items() if k not in ('letter', 'type')]
for s in D:
    for k in ('words', 'g3', 'g4', 'g5', 'g7'): walk(s[k])
    walk(s['g6']['medium']); walk(s['g6']['hard']); walk(s['g1']['wrong']); walk(s['g1']['hard'])
    for w, p in s['syl'].items(): add(w); [add(x) for x in p]
    add(s['g6']['sentence'])
    add('intro:' + s['letter'], f"{s['letter']} дыбысын тексеруді бастаймыз!")
    add('done:' + s['letter'], f"Жарайсың! Сен {s['letter'].lower()} дыбысына арналған ойындарды аяқтадың! Енді келесі дыбысты таңдай аласың!")
    for x in s['g1']['easy'] + s['g1']['medium'] + [s['letter'].lower()]:
        add('snd:' + x, PHON.get(x, x * 3))
UI = {'ok': 'Жарайсың! Дұрыс орындадың! Келесі тапсырмаға өттің!', 'bad': 'Қайтадан байқап көр. Мұқият тыңда. Сенің қолыңнан келеді!',
      'listen_repeat': 'Тыңда да, қайтала!', 'welcome': 'Сәлем! Мен Жолбарыспын. Бірге ойнайық!', 'level_easy': 'Жеңіл деңгей', 'level_medium': 'Орта деңгей', 'level_hard': 'Күрделі деңгей',
      'butterfly': 'Мұрынмен дем ал, ауызбен жай үрле. Көбелекті гүлге жеткіз!', 'candle': 'Мұрынмен дем ал, ауызбен бірқалыпты үрле. Шамды сөндір!', 'boat': 'Ұзақ әрі бірқалыпты үрле. Қайық алға жүзсін!',
      'where': 'Дыбыс сөздің қай жерінде тұр?', 'say_word': 'Суретке қарап, атауын айт!', 'say_syll': 'Сөзді буынға бөліп айт!', 'press_mic': 'Микрофонды басып, айт!'}
for k, v in UI.items(): add('ui:' + k, v)
def fn(key): return hashlib.sha1(key.encode()).hexdigest()[:10] + '.mp3'
def gen(item):
    key, text = item; path = f'{ROOT}/audio/{fn(key)}'
    if os.path.exists(path) and os.path.getsize(path) > 500: return key, True
    body = json.dumps({'text': text if text[-1] in '.!?' else text + '.', 'model_id': 'eleven_v3', 'language_code': 'kk'}).encode()
    for i in range(4):
        try:
            r = urllib.request.Request(f'https://api.elevenlabs.io/v1/text-to-speech/{VOICE}?output_format=mp3_44100_64', body, {'Content-Type': 'application/json'})
            data = urllib.request.urlopen(r, timeout=60).read(); open(path, 'wb').write(data); return key, True
        except Exception as e:
            err = e; time.sleep(2 + 3 * i)
    print('FAIL', key, err, file=sys.stderr); return key, False
print(len(T), 'clips')
with cf.ThreadPoolExecutor(4) as ex: res = list(ex.map(gen, T.items()))
ok = {k: fn(k) for k, g in res if g}
open(f'{ROOT}/audio/manifest.js', 'w', encoding='utf8').write('window.AUDIO_MANIFEST = ' + json.dumps(ok, ensure_ascii=False) + ';\n')
print('ok', len(ok), 'failed', len(res) - len(ok))
