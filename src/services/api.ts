import { API_BASE_URL } from '../config/backend';

export type ApiResponse<T> = {
  data: T;
  source: 'api' | 'cache';
};

const API_BASE = API_BASE_URL;

export type UserRole = 'admin' | 'farmer';
export type AlertType = 'weather' | 'disease' | 'crop' | 'lifecycle' | 'market' | 'system';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  status: 'active' | 'disabled';
  adminEnabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  location: string;
};

export type FeatureFlag = {
  key: string;
  title: string;
  description: string;
  enabled: boolean;
  updatedAt?: string;
  updatedBy?: string;
};

export type LoginPayload = {
  role: 'admin' | 'farmer';
  identifier: string;
  password: string;
};

export type RegisterPayload = {
  role: 'admin' | 'farmer';
  name: string;
  email: string;
  phone: string;
  password: string;
  location?: string;
  landSizeAcres?: number;
  adminInviteKey?: string;
};

export type AuthSessionResponse = {
  token: string;
  user: AuthUser;
  features: FeatureFlag[];
  message?: string;
};

export type FarmerRegisterPayload = {
  name: string;
  phone: string;
};

export type FarmerLoginPayload = {
  phone: string;
};

export type AdminRegisterPayload = {
  name: string;
  email: string;
  password: string;
};

export type AdminLoginPayload = {
  email: string;
  password: string;
};

export type OtpChallengeResponse = {
  message: string;
  otpSessionToken: string;
  delivered: boolean;
  deliveryError: string | null;
  recipientEmail?: string | null;
};

export type AuditLogEntry = {
  id: string;
  actorUserId: string;
  targetUserId: string | null;
  action: string;
  detail: string;
  payload?: Record<string, unknown> | null;
  createdAt: string;
};

export type EmailLogEntry = {
  id: string;
  to: string;
  subject: string;
  category: string;
  transport: string;
  messageId: string | null;
  delivered: boolean;
  errorMessage: string | null;
  payloadPreview: string;
  createdAt: string;
};

export type AdminConsoleResponse = {
  stats: {
    totalUsers: number;
    admins: number;
    farmers: number;
    disabledUsers: number;
    adminAccessDisabled: number;
    totalAlerts: number;
    enabledFeatures: number;
  };
  users: AuthUser[];
  features: FeatureFlag[];
  alerts: Array<{
    id: string;
    userId: string;
    type: AlertType;
    level: 'low' | 'medium' | 'high';
    title: string;
    message: string;
    source: string;
    metadata: Record<string, unknown>;
    read: boolean;
    createdAt: string;
  }>;
  auditLog: AuditLogEntry[];
  emailLog: EmailLogEntry[];
  currentUser: AuthUser;
};

export type CropRecommendationPayload = {
  soilType: string;
  season: string;
  temperatureC: number;
  rainfallMm: number;
  landSizeAcres: number;
};

export type CropRecommendationResult = {
  querySummary: {
    soilType: string;
    season: string;
    temperatureC: number;
    rainfallMm: number;
    landSizeAcres: number;
  };
  recommendations: Array<{
    cropKey: string;
    cropLabel: string;
    suitabilityScore: number;
    riskLevel: 'Low' | 'Medium' | 'High';
    expectedYieldQPerAcre: string;
    requiredWater: string;
    requiredFertilizer: string;
    whyRecommended: string;
    riskNote: string;
    economics: {
      marketPricePerQuintal: number;
      estimatedCost: number;
      grossIncome: number;
      netProfit: number;
    };
  }>;
  advisory: string[];
};

export type CropQueryHistoryItem = {
  id: string;
  userId: string;
  createdAt: string;
  input: CropRecommendationPayload;
  topCrop: string;
};

