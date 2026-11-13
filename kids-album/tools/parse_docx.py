#!/usr/bin/env python3
"""Логопедиялық альбом .docx -> data.js (37 дыбыс x 7 ойын). Қолдану: parse_docx.py flat.txt out.js
flat.txt = pandoc in.docx -t plain --wrap=none"""
import re, sys, json
t = open(sys.argv[1], encoding='utf8').read()
secs = re.split(r'\n(?=\d+\. \S+ ДЫБЫСЫНА АРНАЛҒАН 7 ОЙЫН)', t)[1:]
lst = lambda s: [w.strip() for w in re.split(r',\s*', s.strip().rstrip('.')) if w.strip()]
def games(sec):
    parts = re.split(r'\n(?=[1-7]\. [^\n]+ – «[^»]+»\n)', sec)[1:]
    assert len(parts) == 7, len(parts)
    return parts
def lvl(txt, name):  # "Жеңіл деңгей: ..." paragraph
    m = re.search(name + r' деңгей: ([^\n]+)', txt); return m.group(1) if m else ''
out = []; problems = []
for s in secs:
    m = re.search(r'Нысана дыбыс: \[(.+?)\]\. Түрі: (\S+)\. Осы бөлімде қолданылатын сөздер: (.+?)\.\n', s)
    L, typ, words = m.group(1), m.group(2), lst(m.group(3))
    G = games(s)
    d = {'letter': L.upper(), 'type': 'vowel' if typ.startswith('дауысты') else 'cons', 'words': list(dict.fromkeys(words))}
    # 1
    g = G[0]
    dev = re.search(r'ӘЗІРЛЕУШІГЕ[^\n]*\n?', g) and g[g.index('ӘЗІРЛЕУШІГЕ'):]
    ae = re.search(r'аудиолары \[(.+?)\], \[(.+?)\], \[(.+?)\] ретімен', dev)
    easy = [ae.group(i) for i in (1, 2, 3)]
    me = re.search(r'Орта деңгейде \[(.+?)\], \[(.+?)\], \[(.+?)\], \[(.+?)\], \[(.+?)\] ойнатылады', dev)
    med = [me.group(i) for i in range(1, 6)]
    right = lst(re.search(r'дұрыс\s+жауаптар – ([^;]+);', dev).group(1))
    wrong = lst(re.search(r'қате жауаптар – ([^.]+)\.', dev).group(1))
    d['g1'] = {'easy': easy, 'medium': med, 'hard': right, 'wrong': wrong}
    # 3 syllables
    g = G[2]
    sy = re.search(r'Буын үлгілері: (.+?)\. Қате', g, re.S).group(1).replace('\n', ' ')
    syl = {}
    for it in re.split(r',\s*', sy):
        w, v = [x.strip() for x in it.split('–')]; syl[w] = v.split('-')
    d['syl'] = syl
    d['g3'] = {k: lst(re.search(n + r' деңгей: (?:екі|үш|бес) сөз (?:аралас ретпен )?беріледі: ([^.]+)\.', g).group(1)) for k, n in (('easy', 'Жеңіл'), ('medium', 'Орта'), ('hard', 'Күрделі'))}
    # 4 pictures
    g = G[3]
    d['g4'] = {k: lst(re.search(n + r' деңгейдегі дұрыс суреттер – ([^;.]+)', g).group(1)) for k, n in (('easy', 'жеңіл'), ('medium', 'орта'), ('hard', 'күрделі'))}
    # 5 positions
    g = G[4]
    d['g5'] = {k: lst(re.search(n + r' деңгей – \[.\] сөз (?:басында|ортасында|соңында): ([^.;]+)', g.replace('\n', ' ')).group(1)) for k, n in (('easy', 'жеңіл'), ('medium', 'Орта'), ('hard', 'Күрделі'))}
    # 6 sentences
    g = G[5]
    sent = re.search(r'сөйлемді қайтала: «([^»]+)»', g).group(1)
    med = lst(re.search(r'Орта деңгей: тірек сөздер арқылы сөйлем құра: ([^.]+)\.', g).group(1))
    hard = lst(re.search(r'Тірек сөздер: ([^.]+)\.', lvl(g, 'Күрделі') and g[g.index('Күрделі деңгей: нысана'):]).group(1))
    d['g6'] = {'sentence': sent, 'medium': med, 'hard': hard}
    # 7 story
    g = G[6].replace('\n', ' ')
    e = re.search(r'Жеңіл деңгей: .*?Тірек сөздер: ([^.]+)\.', g).group(1)
    md = re.search(r'Орта деңгей: .*?Тірек сөздер: ([^.]+)\.', g).group(1)
    hd = re.search(r'Күрделі деңгей: .*?Сөздер: ([^.]+)\.', g).group(1)
    d['g7'] = {'easy': lst(e), 'medium': lst(md), 'hard': lst(hd)}
    # проверки
    low = L.lower()
    for w in d['g1']['wrong']:
        if low in w: problems.append((L, 'wrong contains letter', w))
    for k in ('easy', 'medium', 'hard'):
        for w in d['g3'][k]:
            if w not in syl: problems.append((L, 'no syllables', w))
            elif ''.join(syl[w]) != w: problems.append((L, 'syl mismatch', w, syl[w]))
    out.append(d)
print('sounds', len(out)); print('problems', problems)
open(sys.argv[2], 'w', encoding='utf8').write('window.ALBUM_DATA = ' + json.dumps(out, ensure_ascii=False, indent=1) + ';\n')
