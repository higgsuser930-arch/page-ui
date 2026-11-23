import { Link, useParams } from 'react-router-dom';
import { LangSwitch } from '../components/LangSwitch';
import { Logo } from '../components/Logo';
import { useI18n, type Key } from '../i18n';
import { useAppConfig } from '../lib/subscription';
import { LegalFooter } from './Paywall';

// Seller details come from .env so they are filled in once (required by payment providers).
const env = import.meta.env;
const MISSING = '[ТОЛТЫРЫЛМАҒАН / NOT SET]';
const seller = {
  name: env.VITE_LEGAL_NAME || MISSING,
  bin: env.VITE_LEGAL_BIN || MISSING,
  address: env.VITE_LEGAL_ADDRESS || MISSING,
  email: env.VITE_SUPPORT_EMAIL || MISSING,
  phone: env.VITE_SUPPORT_PHONE || MISSING,
  site: env.VITE_SITE_URL || location.origin,
};

type Doc = { title: Key; kk: string[]; en: string[] };

function docs(price: number, intro: number): Record<string, Doc> {
  return {
    offer: {
      title: 'legal.offer',
      kk: [
        `Осы құжат ${seller.name} (БСН/ЖСН ${seller.bin}, бұдан әрі — Орындаушы) атынан ${seller.site} сайтында (SYNCORA) қызмет көрсетуге арналған ашық оферта болып табылады.`,
        '1. Қызмет. Орындаушы Пайдаланушыға бөлмелерде видеоны бірге синхронды көру, чат, достар және жеке хат функцияларына жазылым негізінде қолжетімділік береді. Видео мазмұнын Орындаушы ұсынбайды: оны Пайдаланушылар үшінші тарап сайттарынан немесе өз файлдарынан қосады және оған өздері жауап береді.',
        `2. Баға. Жазылым құны — айына ${price} ₸. Сервиске алғаш жазылатын Пайдаланушыларға алғашқы ай ${intro} ₸ (−50%). Жеңілдік бір аккаунтқа бір рет беріледі.`,
        '3. Төлем. Төлем банк картасымен төлем провайдері арқылы жүргізіледі. Жазылым ай сайын автоматты түрде жаңарып, картадан келесі айдың ақысы алынады. Карта деректерін Орындаушы сақтамайды.',
        '4. Тоқтату. Пайдаланушы «Баптаулар» бетінде жазылымды кез келген уақытта тоқтата алады. Тоқтатқаннан кейін келесі төлем алынбайды, ал төленген кезеңнің соңына дейін қолжетімділік сақталады.',
        '5. Офертаны қабылдау. Төлем жасау осы офертаның барлық шарттарын толық қабылдау болып саналады.',
        '6. Пайдаланушының міндеттері. Авторлық құқықты, Қазақстан Республикасының заңнамасын бұзатын мазмұнды таратпау, басқа қолданушыларды қорламау. Бұзған жағдайда Орындаушы аккаунтты бұғаттай алады.',
        '7. Жауапкершілік. Сервис «бар күйінде» ұсынылады. Үшінші тарап сайттарының (YouTube, Vimeo және т.б.) жұмысына Орындаушы жауап бермейді.',
        `8. Байланыс: ${seller.email}, ${seller.phone}. Мекенжай: ${seller.address}.`,
      ],
      en: [
        `This document is a public offer by ${seller.name} (BIN/IIN ${seller.bin}, the "Provider") for services on ${seller.site} (SYNCORA).`,
        '1. Service. The Provider gives the User subscription access to synchronized group video watching in rooms, chat, friends and private messages. The Provider does not supply video content: Users add it from third-party sites or their own files and are responsible for it.',
        `2. Price. The subscription costs ${price} ₸ per month. Users subscribing for the first time pay ${intro} ₸ (−50%) for the first month. The discount is given once per account.`,
        '3. Payment. Payments are made by bank card through a payment provider. The subscription renews automatically every month and the next month is charged to the card. The Provider does not store card data.',
        '4. Cancellation. The User can cancel at any time in Settings. No further payments are charged; access remains until the end of the paid period.',
        '5. Acceptance. Making a payment means full acceptance of this offer.',
        '6. User obligations. Do not share content that infringes copyright or the laws of the Republic of Kazakhstan, and do not abuse other users. The Provider may block accounts that do.',
        '7. Liability. The service is provided "as is". The Provider is not responsible for third-party sites (YouTube, Vimeo, etc.).',
        `8. Contacts: ${seller.email}, ${seller.phone}. Address: ${seller.address}.`,
      ],
    },
    privacy: {
      title: 'legal.privacy',
      kk: [
        `Деректер иесі: ${seller.name}, ${seller.email}.`,
        '1. Не жинаймыз: Google аккаунтыңыздағы аты мен суреті, сайттағы @username, профиль сипаттамасы, бөлме және жеке хаттар, достар тізімі, жазылым күйі.',
        '2. Электрондық пошта мекенжайыңыз біздің деректер қорымызда сақталмайды (ол тек Google арқылы кіру үшін Firebase Authentication-да болады).',
        '3. Карта деректерін біз көрмейміз және сақтамаймыз — оларды тек төлем провайдері өңдейді.',
        '4. Деректер Google Firebase серверлерінде сақталады және тек сервисті көрсету үшін қолданылады. Үшінші тұлғаларға сатылмайды.',
        `5. Аккаунтты және деректерді жою үшін ${seller.email} мекенжайына жазыңыз.`,
      ],
      en: [
        `Data controller: ${seller.name}, ${seller.email}.`,
        '1. What we collect: your Google name and photo, your @username, profile bio, room and private messages, friends list, subscription status.',
        '2. Your email address is not stored in our database (only in Firebase Authentication, for Google sign-in).',
        '3. We never see or store card data — only the payment provider processes it.',
        '4. Data is stored on Google Firebase servers and used only to provide the service. It is never sold.',
        `5. To delete your account and data, write to ${seller.email}.`,
      ],
    },
    refund: {
      title: 'legal.refund',
      kk: [
        `1. Жазылым: айына ${price} ₸, жаңа қолданушыға алғашқы ай ${intro} ₸. Ақы ай сайын автоматты түрде алынады.`,
        '2. Төлем банк картасымен (Visa, Mastercard) қауіпсіз төлем беті арқылы жүргізіледі.',
        '3. Қолжетімділік төлем расталған бойда автоматты түрде ашылады.',
        `4. Қайтару: техникалық ақаумен қызмет көрсетілмесе немесе ақша қате алынса, ${seller.email} мекенжайына 14 күн ішінде жазыңыз — ақша сол картаға 5–10 жұмыс күні ішінде қайтарылады.`,
        '5. Жазылымды «Баптаулар» бетінен тоқтатуға болады; келесі айдың ақысы алынбайды.',
      ],
      en: [
        `1. Subscription: ${price} ₸ per month, ${intro} ₸ for the first month for new users. Charged automatically every month.`,
        '2. Payment is made by bank card (Visa, Mastercard) on a secure payment page.',
        '3. Access opens automatically as soon as the payment is confirmed.',
        `4. Refunds: if the service was not provided due to a technical fault or money was charged by mistake, write to ${seller.email} within 14 days — the money is returned to the same card within 5–10 business days.`,
        '5. You can cancel the subscription in Settings; the next month will not be charged.',
      ],
    },
  };
}

export function Legal() {
  const { doc = 'offer' } = useParams();
  const { t, lang } = useI18n();
  const cfg = useAppConfig();
  const d = docs(cfg?.priceKzt ?? 999, cfg?.introPriceKzt ?? 499)[doc];
  return (
    <div className="landing">
      <header className="landing-top">
        <Link to="/">
          <Logo size={26} />
        </Link>
        <LangSwitch />
      </header>
      <article className="card legal">
        {d ? (
          <>
            <h1>{t(d.title)}</h1>
            {d[lang].map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            <h3>{t('legal.contacts')}</h3>
            <p className="muted">
              {seller.name} · {seller.bin} · {seller.address} · {seller.email} · {seller.phone}
            </p>
          </>
        ) : (
          <p>{t('notfound')}</p>
        )}
      </article>
      <LegalFooter />
    </div>
  );
}