export type WeatherDecisionResponse = {
  city: string;
  latitude: number;
  longitude: number;
  current: {
    tempC: number;
    feelsLikeC: number;
    humidity: number;
    windKmph: number;
    weatherCode: number;
    weatherLabel: string;
  };
  forecast: {
    rainChance24h: number;
    rainMm24h: number;
    rainMm7d: number;
    maxTemp: number;
    minTemp: number;
  };
  decisions: {
    irrigationRecommendation: {
      status: 'hold' | 'normal' | 'increase';
      message: string;
    };
    heatAlert: {
      severity: 'medium' | 'high';
      message: string;
      protectionTips: string[];
    } | null;
    sowingWindow: {
      status: 'good' | 'watch' | 'poor';
      message: string;
      bestDays: string[];
    };
    todayActions: string[];
    alerts: Array<{
      type: AlertType;
      level: 'low' | 'medium' | 'high';
      title: string;
      message: string;
    }>;
  };
  fetchedAt: string;
  source: string;
};

export type MarketIntelligenceParams = {
  commodity: string;
  lat?: number;
  lng?: number;
  areaAcres: number;
  costPerAcre: number;
};

export type MarketIntelligenceResponse = {
  commodity: string;
  updatedAt: string;
  yieldQPerAcre: number;
  trendSeries: Array<{
    date: string;
    avgPrice: number;
    predictedPrice: number | null;
  }>;
  futurePrediction: number;
  bestMarket: {
    market: string;
    district: string;
    state: string;
    distanceKm: number | null;
    modalPrice: number;
    trend7d: number;
    predictedPrice7d: number;
    economics: {
      effectiveSellPrice: number;
      grossIncome: number;
      totalCost: number;
      netProfit: number;
    };
  } | null;
  markets: Array<{
    market: string;
    district: string;
    state: string;
    latitude: number;
    longitude: number;
    modalPrice: number;
    minPrice: number;
    maxPrice: number;
    trend7d: number;
    predictedPrice7d: number;
    predictionConfidence: number;
    distanceKm: number | null;
    requiredYieldQPerAcre: number;
    recommended: boolean;
    economics: {
      effectiveSellPrice: number;
      grossIncome: number;
      totalCost: number;
      netProfit: number;
    };
    series: Array<{ date: string; price: number }>;
  }>;
  insights: string[];
};

export type MarketQueryHistoryItem = {
  id: string;
  userId: string;
  commodity: string;
  lat: number;
  lng: number;
  areaAcres: number;
  costPerAcre: number;
  bestMarket: string | null;
  bestNetProfit: number | null;
  createdAt: string;
};

export type DiseaseScanPayload = {
  crop?: string;
  diseaseKey: string;
  confidence: number;
  level: 'low' | 'medium' | 'high';
  imageUrl?: string | null;
  notes?: string;
};

export type DiseaseAnalyzeResponse = {
  prediction: {
    diseaseKey: string;
    diseaseName: string;
    confidence: number;
    cause: string;
    treatment: string[];
    prevention: string[];
    level: 'low' | 'medium' | 'high';
    source: string;
  };
  scan: {
    id: string;
    userId: string;
    crop: string;
    diseaseKey: string;
    confidence: number;
    level: 'low' | 'medium' | 'high';
    imageUrl: string | null;
    notes: string;
    createdAt: string;
  };
};

export type AlertsDebugResponse = {
  scheduler: {
    running: boolean;
    intervalMs: number;
    lastRunAt: string | null;
    nextRunAt: string | null;
    lastSummary: {
      profilesProcessed: number;
      alertsCreated: number;
      bySource: {
        lifecycle: number;
        personalized: number;
        weather: number;
        disease: number;
      };
    };
  };
  store: {
    alertCount: number;
    dedupeCount: number;
    latestAlerts: Array<{
      id: string;
      userId: string;
      type: string;
      level: string;
      title: string;
      message: string;
      source: string;
      metadata: Record<string, unknown>;
      read: boolean;
      createdAt: string;
    }>;
    dedupeEntries: Array<{
      fingerprint: string;
      type: string;
      source: string;
      lastAt: string;
      nextEligibleAt: string;
      remainingMinutes: number;
    }>;
  };
};

