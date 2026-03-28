import { Sprout, LogOut, SlidersHorizontal, UserRound, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { useAppSettings } from '../contexts/AppSettingsContext';
import { NotificationCenter } from './NotificationCenter';
import { useAuth } from '../contexts/AuthContext';

export function Header() {
  const { language, setLanguage, t } = useLanguage();
  const { simpleMode, setSimpleMode } = useAppSettings();
  const { user, canAccessAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-50 border-b border-white/12 bg-[linear-gradient(135deg,rgba(24,78,55,0.84),rgba(35,95,74,0.76))] text-white shadow-[0_18px_40px_rgba(15,37,24,0.16)] backdrop-blur-xl">
      <div className="container mx-auto flex items-center justify-between gap-3 p-4">
        <div className="flex cursor-pointer items-center space-x-2" onClick={() => navigate('/')}>
          <Sprout size={32} />
          <div>
            <h1 className="text-2xl font-bold">{t('app_title')}</h1>
            <p className="hidden text-xs text-green-50/80 md:block">
              {user ? `${user.name} · ${user.role === 'admin' ? 'Admin' : 'Farmer'}` : 'Smart farm operations'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <NotificationCenter />
          <button
            onClick={() => navigate('/profile')}
            className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-sm font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur hover:bg-white/16 md:flex"
          >
            <UserRound size={16} />
            Profile
          </button>
          {canAccessAdmin && (
            <button
              onClick={() => navigate('/admin')}
              className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-sm font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur hover:bg-white/16 md:flex"
            >
              <ShieldCheck size={16} />
              Admin
            </button>
          )}
          <button
            onClick={() => setSimpleMode(!simpleMode)}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-sm font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur hover:bg-white/16"
            title="Simple Mode"
          >
            <SlidersHorizontal size={16} />
            {simpleMode ? 'Simple' : 'Smart'}
          </button>
          <button
            onClick={() => setLanguage(language === 'en' ? 'te' : 'en')}
            className="rounded-full bg-white/92 px-3 py-1 text-sm font-semibold text-[#1f593b] shadow-[0_8px_22px_rgba(15,37,24,0.1)] hover:bg-white"
          >
            {language === 'en' ? 'Telugu' : 'English'}
          </button>
          <button
            onClick={() => void handleLogout()}
            className="rounded-full border border-white/10 bg-white/10 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur transition-colors hover:bg-white/16"
          >
            <LogOut size={24} />
          </button>
        </div>
      </div>
    </header>
  );
}
