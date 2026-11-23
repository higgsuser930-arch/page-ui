import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Logo } from './components/Logo';
import { I18nProvider, useI18n } from './i18n';
import { AuthProvider, useAuth } from './lib/auth';
import { isConfigured } from './lib/firebase';
import { isActive, useAppConfig, useSubscription } from './lib/subscription';
import { Legal } from './pages/Legal';
import { Paywall } from './pages/Paywall';
import { Friends } from './pages/Friends';
import { Home } from './pages/Home';
import { Landing } from './pages/Landing';
import { Messages } from './pages/Messages';
import { RoomPage } from './pages/RoomPage';
import { Settings } from './pages/Settings';
import { UserPage } from './pages/UserPage';

function Gate() {
  const { t } = useI18n();
  const { user, profile, loading } = useAuth();
  const { pathname } = useLocation();
  const cfg = useAppConfig();
  const sub = useSubscription(user?.uid);
  // Legal pages must be public: payment providers and visitors read them without signing in
  if (pathname.startsWith('/legal/'))
    return (
      <Routes>
        <Route path="legal/:doc" element={<Legal />} />
      </Routes>
    );
  if (!isConfigured)
    return (
      <div className="page center">
        <Logo size={40} variant="icon" />
        <h1>{t('setup.title')}</h1>
        <p className="muted">{t('setup.text')}</p>
      </div>
    );
  if (loading || (user && (!profile || sub === undefined || !cfg)))
    return (
      <div className="splash">
        <Logo size={48} variant="icon" />
      </div>
    );
  if (!user) return <Landing />;
  if (cfg!.subscriptionRequired && !isActive(sub)) return <Paywall cfg={cfg!} sub={sub ?? null} />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="room/:id" element={<RoomPage />} />
        <Route path="friends" element={<Friends />} />
        <Route path="messages" element={<Messages />} />
        <Route path="messages/:username" element={<Messages />} />
        <Route path="settings" element={<Settings />} />
        <Route path="u/:username" element={<UserPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <BrowserRouter>
          <Gate />
        </BrowserRouter>
      </AuthProvider>
    </I18nProvider>
  );
}