export type DigitalTwinResponse = {
  userId: string;
  landProfile: {
    village: string;
    district: string;
    state: string;
    latitude: number;
    longitude: number;
    landSizeAcres: number;
    irrigationSource: string;
    soilType: string;
    soilPh: number;
    soilOrganicCarbon: number;
  };
  seasonalPatterns: {
    kharifRainfallMm: number;
    rabiRainfallMm: number;
    avgSummerTempC: number;
  };
  cropHistory: Array<{
    season: string;
    crop: string;
    areaAcres: number;
    yieldQPerAcre: number;
  }>;
  yieldRecords: Array<{
    crop: string;
    season: string;
    expectedYieldQ: number;
    actualYieldQ: number;
    lossPercent: number;
    createdAt?: string;
  }>;
  updatedAt: string;
};

export type LifecycleSnapshotResponse = {
  generatedAt: string;
  cycles: Array<{
    id: string;
    crop: string;
    sowingDate: string;
    areaAcres: number;
    expectedHarvestDate: string;
    dayAge: number;
    stage: string;
    progress: number;
    nextStage: string;
    tasks: string[];
    reasoning: string;
    confidence: number;
  }>;
};

export type AssistantQueryResponse = {
  question: string;
  answer: string;
  confidence: number;
  reasoning: string;
  dataSources: string[];
  generatedAt: string;
};

export type AiChatResponse = {
  id: string | null;
  answer: string;
  model: string;
  provider: string;
  level: 'low' | 'medium' | 'high';
  weatherSummary: {
    provider: string;
    city: string;
    tempC: number;
    feelsLikeC: number;
    humidity: number;
    windKmph: number;
    rainChance24h: number;
    rainMm24h: number;
    maxTempC: number;
    minTempC: number;
    condition: string;
  } | null;
  generatedAt: string;
};

