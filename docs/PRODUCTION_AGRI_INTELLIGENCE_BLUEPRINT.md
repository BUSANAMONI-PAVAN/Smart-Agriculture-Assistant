# Smart Agriculture: Production Upgrade Blueprint

This document reflects the upgraded architecture implemented in this repository and the next production-ready rollout path.

## 1. Updated System Architecture

### Frontend (Web Farmer App)
- React + Vite + Tailwind
- API-driven modules: weather decisions, crop intelligence, disease AI, market intelligence, alerts
- Bilingual UX: English/Telugu
- Voice query support (Web Speech API)
- PWA assets available (`public/manifest.webmanifest`, `public/sw.js`)

### Backend (Modular API)
- Node.js + Express modular routes under `backend/src/modules`
- API domains:
  - `auth`, `profile`, `digitalTwin`, `lifecycle`, `assistant`
  - `weather`, `crops`, `disease`, `risk`, `market`, `marketplace`
  - `alerts`, `community`, `iot`, `data`, `transparency`, `admin`
- Scheduler-ready alerts orchestration (`alerts.scheduler.js`)
- AI-ready disease inference adapter (`disease.ai.js`)

### AI Layer
- Disease inference adapter supports external endpoint:
  - `AI_DISEASE_ENDPOINT`
  - `AI_DISEASE_API_KEY`
- Automatic fallback inference keeps farmer flow active in low-network conditions

### Mobile Readiness
- API-first contracts exposed in `src/services/api.ts`
- Same endpoints can be consumed from React Native/Flutter clients

## 2. Database Schema (Production Target)

Use PostgreSQL for production with these core tables:

1. `users`
- id, name, phone, email, password_hash, role, language, created_at

2. `farm_profiles`
- id, user_id, village, district, state, lat, lng, land_size_acres, irrigation_source

3. `soil_profiles`
- id, farm_profile_id, soil_type, ph, organic_carbon, npk_json, tested_at

4. `crop_cycles`
- id, user_id, crop_name, sowing_date, expected_harvest_date, stage, area_acres, status

5. `yield_records`
- id, user_id, crop_name, season, expected_yield_q, actual_yield_q, loss_percent, created_at

6. `disease_scans`
- id, user_id, crop_name, image_url, disease_key, confidence, level, source, cause, treatment_json, prevention_json, created_at

7. `weather_logs`
- id, user_id, lat, lng, provider, payload_json, rain_chance_24h, temp_max, temp_min, captured_at

8. `market_queries`
- id, user_id, commodity, district, modal_price, predicted_price, best_market, net_profit, created_at

9. `alerts`
- id, user_id, type, level, title, message, source, metadata_json, fingerprint, read, created_at

10. `activity_logs`
- id, user_id, action, module, metadata_json, ip, device, created_at

## 3. API Structure

### Core
- `GET /api/v1/health`

### Digital Twin + Lifecycle
- `GET /api/v1/digital-twin/profile`
- `PUT /api/v1/digital-twin/profile`
- `POST /api/v1/digital-twin/yield-records`
- `GET /api/v1/lifecycle/current`
- `POST /api/v1/lifecycle/register`

### AI Assistant
- `POST /api/v1/assistant/query`
- `GET /api/v1/assistant/history`

### Disease AI
- `POST /api/v1/disease/analyze`
- `POST /api/v1/disease/scans`
- `GET /api/v1/disease/history`

### Weather Intelligence
- `GET /api/v1/weather/current`

### Crop Intelligence
- `POST /api/v1/crops/recommend`
- `GET /api/v1/crops/recommend/history`

### Market Intelligence
- `GET /api/v1/market/prices`
- `POST /api/v1/market/queries`
- `GET /api/v1/market/queries/history`

### Alerts
- `GET /api/v1/alerts`
- `POST /api/v1/alerts/ingest`
- `POST /api/v1/alerts/schedule/tick`
- `GET /api/v1/alerts/debug`

### IoT + Data Pipeline
- `POST /api/v1/iot/sensors`
- `GET /api/v1/iot/advisory`
- `GET /api/v1/data/sources`
- `POST /api/v1/data/ingest/weather`
- `POST /api/v1/data/ingest/market`

## 4. AI Integration Flow (Implemented)

1. Farmer uploads leaf image in Disease Detection page.
2. Frontend pre-processes image (resize + JPEG compression) to reduce bandwidth.
3. Frontend sends base64 payload to `POST /api/v1/disease/analyze`.
4. Backend adapter (`disease.ai.js`) calls external AI endpoint if configured.
5. Model response is normalized to internal classes (`leaf_blight`, `powdery_mildew`, `rust`, `healthy`).
6. Confidence, cause, treatment, and prevention are returned.
7. Scan is stored in scan history.
8. Alert is generated only when dedupe/cooldown permits.

## 5. Mobile App Architecture Plan

### Option A: React Native
- Shared API layer package from existing endpoint contracts
- Camera upload for disease detection
- Push notifications using Firebase Cloud Messaging

### Option B: Flutter
- Dio + Retrofit for API
- Workmanager for periodic sync
- Local database (Hive/SQLite) for offline cache

### Mobile-first features
- Voice input query (farm assistant)
- Geolocation weather decisions
- Offline last-known advisory + tips/schemes cache

## 6. Scalable Folder Structure (Recommended)

```txt
apps/
  web-farmer/
  web-admin/
  mobile-farmer/
services/
  api/
  ai-inference/
packages/
  shared-types/
  shared-i18n/
  ui-kit/
infra/
  docker/
  ci-cd/
  monitoring/
```

## 7. Suggested Tech Stack Improvements

- Backend: Express + Zod + Prisma + PostgreSQL + Redis + BullMQ
- Auth: JWT access + refresh token rotation
- AI: FastAPI model service for image inference
- Monitoring: OpenTelemetry + Grafana + Sentry
- Storage: S3-compatible object storage for scan images
- Queue: BullMQ for scheduled alerts and ingestion jobs

## 8. Farmer Usability and Low-Internet Strategy

- Keep simple mode default in low-digital literacy clusters
- Compress images before upload
- Cache schemes/tips/last weather snapshot
- Use graceful fallback predictions when network is unavailable
- Prioritize "What to do today" tasks over raw data tables
