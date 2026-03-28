import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sprout,
  CloudRain,
  Bug,
  Lightbulb,
  Calculator,
  TrendingUp,
  Landmark,
  UserRound,
  LineChart,
  ShieldCheck,
  BotMessageSquare,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { VoiceQueryInput } from '../components/VoiceQueryInput';
import { readAlerts } from '../utils/alertEngine';
import { useNotifications } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';

type DashboardFeature = {
  id: number;
  title: string;
  desc: string;
  path: string;
  featureKey?: string;
  adminOnly?: boolean;
  icon: ReactNode;
};

export function Dashboard() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { unreadCount } = useNotifications();
  const { user, canAccessAdmin, isFeatureEnabled } = useAuth();
  const [weatherSnap, setWeatherSnap] = useState<{ tempC: number; rainChance24h: number } | null>(null);

  const profileRaw = localStorage.getItem('farmerProfile');
  let profile: { location?: string; landSize?: string; crops?: string } = {};
  try {
    profile = profileRaw ? (JSON.parse(profileRaw) as { location?: string; landSize?: string; crops?: string }) : {};
  } catch {
    profile = {};
  }

  const alerts = readAlerts();
  const alertCount = Math.max(alerts.length, unreadCount);

  useEffect(() => {
    const loadWeatherSnapshot = async () => {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 9000,
            maximumAge: 600000,
          });
        });

        const weather = await api.getWeatherDecision(position.coords.latitude, position.coords.longitude);
        setWeatherSnap({
          tempC: weather.current.tempC,
          rainChance24h: weather.forecast.rainChance24h,
        });
      } catch {
        setWeatherSnap(null);
      }
    };

    void loadWeatherSnapshot();
  }, []);

  const handleVoiceQuery = (query: string) => {
    const lower = query.toLowerCase();
    if (lower.includes('weather') || query.includes('వాతావరణ')) {
      navigate('/weather');
      return;
    }
    if (lower.includes('disease') || query.includes('తెగులు')) {
      navigate('/disease-detect');
      return;
    }
    if (lower.includes('price') || query.includes('ధర')) {
      navigate('/market-prices');
      return;
    }
    navigate('/crop-recommend');
  };

  const features: DashboardFeature[] = [
    {
      id: 1,
      title: t('crop_recommendation'),
      desc: t('crop_rec_desc'),
      icon: <Sprout size={48} className="text-green-600" />,
      path: '/crop-recommend',
      featureKey: 'cropRecommendation',
    },
    {
      id: 2,
      title: t('weather_forecast'),
      desc: t('weather_desc'),
      icon: <CloudRain size={48} className="text-blue-500" />,
      path: '/weather',
      featureKey: 'weather',
    },
    {
      id: 3,
      title: t('disease_detection'),
      desc: t('disease_desc'),
      icon: <Bug size={48} className="text-red-500" />,
      path: '/disease-detect',
      featureKey: 'diseaseDetection',
    },
    {
      id: 4,
      title: t('farming_tips'),
      desc: t('farming_desc'),
      icon: <Lightbulb size={48} className="text-yellow-500" />,
      path: '/farming-tips',
    },
        {
      id: 11,
      title: 'AI Farming Assistant',
      desc: 'Ask weather-aware farming questions and get real-time AI action steps.',
      icon: <BotMessageSquare size={48} className="text-teal-600" />,
      path: '/ai-assistant',
    },
    {
      id: 5,
      title: t('market_prices'),
      desc: t('market_desc'),
      icon: <TrendingUp size={48} className="text-purple-500" />,
      path: '/market-prices',
      featureKey: 'marketPrices',
    },
    {
      id: 6,
      title: t('fertilizer_calc'),
      desc: t('fertilizer_desc'),
      icon: <Calculator size={48} className="text-orange-500" />,
      path: '/fertilizer-calc',
      featureKey: 'fertilizerCalculator',
    },
    {
      id: 7,
      title: t('govt_schemes'),
      desc: t('schemes_desc'),
      icon: <Landmark size={48} className="text-indigo-500" />,
      path: '/govt-schemes',
      featureKey: 'govtSchemes',
    },
    {
      id: 8,
      title: language === 'te' ? 'రైతు ప్రొఫైల్' : 'Farmer Profile',
      desc:
        language === 'te'
          ? 'స్థానం, భూమి, పంటల ఆధారంగా వ్యక్తిగత సూచనలు.'
          : 'Personalized insights from location, land and crops.',
      icon: <UserRound size={48} className="text-cyan-600" />,
      path: '/profile',
      featureKey: 'farmerProfile',
    },
    {
      id: 9,
      title: language === 'te' ? 'లాభ అంచనా' : 'Profit Estimator',
      desc:
        language === 'te'
          ? 'ఖర్చు, దిగుబడి, ధరల ఆధారంగా నికర లాభం.'
          : 'Estimate net profit from cost, yield and market prices.',
      icon: <LineChart size={48} className="text-emerald-600" />,
      path: '/profit-estimator',
      featureKey: 'profitEstimator',
    },
    {
      id: 10,
      title: language === 'te' ? 'అడ్మిన్ ప్యానెల్' : 'Admin Panel',
      desc:
        language === 'te'
          ? 'వినియోగదారులు, రోల్స్, ఫీచర్లు, అలర్ట్లు నిర్వహించండి.'
          : 'Manage users, roles, feature switches and live alerts.',
      icon: <ShieldCheck size={48} className="text-slate-700" />,
      path: '/admin',
      adminOnly: true,
    },
  ];

  const visibleFeatures = features.filter((feature) => {
    if (feature.adminOnly && !canAccessAdmin) {
      return false;
    }
    if (feature.featureKey && !isFeatureEnabled(feature.featureKey) && !canAccessAdmin) {
      return false;
    }
    return true;
  });

  return (
    <div className="container mx-auto p-4 py-8">
      <div className="mb-6 rounded-[28px] border border-[#d9ead3] bg-[linear-gradient(135deg,#f6fbf2_0%,#eef5d9_45%,#fff7e2_100%)] p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#6b8b52]">Smart Agriculture Workspace</p>
        <h1 className="mt-3 text-3xl font-bold text-[#234223]">
          {language === 'te' ? `స్వాగతం, ${user?.name || t('welcome')}` : `Welcome back, ${user?.name || t('welcome')}`}
        </h1>
        <p className="mt-2 max-w-3xl text-[#4c6b4f]">
          {language === 'te'
            ? 'మీ ఖాతా రోల్, అలర్ట్లు, మరియు ఎనేబుల్ చేసిన ఫీచర్ల ఆధారంగా ఈ డ్యాష్‌బోర్డ్ సిద్ధమైంది.'
            : 'This dashboard adapts to your role, live alerts, and the features enabled by the admin team.'}
        </p>
      </div>

      <div className="mb-5 grid gap-4 md:grid-cols-5">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">{language === 'te' ? 'ఖాతా రోల్' : 'Account Role'}</p>
          <p className="text-lg font-semibold text-gray-900">{user?.role === 'admin' ? 'Admin' : 'Farmer'}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">{language === 'te' ? 'వ్యక్తిగత స్థానం' : 'Personal Location'}</p>
          <p className="text-lg font-semibold text-gray-900">{profile.location || (language === 'te' ? 'సెట్ కాలేదు' : 'Not set')}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">{language === 'te' ? 'భూమి పరిమాణం' : 'Land Size'}</p>
          <p className="text-lg font-semibold text-gray-900">
            {profile.landSize ? `${profile.landSize} acres` : language === 'te' ? 'సెట్ కాలేదు' : 'Not set'}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">{language === 'te' ? 'సక్రియ అలర్ట్లు' : 'Active Alerts'}</p>
          <p className="text-lg font-semibold text-gray-900">{alertCount}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">Weather Snapshot</p>
          <p className="text-lg font-semibold text-gray-900">
            {weatherSnap ? `${weatherSnap.tempC} C / Rain ${weatherSnap.rainChance24h}%` : 'Loading...'}
          </p>
        </div>
      </div>

      <div className="mb-6">
        <VoiceQueryInput onQuery={handleVoiceQuery} />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {visibleFeatures.map((feature) => (
          <div
            key={feature.id}
            onClick={() => navigate(feature.path)}
            className="cursor-pointer rounded-2xl border border-transparent bg-white p-6 shadow-md transition-all hover:-translate-y-1 hover:border-green-100 hover:shadow-xl"
          >
            <div className="mb-4 flex items-center space-x-4">
              <div className="rounded-full bg-gray-50 p-3 shadow-inner">{feature.icon}</div>
              <div>
                <h3 className="text-xl font-bold text-gray-800">{feature.title}</h3>
                {feature.adminOnly && (
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#5f7d42]">
                    {language === 'te' ? 'అడ్మిన్ యాక్సెస్' : 'Admin access'}
                  </p>
                )}
              </div>
            </div>
            <p className="pl-16 text-gray-600">{feature.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}