export type AiChatHistoryItem = {
  id: string;
  userId: string;
  question: string;
  answer: string;
  model: string;
  weatherSummary: AiChatResponse['weatherSummary'];
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type RiskScoreResponse = {
  crop: string;
  generatedAt: string;
  riskScore: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  components: {
    weatherRisk: number;
    diseaseRisk: number;
    marketRisk: number;
  };
  prediction: {
    baselineYieldQPerAcre: number;
    predictedYieldQPerAcre: number;
    potentialLossPercent: number;
    scenario: string;
  };
  confidence: number;
  reasoning: string[];
  sources: string[];
};

export type DataPipelineResponse = {
  sources: Array<{ key: string; status: string }>;
  normalized: {
    weather: { payload: Record<string, unknown>; at: string } | null;
    market: { payload: Record<string, unknown>; at: string } | null;
    soil: { payload: Record<string, unknown>; at: string } | null;
  };
  logs: Array<{
    id: string;
    source: string;
    status: string;
    detail?: string;
    at: string;
  }>;
};

export type MarketplaceItem = {
  id: string;
  name: string;
  price: number;
  unit: string;
  type?: string;
  availability?: string;
};

export type CommunityPost = {
  id: string;
  userId: string;
  text: string;
  imageUrl: string | null;
  tags: string[];
  status: string;
  createdAt: string;
};

type ApiRequestInit = RequestInit & {
  auth?: boolean;
};

function resolveProxyFailureMessage(response: Response, contentType: string, responseText: string) {
  if (response.status < 500) {
    return null;
  }

  const raw = String(responseText || '').toLowerCase();
  const looksLikeProxyFailure = !contentType.includes('application/json')
    && (
      raw.includes('proxy')
      || raw.includes('econnrefused')
      || raw.includes('connect etimedout')
      || raw.includes('socket hang up')
      || raw.trim().length === 0
    );

  if (!looksLikeProxyFailure) {
    return null;
  }

  return 'Backend API is not reachable. Run `npm run dev:fullstack` and try again.';
}

async function request<T>(path: string, init?: ApiRequestInit): Promise<T> {
  const requiresAuth = init?.auth !== false;
  const token = localStorage.getItem('accessToken');
  let response: Response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(requiresAuth && token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers || {}),
      },
    });
  } catch {
    throw new Error('Unable to reach the backend. Please make sure the API server is running.');
  }

  if (!response.ok) {
    let message = `API error: ${response.status}`;
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    let responseText = '';

    try {
      if (contentType.includes('application/json')) {
        const errorPayload = (await response.json()) as { message?: string };
        if (errorPayload?.message) {
          message = errorPayload.message;
        }
      } else {
        responseText = await response.text();
      }
    } catch {
      // Keep default status message when the response body is empty.
    }

    const proxyFailureMessage = resolveProxyFailureMessage(response, contentType, responseText);
    if (proxyFailureMessage) {
      message = proxyFailureMessage;
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}

export const api = {
  getCurrentSession: () => request<{ user: AuthUser; features: FeatureFlag[] }>('/auth/me'),
  logout: () => request<{ message: string }>('/auth/logout', { method: 'POST' }),
  farmerRegister: (payload: FarmerRegisterPayload) =>
    request<AuthSessionResponse>('/auth/farmer/register', { method: 'POST', body: JSON.stringify(payload), auth: false }),
  farmerLogin: (payload: FarmerLoginPayload) =>
    request<AuthSessionResponse>('/auth/farmer/login', { method: 'POST', body: JSON.stringify(payload), auth: false }),
  adminRegister: (payload: AdminRegisterPayload) =>
    request<OtpChallengeResponse>('/auth/admin/register', { method: 'POST', body: JSON.stringify(payload), auth: false }),
  adminLogin: (payload: AdminLoginPayload) =>
    request<OtpChallengeResponse>('/auth/admin/login', { method: 'POST', body: JSON.stringify(payload), auth: false }),
  verifyAdminOtp: (payload: { otpSessionToken: string; otp: string }) =>
    request<AuthSessionResponse>('/otp/admin/verify', { method: 'POST', body: JSON.stringify(payload), auth: false }),
  resendAdminOtp: (payload: { otpSessionToken: string }) =>
    request<OtpChallengeResponse>('/otp/admin/resend', { method: 'POST', body: JSON.stringify(payload), auth: false }),
  requestAdminActionOtp: (purpose: string) =>
    request<OtpChallengeResponse>('/otp/admin/request', { method: 'POST', body: JSON.stringify({ purpose }) }),
  verifyAdminActionOtp: (payload: { otpSessionToken: string; otp: string }) =>
    request<{ otpProofToken: string }>('/otp/admin/verify-action', { method: 'POST', body: JSON.stringify(payload) }),
  updateAdminProfile: (payload: { name?: string; email?: string; password?: string; otpProofToken: string }) =>
    request<{ message: string; user: AuthUser }>('/auth/admin/profile', { method: 'PATCH', body: JSON.stringify(payload) }),
  getProfile: () => request('/profile/me'),
  updateProfile: (payload: unknown) => request('/profile/me', { method: 'PUT', body: JSON.stringify(payload) }),
  getWeatherDecision: (lat: number, lng: number, crop?: string) =>
    request<WeatherDecisionResponse>(`/weather/current?lat=${lat}&lng=${lng}${crop ? `&crop=${encodeURIComponent(crop)}` : ''}`),
  recommendCrop: (payload: CropRecommendationPayload) =>
    request<CropRecommendationResult>('/crops/recommend', { method: 'POST', body: JSON.stringify(payload) }),
  getCropRecommendationHistory: () => request<{ history: CropQueryHistoryItem[] }>('/crops/recommend/history'),
  getMarketIntelligence: (params: MarketIntelligenceParams) => {
    const query = new URLSearchParams({
      commodity: params.commodity,
      areaAcres: String(params.areaAcres),
      costPerAcre: String(params.costPerAcre),
    });
    if (typeof params.lat === 'number') query.set('lat', String(params.lat));
    if (typeof params.lng === 'number') query.set('lng', String(params.lng));
    return request<MarketIntelligenceResponse>(`/market/prices?${query.toString()}`);
  },
  saveMarketQuery: (payload: MarketIntelligenceParams) => request('/market/queries', { method: 'POST', body: JSON.stringify(payload) }),
  getMarketQueryHistory: () => request<{ history: MarketQueryHistoryItem[] }>('/market/queries/history'),
  getSchemes: () => request('/schemes'),
  analyzeDisease: (payload: { imageData: string; crop?: string }) =>
    request<DiseaseAnalyzeResponse>('/disease/analyze', { method: 'POST', body: JSON.stringify(payload) }),
  logDiseaseScan: (payload: DiseaseScanPayload) => request('/disease/scans', { method: 'POST', body: JSON.stringify(payload) }),
  getDiseaseHistory: () => request<{ scans: Array<{
    id: string;
    userId: string;
    crop: string;
    diseaseKey: string;
    confidence: number;
    level: 'low' | 'medium' | 'high';
    createdAt: string;
  }> }>('/disease/history'),
  getAlerts: () => request<{ alerts: Array<{
    id: string;
    userId: string;
    type: AlertType;
    level: 'low' | 'medium' | 'high';
    title: string;
    message: string;
    source: string;
    metadata: Record<string, unknown>;
    read: boolean;
    createdAt: string;
  }> }>('/alerts'),
  markAlertRead: (id: string) => request(`/alerts/${id}/read`, { method: 'PATCH' }),
  triggerAlertScheduleTick: () => request('/alerts/schedule/tick', { method: 'POST' }),
  getAlertsDebug: () => request<AlertsDebugResponse>('/alerts/debug'),
  ingestAlert: (payload: {
    type: AlertType;
    level: 'low' | 'medium' | 'high';
    title: string;
    message: string;
    source?: string;
    metadata?: Record<string, unknown>;
  }) => request('/alerts/ingest', { method: 'POST', body: JSON.stringify(payload) }),
  getDigitalTwin: () => request<DigitalTwinResponse>('/digital-twin/profile'),
  updateDigitalTwin: (payload: Partial<DigitalTwinResponse>) =>
    request<{ message: string; data: DigitalTwinResponse }>('/digital-twin/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  addYieldRecord: (payload: {
    crop: string;
    season: string;
    expectedYieldQ: number;
    actualYieldQ: number;
    lossPercent: number;
  }) => request('/digital-twin/yield-records', { method: 'POST', body: JSON.stringify(payload) }),
  registerLifecycleCrop: (payload: { crop: string; sowingDate: string; areaAcres: number; expectedHarvestDate?: string }) =>
    request('/lifecycle/register', { method: 'POST', body: JSON.stringify(payload) }),
  getLifecycle: () => request<LifecycleSnapshotResponse>('/lifecycle/current'),
  askAssistant: (message: string) =>
    request<AssistantQueryResponse>('/assistant/query', { method: 'POST', body: JSON.stringify({ message }) }),
  getAssistantHistory: () => request<{ history: Array<{ id: string; question: string; answer: string; confidence: number; createdAt: string }> }>('/assistant/history'),
  askAi: (payload: { query: string; lat?: number; lng?: number; crop?: string; emitAlert?: boolean }) =>
    request<AiChatResponse>('/ai/ask', { method: 'POST', body: JSON.stringify(payload) }),
  getAiHistory: (limit = 40) => request<{ history: AiChatHistoryItem[] }>(`/ai/history?limit=${Math.min(Math.max(limit, 1), 200)}`),
  getRiskScore: (crop: string, lat?: number, lng?: number) => {
    const query = new URLSearchParams({ crop });
    if (typeof lat === 'number') query.set('lat', String(lat));
    if (typeof lng === 'number') query.set('lng', String(lng));
    return request<RiskScoreResponse>(`/risk/score?${query.toString()}`);
  },
  getDataSources: () => request<DataPipelineResponse>('/data/sources'),
  ingestWeatherData: (lat: number, lng: number) => request('/data/ingest/weather', { method: 'POST', body: JSON.stringify({ lat, lng }) }),
  ingestMarketData: (commodity: string) => request('/data/ingest/market', { method: 'POST', body: JSON.stringify({ commodity }) }),
  getMarketplaceInputs: () => request<{ items: MarketplaceItem[] }>('/marketplace/inputs'),
  getMarketplaceRentals: () => request<{ items: MarketplaceItem[] }>('/marketplace/rentals'),
  createMarketplaceOrder: (payload: { itemId: string; quantity: number; orderType: 'input' | 'rental' }) =>
    request('/marketplace/orders', { method: 'POST', body: JSON.stringify(payload) }),
  getMarketplaceOrders: () => request<{ orders: Array<{ id: string; itemId: string; quantity: number; orderType: string; status: string; createdAt: string }> }>('/marketplace/orders'),
  getCommunityPosts: () => request<{ posts: CommunityPost[] }>('/community/posts'),
  createCommunityPost: (payload: { text: string; imageUrl?: string; tags?: string[] }) =>
    request('/community/posts', { method: 'POST', body: JSON.stringify(payload) }),
  ingestSensorData: (payload: { soilMoisture: number; airTempC: number; soilTempC: number; humidity: number; source?: string }) =>
    request('/iot/sensors', { method: 'POST', body: JSON.stringify(payload) }),
  getIotAdvisory: () => request<{ advisory: { action: string; message: string; confidence: number }; reading: Record<string, unknown> | null; source: string; generatedAt: string }>('/iot/advisory'),
  getTransparencySources: () => request<{ modules: Array<{ module: string; sources: string[]; confidenceRange: string }>; generatedAt: string }>('/transparency/sources'),
  getAdminConsole: () => request<AdminConsoleResponse>('/admin/console'),
  createAdminUser: (payload: RegisterPayload, otpProofToken: string) =>
    request<{ message: string; user: AuthUser }>('/admin/users', {
      method: 'POST',
      body: JSON.stringify({ ...payload, otpProofToken }),
    }),
  updateAdminUser: (
    userId: string,
    payload: Partial<AuthUser> & { role?: 'admin' | 'farmer'; adminEnabled?: boolean },
    otpProofToken: string,
  ) =>
    request<{ message: string; user: AuthUser }>(`/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ ...payload, otpProofToken }),
    }),
  deleteAdminUser: (userId: string, otpProofToken: string) =>
    request<{ message: string; user: AuthUser }>(`/admin/users/${userId}`, {
      method: 'DELETE',
      body: JSON.stringify({ otpProofToken }),
    }),
  deleteAdminNotification: (notificationId: string, otpProofToken: string) =>
    request<{ message: string; notification: {
      id: string;
      userId: string;
      title: string;
      message: string;
      type: AlertType;
      level: 'low' | 'medium' | 'high';
      source: string;
      metadata: Record<string, unknown>;
      read: boolean;
      createdAt: string;
    } }>(`/admin/notifications/${notificationId}`, {
      method: 'DELETE',
      body: JSON.stringify({ otpProofToken }),
    }),
  updateFeatureFlags: (features: Array<{ key: string; enabled: boolean }>, otpProofToken: string) =>
    request<{ message: string; features: FeatureFlag[] }>('/admin/features', {
      method: 'PUT',
      body: JSON.stringify({ features, otpProofToken }),
    }),
};
