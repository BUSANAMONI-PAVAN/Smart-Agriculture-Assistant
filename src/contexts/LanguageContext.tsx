import { createContext, useContext, useState, ReactNode } from 'react';

type Language = 'en' | 'te';

type Translations = {
  [key in Language]: {
    [key: string]: string;
  };
};

export const translations: Translations = {
  en: {
    // GENERAL
    app_title: "Smart Agriculture",
    welcome: "Welcome",
    login_title: "Login",
    login_subtitle: "Welcome back! Please enter your details.",
    name_label: "Name",
    phone_label: "Phone Number",
    login_button: "Sign In",
    remember_me: "Remember me",
    forgot_password: "Forgot Password?",
    continue_with: "Or Continue With",
    no_account: "Don't have an account yet?",
    register_link: "Register for free",
    analyzing: "Analyzing...",
    upload_image: "Upload Image",
    analyze_button: "Analyze Image",
    take_photo: "Take Photo",
    or: "Or",

    // DASHBOARD
    crop_recommendation: "Crop Recommendation",
    crop_rec_desc: "Get crop advice based on soil and season.",
    weather_forecast: "Weather",
    weather_desc: "Real-time weather updates and alerts.",
    disease_detection: "Disease Detection",
    disease_desc: "Identify plant diseases by photo.",
    farming_tips: "Farming Tips",
    farming_desc: "Expert advice for better yield.",
    market_prices: "Market Prices",
    market_desc: "Live market prices for crops.",
    fertilizer_calc: "Fertilizer Calculator",
    fertilizer_desc: "Calculate fertilizer requirements.",
    govt_schemes: "Govt Schemes",
    schemes_desc: "Schemes beneficial for farmers.",
    ask_ai: "Ask AI Assistant",

    // WEATHER
    humidity: "Humidity",
    wind_speed: "Wind Speed",
    rain_chance: "Rain Chance",
    feels_like: "Feels Like",
    high_rain_alert: "High Rain Alert",
    extreme_heat_alert: "Extreme Heat Alert",
    avoid_irrigation: "Avoid irrigation today.",
    stay_hydrated: "Stay hydrated and protect crops.",
    location_fallback: "Location access denied, showing fallback weather for Hyderabad.",
    weather_load_error: "Unable to load weather right now. Please try again.",
    alerts: "Alerts",
    next_24h: "Expected in next 24 hours",
    last_updated: "Last updated",
    manager_alert_setup: "Manager Alert Webhook",
    manager_alert_setup_hint: "Paste a webhook URL to forward critical alerts to your operations team.",
    save_webhook: "Save Webhook",
    price_note: "Indicative mandi prices based on recent benchmark updates. Verify final trade price at local market.",
    confidence: "Confidence",
    observation: "Observation",
    recommended_cure: "Recommended Cure",
    
    // CROP RECOMMENDATION
    select_soil: "Select Soil Type",
    select_season: "Select Season",
    clay: "Clay Soil",
    sandy: "Sandy Soil",
    loamy: "Loamy Soil",
    black: "Black Soil",
    red: "Red Soil",
    silt: "Silt Soil",
    peaty: "Peaty Soil",
    chalky: "Chalky Soil",
    kharif: "Kharif (Monsoon)",
    rabi: "Rabi (Winter)",
    zaid: "Zaid (Summer)",
    get_recommendation: "Get Recommendation",
    recommended_crops: "Recommended Crops",
    yield: "Yield",
    duration: "Duration",
    market_price: "Market Price",

    // DISEASE DETECTION
    healthy: "Healthy",
    healthy_msg: "Your plant is healthy! Keep it up.",
    leaf_blight: "Leaf Blight / Rust",
    leaf_blight_obs: "Brown-red spots detected on leaves, likely Leaf Blight.",
    leaf_blight_cure: "Spray Mancozeb or Chlorothalonil fungicide. Remove infected leaves immediately.",
    powdery_mildew: "Powdery Mildew",
    powdery_mildew_obs: "White powdery spots detected on leaves.",
    powdery_mildew_cure: "Spray Neem Oil or Sulfur-based fungicide. Improve air circulation.",
    unknown_disease: "Unknown Issue",
    unknown_msg: "Could not identify the disease accurately. Please consult an expert.",

    // FARMING TIPS (CROPS)
    rice: "Rice",
    wheat: "Wheat",
    cotton: "Cotton",
    sugarcane: "Sugarcane",
    maize: "Maize",
    chilli: "Chilli",
    tomato: "Tomato",
    potato: "Potato",
    onion: "Onion",
    groundnut: "Groundnut",
    soybean: "Soybean",
    mustard: "Mustard",
    turmeric: "Turmeric",
    sunflower: "Sunflower",
    bengal_gram: "Bengal Gram",
    red_gram: "Red Gram",
    black_gram: "Black Gram",
    green_gram: "Green Gram",
    jowar: "Jowar",
    bajra: "Bajra",
    ragi: "Ragi",
    tobacco: "Tobacco",
    chickpea: "Chickpea",
    millets: "Millets",
    watermelon: "Watermelon",
    sesame: "Sesame",
    cucumber: "Cucumber",
    okra: "Okra",
    castor: "Castor",
    coriander: "Coriander",
    muskmelon: "Muskmelon",
    mango: "Mango",
    banana: "Banana",
    guava: "Guava",
    papaya: "Papaya",
    pomegranate: "Pomegranate",
    lemon: "Lemon",
    rose: "Rose",
    marigold: "Marigold",
    jasmine: "Jasmine",
    chrysanthemum: "Chrysanthemum",
    tuberose: "Tuberose",

    // MARKET PRICES
    commodity: "Commodity",
    market: "Market",
    price: "Price (₹/Quintal)",
    trend: "Trend",

    // GOVT SCHEMES
    pm_kisan: "PM Kisan",
    pm_kisan_desc: "Financial support of ₹6,000 per year for farmers.",
    rythu_bandhu: "Rythu Bandhu",
    rythu_bandhu_desc: "Investment support for agriculture and horticulture crops.",
    pmfby: "Fasal Bima Yojana",
    pmfby_desc: "Insurance coverage for crop loss.",
    kcc: "Kisan Credit Card (KCC)",
    kcc_desc: "Low interest loans for farmers.",
    shc: "Soil Health Card",
    shc_desc: "Soil nutrient status and fertilizer recommendations.",
    enam: "e-NAM",
    enam_desc: "Online trading platform for agricultural commodities.",
    pmksy: "PM Krishi Sinchayee Yojana",
    pmksy_desc: "Micro-irrigation and water-use efficiency support for farms.",
    rkvy: "RKVY",
    rkvy_desc: "State-led agriculture development and innovation funding.",
    agri_infra: "Agriculture Infrastructure Fund",
    agri_infra_desc: "Credit support for warehousing, cold chain, and agri infrastructure.",
    nfsm: "National Food Security Mission",
    nfsm_desc: "Support to increase production of rice, wheat, pulses and coarse cereals.",
    smam: "SMAM",
    smam_desc: "Subsidy support for farm mechanization and equipment.",
    state_horti: "Telangana Horticulture Schemes",
    state_horti_desc: "State support programs for fruit and flower cultivation.",
    visit_website: "Visit Official Website",

    // FERTILIZER CALC
    land_size: "Land Size (Acres)",
    select_crop: "Select Crop",
    calculate: "Calculate",
    fertilizer_req: "Fertilizer Requirements",
    urea: "Urea",
    dap: "DAP",
    mop: "MOP",

    // CHATBOT
    chat_placeholder: "Ask about crops, pests...",
    chat_title: "Agri Assistant",
  },
  te: {
    // GENERAL
    app_title: "స్మార్ట్ అగ్రికల్చర్",
    welcome: "స్వాగతం",
    login_title: "లాగిన్",
    login_subtitle: "స్వాగతం! దయచేసి మీ వివరాలను నమోదు చేయండి.",
    name_label: "పేరు",
    phone_label: "ఫోన్ నంబర్",
    login_button: "సైన్ ఇన్ చేయండి",
    remember_me: "నన్ను గుర్తుంచుకోండి",
    forgot_password: "పాస్‌వర్డ్ మర్చిపోయారా?",
    continue_with: "లేదా వీటితో కొనసాగించండి",
    no_account: "ఖాతా లేదా?",
    register_link: "ఉచితంగా రిజిస్టర్ చేసుకోండి",
    analyzing: "విశ్లేషిస్తోంది...",
    upload_image: "ఫోటో అప్‌లోడ్ చేయండి",
    analyze_button: "విశ్లేషించండి",
    take_photo: "ఫోటో తీయండి",
    or: "లేదా",

    // DASHBOARD
    crop_recommendation: "పంట సిఫార్సు",
    crop_rec_desc: "నేల మరియు సీజన్ ఆధారంగా పంట సలహాలు పొందండి.",
    weather_forecast: "వాతావరణం",
    weather_desc: "నిజ-సమయ వాతావరణ నవీకరణలు మరియు హెచ్చరికలు.",
    disease_detection: "తెగులు గుర్తింపు",
    disease_desc: "మొక్కల తెగుళ్లను ఫోటో ద్వారా గుర్తించండి.",
    farming_tips: "వ్యవసాయ చిట్కాలు",
    farming_desc: "మంచి దిగుబడి కోసం నిపుణుల సలహాలు.",
    market_prices: "మార్కెట్ ధరలు",
    market_desc: "పంటల ప్రత్యక్ష మార్కెట్ ధరలు.",
    fertilizer_calc: "ఎరువుల కాలిక్యులేటర్",
    fertilizer_desc: "ఎరువుల అవసరాలను లెక్కించండి.",
    govt_schemes: "ప్రభుత్వ పథకాలు",
    schemes_desc: "రైతులకు ఉపయోగపడే పథకాలు.",
    ask_ai: "AI సహాయకుడిని అడగండి",

    // WEATHER
    humidity: "తేమ",
    wind_speed: "గాలి వేగం",
    rain_chance: "వర్షం పడే అవకాశం",
    feels_like: "అనిపిస్తోంది",
    high_rain_alert: "భారీ వర్ష హెచ్చరిక",
    extreme_heat_alert: "అధిక ఉష్ణోగ్రత హెచ్చరిక",
    avoid_irrigation: "ఈ రోజు నీటి పారుదల మానుకోండి.",
    stay_hydrated: "నీరు ఎక్కువగా తాగండి మరియు పంటలను కాపాడుకోండి.",
    location_fallback: "లొకేషన్ అనుమతి రాలేదు. హైదరాబాద్ వాతావరణాన్ని చూపుతున్నాం.",
    weather_load_error: "ప్రస్తుతం వాతావరణ వివరాలు లోడ్ కాలేదు. మళ్లీ ప్రయత్నించండి.",
    alerts: "హెచ్చరికలు",
    next_24h: "తదుపరి 24 గంటల్లో అవకాశం",
    last_updated: "చివరి నవీకరణ",
    manager_alert_setup: "నిర్వహణ బృందం అలర్ట్ వెబ్‌హుక్",
    manager_alert_setup_hint: "క్రిటికల్ అలర్ట్స్‌ను ఆపరేషన్ టీమ్‌కు పంపేందుకు వెబ్‌హుక్ URL ఇవ్వండి.",
    save_webhook: "వెబ్‌హుక్ సేవ్ చేయండి",
    price_note: "ఇవి సూచిక ధరలు మాత్రమే. తుది వ్యాపార ధరను స్థానిక మార్కెట్‌లో నిర్ధారించండి.",
    confidence: "నమ్మక స్థాయి",
    observation: "పరిశీలన",
    recommended_cure: "సిఫారసు చేసిన చికిత్స",
    
    // CROP RECOMMENDATION
    select_soil: "నేల రకాన్ని ఎంచుకోండి",
    select_season: "సీజన్‌ను ఎంచుకోండి",
    clay: "బంకమట్టి నేల (Clay)",
    sandy: "ఇసుక నేల (Sandy)",
    loamy: "ఒండ్రు నేల (Loamy)",
    black: "నల్లరేగడి నేల (Black)",
    red: "ఎర్ర నేల (Red)",
    silt: "సిల్ట్ నేల (Silt)",
    peaty: "పీటీ నేల (Peaty)",
    chalky: "సుద్ద నేల (Chalky)",
    kharif: "ఖరీఫ్ (వర్షాకాలం)",
    rabi: "రబీ (చలికాలం)",
    zaid: "జైద్ (వేసవి)",
    get_recommendation: "సిఫార్సు పొందండి",
    recommended_crops: "సిఫార్సు చేయబడిన పంటలు",
    yield: "దిగుబడి",
    duration: "కాలం",
    market_price: "మార్కెట్ ధర",

    // DISEASE DETECTION
    healthy: "ఆరోగ్యంగా ఉంది",
    healthy_msg: "మీ మొక్క ఆరోగ్యంగా ఉంది! ఇలాగే కొనసాగించండి.",
    leaf_blight: "ఆకు మచ్చ తెగులు / తుప్పు తెగులు",
    leaf_blight_obs: "ఆకులపై గోధుమ-ఎరుపు మచ్చలు గుర్తించబడ్డాయి, ఇది ఆకు మచ్చ తెగులు కావచ్చు.",
    leaf_blight_cure: "మాంకోజెబ్ లేదా క్లోరోథాలనిల్ ఫంగిసైడ్ పిచికారీ చేయండి. వ్యాధి సోకిన ఆకులను వెంటనే తొలగించండి.",
    powdery_mildew: "బూజు తెగులు",
    powdery_mildew_obs: "ఆకులపై తెల్లటి పొడి మచ్చలు గుర్తించబడ్డాయి.",
    powdery_mildew_cure: "వేప నూనె లేదా సల్ఫర్ ఆధారిత ఫంగిసైడ్ పిచికారీ చేయండి. గాలి ప్రసరణను మెరుగుపరచండి.",
    unknown_disease: "తెలియని సమస్య",
    unknown_msg: "వ్యాధిని కచ్చితంగా గుర్తించలేకపోయాము. దయచేసి నిపుణుడిని సంప్రదించండి.",

    // FARMING TIPS (CROPS)
    rice: "వరి",
    wheat: "గోధుమ",
    cotton: "పత్తి",
    sugarcane: "చెరకు",
    maize: "మొక్కజొన్న",
    chilli: "మిరప",
    tomato: "టమాటా",
    potato: "బంగాళాదుంప",
    onion: "ఉల్లిపాయ",
    groundnut: "వేరుశెనగ",
    soybean: "సోయాబీన్",
    mustard: "ఆవాలు",
    turmeric: "పసుపు",
    sunflower: "పొద్దుతిరుగుడు",
    bengal_gram: "శనగలు",
    red_gram: "కందులు",
    black_gram: "మినుములు",
    green_gram: "పెసలు",
    jowar: "జొన్నలు",
    bajra: "సజ్జలు",
    ragi: "రాగులు",
    tobacco: "పొగాకు",
    chickpea: "సెనగ",
    millets: "సిరిధాన్యాలు",
    watermelon: "పుచ్చకాయ",
    sesame: "నువ్వులు",
    cucumber: "దోసకాయ",
    okra: "బెండకాయ",
    castor: "ఆముదం",
    coriander: "ధనియాలు",
    muskmelon: "ఖర్బూజా",
    mango: "మామిడి",
    banana: "అరటి",
    guava: "జామ",
    papaya: "బొప్పాయి",
    pomegranate: "దానిమ్మ",
    lemon: "నిమ్మ",
    rose: "గులాబీ",
    marigold: "బంతి పువ్వు",
    jasmine: "మల్లె పువ్వు",
    chrysanthemum: "చామంతి",
    tuberose: "నెల సంపెంగ",

    // MARKET PRICES
    commodity: "సరుకు",
    market: "మార్కెట్",
    price: "ధర (₹/క్వింటాల్)",
    trend: "ధోరణి",

    // GOVT SCHEMES
    pm_kisan: "పీఎం కిసాన్",
    pm_kisan_desc: "రైతులకు ఏడాదికి ₹6,000 ఆర్థిక సాయం.",
    rythu_bandhu: "రైతు బంధు",
    rythu_bandhu_desc: "వ్యవసాయ మరియు ఉద్యాన పంటలకు పెట్టుబడి సాయం.",
    pmfby: "ఫసల్ బీమా యోజన",
    pmfby_desc: "పంట నష్టపోతే బీమా సౌకర్యం.",
    kcc: "కిసాన్ క్రెడిట్ కార్డ్ (KCC)",
    kcc_desc: "తక్కువ వడ్డీకి రైతులకు రుణాలు.",
    shc: "సాయిల్ హెల్త్ కార్డ్",
    shc_desc: "నేల పోషకాల స్థితి మరియు ఎరువుల సిఫార్సులు.",
    enam: "ఈ-నామ్ (e-NAM)",
    enam_desc: "వ్యవసాయ సరుకుల ఆన్‌లైన్ ట్రేడింగ్ ప్లాట్‌ఫారమ్.",
    pmksy: "పీఎం కృషి సించాయీ యోజన",
    pmksy_desc: "మైక్రో ఇరిగేషన్ మరియు నీటి వినియోగ సామర్థ్యానికి మద్దతు.",
    rkvy: "ఆర్‌కేవీవై",
    rkvy_desc: "రాష్ట్రాల వ్యవసాయాభివృద్ధి మరియు ఆవిష్కరణలకు నిధులు.",
    agri_infra: "వ్యవసాయ మౌలిక వసతుల నిధి",
    agri_infra_desc: "గోదాములు, కోల్డ్ చెయిన్, వ్యవసాయ మౌలిక వసతులకు రుణ మద్దతు.",
    nfsm: "జాతీయ ఆహార భద్రత మిషన్",
    nfsm_desc: "వరి, గోధుమ, పప్పు, సిరిధాన్యాల ఉత్పత్తి పెంపుకు మద్దతు.",
    smam: "ఎస్ఎమ్ఏఎం",
    smam_desc: "వ్యవసాయ యాంత్రీకరణ పరికరాల కొనుగోలుకు సబ్సిడీ మద్దతు.",
    state_horti: "తెలంగాణ ఉద్యాన పథకాలు",
    state_horti_desc: "పండ్లు, పూల సాగుకు రాష్ట్ర మద్దతు కార్యక్రమాలు.",
    visit_website: "అధికారిక వెబ్‌సైట్‌ను సందర్శించండి",

    // FERTILIZER CALC
    land_size: "భూమి విస్తీర్ణం (ఎకరాలు)",
    select_crop: "పంటను ఎంచుకోండి",
    calculate: "లెక్కించండి",
    fertilizer_req: "ఎరువుల అవసరాలు",
    urea: "యూరియా",
    dap: "డి.ఎ.పి (DAP)",
    mop: "ఎం.ఓ.పి (MOP)",

    // CHATBOT
    chat_placeholder: "పంటలు, తెగుళ్ల గురించి అడగండి...",
    chat_title: "వ్యవసాయ సహాయకుడు",
  }
};

type LanguageContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('en');

  const t = (key: string) => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}