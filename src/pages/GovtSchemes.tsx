import { useLanguage } from '../contexts/LanguageContext';
import { Landmark, ExternalLink } from 'lucide-react';

export function GovtSchemes() {
  const { t } = useLanguage();

  const schemes = [
    { title: t('pm_kisan'), desc: t('pm_kisan_desc'), link: "https://pmkisan.gov.in/" },
    { title: t('rythu_bandhu'), desc: t('rythu_bandhu_desc'), link: "https://rythubandhu.telangana.gov.in/" },
    { title: t('pmfby'), desc: t('pmfby_desc'), link: "https://pmfby.gov.in/" },
    { title: t('kcc'), desc: t('kcc_desc'), link: "https://www.rbi.org.in/commonperson/English/Scripts/Notification.aspx?Id=2335" },
    { title: t('shc'), desc: t('shc_desc'), link: "https://soilhealth.dac.gov.in/" },
    { title: t('enam'), desc: t('enam_desc'), link: "https://enam.gov.in/web/" },
    { title: t('pmksy'), desc: t('pmksy_desc'), link: "https://pmksy.gov.in/" },
    { title: t('rkvy'), desc: t('rkvy_desc'), link: "https://rkvy.da.gov.in/" },
    { title: t('agri_infra'), desc: t('agri_infra_desc'), link: "https://agriinfra.dac.gov.in/" },
    { title: t('nfsm'), desc: t('nfsm_desc'), link: "https://nfsm.gov.in/" },
    { title: t('smam'), desc: t('smam_desc'), link: "https://farmech.dac.gov.in/" },
    { title: t('state_horti'), desc: t('state_horti_desc'), link: "https://horticulture.telangana.gov.in/" },
  ];

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
        <Landmark className="text-indigo-600" />
        {t('govt_schemes')}
      </h1>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {schemes.map((scheme, idx) => (
          <div key={idx} className="bg-white p-6 rounded-xl shadow-lg border border-indigo-50 flex flex-col justify-between hover:shadow-xl transition-all hover:scale-105 transform">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-indigo-900">{scheme.title}</h3>
                <Landmark size={24} className="text-indigo-200 opacity-50" />
              </div>
              <p className="text-gray-600 text-sm mb-6 leading-relaxed">{scheme.desc}</p>
            </div>
            
            <a 
              href={scheme.link} 
              target="_blank" 
              rel="noopener noreferrer"
              className="mt-auto w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 font-bold rounded-lg hover:bg-indigo-100 transition-colors text-sm"
            >
              {t('visit_website')} <ExternalLink size={16} />
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}