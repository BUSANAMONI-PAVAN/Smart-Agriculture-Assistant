import { listProfiles } from '../profile/profile.store.js';
import { addAlert, shouldStoreAlert } from './alerts.store.js';
import {
  buildDiseaseFollowUpAlerts,
  buildLifecycleAlerts,
  buildPersonalizedRecommendation,
  classifyIrrigationAlert,
} from './alerts.rules.js';
import { listRecentHighRiskScans } from '../disease/disease.store.js';

let timer = null;
let schedulerIntervalMs = 10 * 60 * 1000;
let lastRunAt = null;
let nextRunAt = null;
let lastSummary = {
  profilesProcessed: 0,
  alertsCreated: 0,
  bySource: {
    lifecycle: 0,
    personalized: 0,
    weather: 0,
    disease: 0,
  },
};

async function fetchWeatherSignals(lat, lng) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=precipitation_probability,precipitation&daily=temperature_2m_max&forecast_days=2&timezone=auto`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('weather provider unavailable');
  }

  const payload = await response.json();
  const chance = payload.hourly?.precipitation_probability || [];
  const rain = payload.hourly?.precipitation || [];
  const rainChance24h = chance.length ? Math.max(...chance.slice(0, 24)) : 0;
  const rainMm24h = rain.slice(0, 24).reduce((sum, item) => sum + Number(item || 0), 0);
  const maxTemp = Number(payload.daily?.temperature_2m_max?.[0] || 30);

  return {
    rainChance24h: Math.round(rainChance24h),
    rainMm24h: Math.round(rainMm24h * 10) / 10,
    maxTemp: Math.round(maxTemp),
  };
}

async function generateScheduledAlerts() {
  const profiles = await listProfiles();
  const runSummary = {
    profilesProcessed: profiles.length,
    alertsCreated: 0,
    bySource: {
      lifecycle: 0,
      personalized: 0,
      weather: 0,
      disease: 0,
    },
  };

  for (const profile of profiles) {
      try {
        const userId = profile.userId;
        const prefs = profile.notificationPreferences || {};

        if (prefs.lifecycle !== false) {
          const reminders = buildLifecycleAlerts(profile);
          for (const item of reminders) {
            const candidate = {
              ...item,
              userId,
              source: 'scheduler-lifecycle',
              metadata: {
                cropPlans: profile.cropPlans?.length || 0,
              },
            };
            if (shouldStoreAlert(candidate)) {
              const storedAlert = await addAlert(candidate);
              if (storedAlert) {
                runSummary.alertsCreated += 1;
                runSummary.bySource.lifecycle += 1;
              }
            }
          }
        }

        if (prefs.personalized !== false) {
          const personalized = buildPersonalizedRecommendation(profile);
          const candidate = {
            ...personalized,
            userId,
            source: 'scheduler-personalized',
          };
          if (shouldStoreAlert(candidate)) {
            const storedAlert = await addAlert(candidate);
            if (storedAlert) {
              runSummary.alertsCreated += 1;
              runSummary.bySource.personalized += 1;
            }
          }
        }

        if (prefs.weather !== false) {
          try {
            const forecast = await fetchWeatherSignals(profile.latitude || 17.385, profile.longitude || 78.4867);
            const weatherAlert = classifyIrrigationAlert(forecast);
            if (weatherAlert) {
              const candidate = {
                ...weatherAlert,
                userId,
                source: 'scheduler-weather',
                metadata: forecast,
              };
              if (shouldStoreAlert(candidate)) {
                const storedAlert = await addAlert(candidate);
                if (storedAlert) {
                  runSummary.alertsCreated += 1;
                  runSummary.bySource.weather += 1;
                }
              }
            }
          } catch {
            // Skip weather cycle if provider is unavailable.
          }
        }

        if (prefs.disease !== false) {
          const scans = listRecentHighRiskScans(userId, 48);
          if (scans.length) {
            const diseaseAlerts = buildDiseaseFollowUpAlerts(scans, profile);
            for (const item of diseaseAlerts) {
              const candidate = {
                ...item,
                userId,
                source: 'scheduler-disease',
                metadata: {
                  diseaseCount: scans.length,
                  latestScanAt: scans[0]?.createdAt,
                },
              };
              if (shouldStoreAlert(candidate)) {
                const storedAlert = await addAlert(candidate);
                if (storedAlert) {
                  runSummary.alertsCreated += 1;
                  runSummary.bySource.disease += 1;
                }
              }
            }
          }
        }
      } catch {
        // Skip this profile if a background alert step fails.
      }
  }

  lastRunAt = new Date().toISOString();
  nextRunAt = new Date(Date.now() + schedulerIntervalMs).toISOString();
  lastSummary = runSummary;
}

async function scheduleAlertGeneration() {
  try {
    await generateScheduledAlerts();
  } catch {
    lastRunAt = new Date().toISOString();
    nextRunAt = new Date(Date.now() + schedulerIntervalMs).toISOString();
  }
}

export function startAlertScheduler(intervalMs = 10 * 60 * 1000) {
  if (timer) return;
  schedulerIntervalMs = intervalMs;
  nextRunAt = new Date(Date.now() + schedulerIntervalMs).toISOString();
  void scheduleAlertGeneration();
  timer = setInterval(() => {
    void scheduleAlertGeneration();
  }, intervalMs);
}

export function stopAlertScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export async function runAlertSchedulerNow() {
  await generateScheduledAlerts();
}

export function getSchedulerDebugState() {
  return {
    running: Boolean(timer),
    intervalMs: schedulerIntervalMs,
    lastRunAt,
    nextRunAt,
    lastSummary,
  };
}
