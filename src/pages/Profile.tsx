import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { MapPinned, Tractor, Save } from 'lucide-react';
import { createAlert } from '../utils/alertEngine';
import { api } from '../services/api';

type FarmerProfile = {
  location: string;
  landSize: string;
  crops: string;
  sowingDate: string;
  notificationPreferences: {
    weather: boolean;
    disease: boolean;
    lifecycle: boolean;
    personalized: boolean;
  };
};

const PROFILE_KEY = 'farmerProfile';

const DEFAULT_PREFS = { weather: true, disease: true, lifecycle: true, personalized: true };

export function Profile() {
  const { language } = useLanguage();
  const initial = useMemo<FarmerProfile>(() => {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      if (raw) {
        const parsed = (JSON.parse(raw) as Partial<FarmerProfile>) || {};
        return {
          ...parsed,
          location: String(parsed.location || ''),
          landSize: String(parsed.landSize || ''),
          crops: String(parsed.crops || ''),
          sowingDate: String(parsed.sowingDate || new Date().toISOString().slice(0, 10)),
          notificationPreferences: {
            ...DEFAULT_PREFS,
            ...(parsed.notificationPreferences || {}),
          },
        };
      }

      return {
            location: '',
            landSize: '',
            crops: '',
            sowingDate: new Date().toISOString().slice(0, 10),
            notificationPreferences: DEFAULT_PREFS,
      };
    } catch {
      return {
        location: '',
        landSize: '',
        crops: '',
        sowingDate: new Date().toISOString().slice(0, 10),
        notificationPreferences: DEFAULT_PREFS,
      };
    }
  }, []);

  const [profile, setProfile] = useState<FarmerProfile>(initial);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const syncProfile = async () => {
      try {
        const response = (await api.getProfile()) as {
          location?: string;
          landSizeAcres?: number;
          crops?: string[];
          cropPlans?: Array<{ sowingDate?: string }>;
          notificationPreferences?: FarmerProfile['notificationPreferences'];
        };
        setProfile((prev) => ({
          ...prev,
          location: response.location || prev.location,
          landSize: response.landSizeAcres ? String(response.landSizeAcres) : prev.landSize,
          crops: Array.isArray(response.crops) ? response.crops.join(', ') : prev.crops,
          sowingDate: response.cropPlans?.[0]?.sowingDate || prev.sowingDate,
          notificationPreferences: {
            ...prev.notificationPreferences,
            ...(response.notificationPreferences || {}),
          },
        }));
      } catch {
        // Keep local profile when backend is unavailable.
      }
    };

    void syncProfile();
  }, []);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    setSaved(true);

    const crops = profile.crops
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 6);

    void api.updateProfile({
      location: profile.location,
      landSizeAcres: Number(profile.landSize || 0),
      crops,
      notificationPreferences: profile.notificationPreferences,
      cropPlans: crops.map((cropName) => ({
        cropName,
        sowingDate: profile.sowingDate,
        stage: 'active',
      })),
    });

    createAlert({
      type: 'lifecycle',
      level: 'low',
      message:
        language === 'te'
          ? 'రైతు ప్రొఫైల్ అప్డేట్ అయింది. పంట రిమైండర్లు వ్యక్తిగతీకరించబడ్డాయి.'
          : 'Farmer profile updated. Crop lifecycle reminders are now personalized.',
    });
  };

  return (
    <div className="container mx-auto max-w-3xl p-4">
      <h1 className="mb-6 text-3xl font-bold text-gray-900">{language === 'te' ? 'రైతు ప్రొఫైల్' : 'Farmer Profile'}</h1>
      <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div>
          <label className="mb-2 block text-sm font-semibold text-gray-700">
            <MapPinned className="mr-1 inline" size={16} />
            {language === 'te' ? 'గ్రామం/స్థానం' : 'Village/Location'}
          </label>
          <input
            value={profile.location}
            onChange={(event) => setProfile((prev) => ({ ...prev, location: event.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
            placeholder={language === 'te' ? 'ఉదా: వరంగల్' : 'Example: Warangal'}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-gray-700">
            <Tractor className="mr-1 inline" size={16} />
            {language === 'te' ? 'భూమి పరిమాణం (ఎకరాలు)' : 'Land Size (Acres)'}
          </label>
          <input
            value={profile.landSize}
            onChange={(event) => setProfile((prev) => ({ ...prev, landSize: event.target.value }))}
            type="number"
            min="0"
            step="0.1"
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-gray-700">
            {language === 'te' ? 'నాటిన తేదీ (ప్రధాన పంట)' : 'Sowing Date (Primary Crop)'}
          </label>
          <input
            value={profile.sowingDate}
            onChange={(event) => setProfile((prev) => ({ ...prev, sowingDate: event.target.value }))}
            type="date"
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-gray-700">
            {language === 'te' ? 'ప్రస్తుతం సాగు చేస్తున్న పంటలు' : 'Current Crops'}
          </label>
          <input
            value={profile.crops}
            onChange={(event) => setProfile((prev) => ({ ...prev, crops: event.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
            placeholder={language === 'te' ? 'ఉదా: వరి, మిరప, అరటి' : 'Example: Rice, Chilli, Banana'}
          />
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="mb-2 text-sm font-semibold text-gray-800">
            {language === 'te' ? 'అలర్ట్ ప్రాధాన్యతలు' : 'Alert Preferences'}
          </p>
          <div className="grid gap-2 text-sm text-gray-700 md:grid-cols-2">
            {([
              ['weather', language === 'te' ? 'వాతావరణ అలర్ట్స్' : 'Weather alerts'],
              ['disease', language === 'te' ? 'వ్యాధి అలర్ట్స్' : 'Disease alerts'],
              ['lifecycle', language === 'te' ? 'పంట దశ రిమైండర్లు' : 'Crop lifecycle reminders'],
              ['personalized', language === 'te' ? 'వ్యక్తిగత సిఫార్సులు' : 'Personalized recommendations'],
            ] as Array<[keyof FarmerProfile['notificationPreferences'], string]>).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 rounded-md bg-white px-2 py-2">
                <input
                  type="checkbox"
                  checked={profile.notificationPreferences[key]}
                  onChange={(event) =>
                    setProfile((prev) => ({
                      ...prev,
                      notificationPreferences: {
                        ...prev.notificationPreferences,
                        [key]: event.target.checked,
                      },
                    }))
                  }
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-700"
        >
          <Save size={16} />
          {language === 'te' ? 'ప్రొఫైల్ సేవ్ చేయండి' : 'Save Profile'}
        </button>

        {saved && (
          <p className="rounded-md bg-green-50 p-2 text-sm text-green-700">
            {language === 'te' ? 'ప్రొఫైల్ విజయవంతంగా సేవ్ అయింది.' : 'Profile saved successfully.'}
          </p>
        )}
      </form>
    </div>
  );
}