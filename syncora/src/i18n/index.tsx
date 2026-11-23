import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Lang = 'kk' | 'en';

const kk = {
  'app.tagline': 'Достарыңмен бірге фильм көр — қай жерде жүрсең де',
  'app.subtitle':
    'Бөлме аш, достарыңды шақыр (2–28 адам), фильмді қос. Барлығында бір уақытта, бір секундта ойнайды. Көріп отырып чатта талқылаңдар.',
  'auth.google': 'Google арқылы кіру',
  'auth.signout': 'Шығу',
  'auth.only_google': 'Әзірге тек Google аккаунтымен тіркелуге болады.',
  'auth.error': 'Кіру сәтсіз аяқталды. Қайта көріңіз.',
  'feature.sync': 'Дәл синхрон',
  'feature.sync.d': 'Админ тоқтатса — бәрінде тоқтайды. Алға айналдырса — бәрінде айналады.',
  'feature.chat': 'Тікелей чат',
  'feature.chat.d': 'Фильм барысында бөлмедегі барлық адаммен талқыла.',
  'feature.friends': 'Достар мен жеке хат',
  'feature.friends.d': '@username арқылы дос тап, жеке чатта жаз, бөлмеге шақыр.',
  'nav.rooms': 'Бөлмелер',
  'nav.friends': 'Достар',
  'nav.messages': 'Хаттар',
  'nav.settings': 'Баптаулар',
  'common.loading': 'Жүктелуде…',
  'common.save': 'Сақтау',
  'common.cancel': 'Болдырмау',
  'common.copy': 'Көшіру',
  'common.copied': 'Көшірілді!',
  'common.send': 'Жіберу',
  'common.delete': 'Жою',
  'common.back': 'Артқа',
  'common.search': 'Іздеу',
  'common.error': 'Қате шықты. Қайта көріңіз.',
  'home.title': 'Сенің бөлмелерің',
  'home.create': 'Жаңа бөлме',
  'home.create.name': 'Бөлме атауы',
  'home.create.name.ph': 'Мысалы: Жұма кешкі кино',
  'home.create.max': 'Ең көп адам саны',
  'home.create.public': 'Ашық бөлме (барлығы тізімнен көре алады)',
  'home.create.submit': 'Бөлме ашу',
  'home.join': 'Сілтеме арқылы кіру',
  'home.join.ph': 'Бөлме сілтемесі немесе коды',
  'home.join.submit': 'Кіру',
  'home.empty': 'Әзірге бөлме жоқ. Жаңасын аш немесе досыңның сілтемесімен кір.',
  'home.public': 'Ашық бөлмелер',
  'home.public.empty': 'Қазір ашық бөлме жоқ.',
  'room.members': 'адам',
  'room.owner': 'Иесі',
  'room.admin': 'Админ',
  'room.join': 'Бөлмеге қосылу',
  'room.full': 'Бөлме толы',
  'room.notfound': 'Бөлме табылмады немесе жойылған.',
  'room.leave': 'Бөлмеден шығу',
  'room.delete': 'Бөлмені жою',
  'room.delete.confirm': 'Бөлмені біржола жоясыз ба?',
  'room.invite': 'Шақыру',
  'room.invite.link': 'Шақыру сілтемесі',
  'room.invite.friends': 'Достарды шақыру',
  'room.invite.sent': 'Жіберілді',
  'room.invite.none': 'Әзірге досың жоқ.',
  'room.video.set': 'Видео қою',
  'room.video.ph': 'YouTube, Vimeo, .mp4 / .m3u8 сілтемесі немесе кез келген видео сайты',
  'room.video.title.ph': 'Атауы (міндетті емес)',
  'room.video.local': 'Әркім өз компьютеріндегі файлды таңдайды',
  'room.video.empty': 'Админ әлі видео қосқан жоқ',
  'room.video.empty.admin': 'Жоғарыға сілтеме қойып, фильмді баста',
  'room.video.nosync':
    'Бұл сайтты синхрондау мүмкін емес: әркім өзі басқарады. Дәл синхрон үшін YouTube, Vimeo немесе тікелей видео сілтемесін қолданыңыз.',
  'room.video.pickfile': 'Фильм файлын таңда',
  'room.video.pickfile.d': 'Админ «{title}» қосты. Сенде де сол файл болуы керек — оны таңда, ойнату синхрондалады.',
  'room.tapToJoin': 'Көруге қосылу үшін бас',
  'room.resync': 'Синхрондау',
  'room.fullscreen': 'Толық экран',
  'room.controlledBy': 'Ойнатуды админ басқарады',
  'room.chat': 'Чат',
  'room.chat.ph': 'Хабарлама жаз…',
  'room.chat.empty': 'Әзірге хабарлама жоқ. Бірінші болып жаз!',
  'room.people': 'Қатысушылар',
  'room.makeAdmin': 'Админ ету',
  'room.removeAdmin': 'Админдікті алу',
  'room.kick': 'Шығару',
  'room.online': 'онлайн',
  'room.sys.video': '{name} жаңа видео қосты: {title}',
  'room.reactions': 'Реакция',
  'friends.title': 'Достар',
  'friends.search.ph': '@username бойынша іздеу',
  'friends.add': 'Досқа қосу',
  'friends.pending.out': 'Сұрау жіберілді',
  'friends.accept': 'Қабылдау',
  'friends.decline': 'Бас тарту',
  'friends.remove': 'Достан шығару',
  'friends.remove.confirm': 'Шынымен достан шығарасыз ба?',
  'friends.message': 'Жазу',
  'friends.incoming': 'Келген сұраулар',
  'friends.outgoing': 'Жіберілген сұраулар',
  'friends.list': 'Достарым',
  'friends.empty': 'Әзірге досың жоқ. Жоғарыдан @username арқылы ізде.',
  'friends.notfound': 'Ешкім табылмады',
  'friends.isFriend': 'Дос',
  'friends.you': 'Бұл сен',
  'dm.title': 'Хаттар',
  'dm.empty': 'Әзірге хат жоқ. Достар бетінен досыңа жаз.',
  'dm.select': 'Сөйлесуді таңда',
  'dm.notFriends': 'Жеке хат жазу үшін алдымен дос болыңыздар.',
  'dm.invite': 'Сені бірге көруге шақырады: {name}',
  'dm.invite.open': 'Бөлмеге кіру',
  'settings.title': 'Профиль баптаулары',
  'settings.username': 'Пайдаланушы аты',
  'settings.username.help': '3–20 таңба: кіші латын әріптері, сандар және _',
  'settings.username.taken': 'Бұл ат бос емес',
  'settings.username.invalid': 'Тек a–z, 0–9 және _ (3–20 таңба)',
  'settings.username.ok': 'Бос',
  'settings.displayName': 'Көрсетілетін аты',
  'settings.bio': 'Өзің туралы',
  'settings.lang': 'Интерфейс тілі',
  'settings.saved': 'Сақталды',
  'settings.random': 'Кездейсоқ',
  'time.now': 'жаңа ғана',
  'notfound': 'Бет табылмады',
  'setup.title': 'Firebase бапталмаған',
  'setup.text': '.env файлына Firebase баптауларын енгізіңіз (README.md қараңыз).',
} as const;

export type Key = keyof typeof kk;

const en: Record<Key, string> = {
  'app.tagline': 'Watch movies with friends — wherever you are',
  'app.subtitle':
    'Open a room, invite friends (2–28 people) and play a movie. It plays at the same second for everyone. Talk about it in the chat while you watch.',
  'auth.google': 'Continue with Google',
  'auth.signout': 'Sign out',
  'auth.only_google': 'For now, sign-up is available with a Google account only.',
  'auth.error': 'Sign-in failed. Please try again.',
  'feature.sync': 'Exact sync',
  'feature.sync.d': 'The admin pauses — everyone pauses. Skips ahead — everyone skips.',
  'feature.chat': 'Live chat',
  'feature.chat.d': 'Discuss the movie with everyone in the room as you watch.',
  'feature.friends': 'Friends & messages',
  'feature.friends.d': 'Find friends by @username, message them privately, invite them to rooms.',
  'nav.rooms': 'Rooms',
  'nav.friends': 'Friends',
  'nav.messages': 'Messages',
  'nav.settings': 'Settings',
  'common.loading': 'Loading…',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.copy': 'Copy',
  'common.copied': 'Copied!',
  'common.send': 'Send',
  'common.delete': 'Delete',
  'common.back': 'Back',
  'common.search': 'Search',
  'common.error': 'Something went wrong. Please try again.',
  'home.title': 'Your rooms',
  'home.create': 'New room',
  'home.create.name': 'Room name',
  'home.create.name.ph': 'e.g. Friday movie night',
  'home.create.max': 'Max people',
  'home.create.public': 'Public room (anyone can find it in the list)',
  'home.create.submit': 'Create room',
  'home.join': 'Join with a link',
  'home.join.ph': 'Room link or code',
  'home.join.submit': 'Join',
  'home.empty': 'No rooms yet. Create one, or join with a friend’s link.',
  'home.public': 'Public rooms',
  'home.public.empty': 'No public rooms right now.',
  'room.members': 'people',
  'room.owner': 'Owner',
  'room.admin': 'Admin',
  'room.join': 'Join room',
  'room.full': 'Room is full',
  'room.notfound': 'Room not found or deleted.',
  'room.leave': 'Leave room',
  'room.delete': 'Delete room',
  'room.delete.confirm': 'Delete this room permanently?',
  'room.invite': 'Invite',
  'room.invite.link': 'Invite link',
  'room.invite.friends': 'Invite friends',
  'room.invite.sent': 'Sent',
  'room.invite.none': 'You have no friends yet.',
  'room.video.set': 'Set video',
  'room.video.ph': 'YouTube, Vimeo, .mp4 / .m3u8 link, or any video site',
  'room.video.title.ph': 'Title (optional)',
  'room.video.local': 'Everyone picks the file on their own computer',
  'room.video.empty': 'The admin hasn’t added a video yet',
  'room.video.empty.admin': 'Paste a link above to start the movie',
  'room.video.nosync':
    'This site can’t be synced: everyone controls their own player. For exact sync use YouTube, Vimeo or a direct video link.',
  'room.video.pickfile': 'Pick the movie file',
  'room.video.pickfile.d': 'The admin added “{title}”. You need the same file — pick it and playback will sync.',
  'room.tapToJoin': 'Tap to join playback',
  'room.resync': 'Resync',
  'room.fullscreen': 'Fullscreen',
  'room.controlledBy': 'Playback is controlled by the admin',
  'room.chat': 'Chat',
  'room.chat.ph': 'Write a message…',
  'room.chat.empty': 'No messages yet. Say hi!',
  'room.people': 'People',
  'room.makeAdmin': 'Make admin',
  'room.removeAdmin': 'Remove admin',
  'room.kick': 'Remove',
  'room.online': 'online',
  'room.sys.video': '{name} added a new video: {title}',
  'room.reactions': 'Reaction',
  'friends.title': 'Friends',
  'friends.search.ph': 'Search by @username',
  'friends.add': 'Add friend',
  'friends.pending.out': 'Request sent',
  'friends.accept': 'Accept',
  'friends.decline': 'Decline',
  'friends.remove': 'Unfriend',
  'friends.remove.confirm': 'Remove this friend?',
  'friends.message': 'Message',
  'friends.incoming': 'Incoming requests',
  'friends.outgoing': 'Sent requests',
  'friends.list': 'My friends',
  'friends.empty': 'No friends yet. Search by @username above.',
  'friends.notfound': 'Nobody found',
  'friends.isFriend': 'Friend',
  'friends.you': 'That’s you',
  'dm.title': 'Messages',
  'dm.empty': 'No conversations yet. Message a friend from the Friends page.',
  'dm.select': 'Select a conversation',
  'dm.notFriends': 'You need to be friends to send private messages.',
  'dm.invite': '{name} invites you to watch together',
  'dm.invite.open': 'Open room',
  'settings.title': 'Profile settings',
  'settings.username': 'Username',
  'settings.username.help': '3–20 characters: lowercase latin letters, digits and _',
  'settings.username.taken': 'This username is taken',
  'settings.username.invalid': 'Only a–z, 0–9 and _ (3–20 characters)',
  'settings.username.ok': 'Available',
  'settings.displayName': 'Display name',
  'settings.bio': 'About you',
  'settings.lang': 'Interface language',
  'settings.saved': 'Saved',
  'settings.random': 'Random',
  'time.now': 'just now',
  notfound: 'Page not found',
  'setup.title': 'Firebase is not configured',
  'setup.text': 'Put your Firebase config into the .env file (see README.md).',
};

const dicts: Record<Lang, Record<Key, string>> = { kk, en };

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: Key, vars?: Record<string, string | number>) => string };
const I18nContext = createContext<Ctx | null>(null);

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem('syncora.lang');
    if (saved === 'kk' || saved === 'en') return saved;
  } catch {
    /* storage unavailable */
  }
  return 'kk'; // Kazakh is the default; English is one click away
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem('syncora.lang', l);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const t = useCallback(
    (k: Key, vars?: Record<string, string | number>) => {
      let s: string = dicts[lang][k] ?? k;
      if (vars) for (const [name, v] of Object.entries(vars)) s = s.split(`{${name}}`).join(String(v));
      return s;
    },
    [lang],
  );
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n outside provider');
  return ctx;
}
