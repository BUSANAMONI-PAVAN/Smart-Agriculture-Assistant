# Smart Agriculture Backend (Production Scaffold)

This backend scaffold provides an API-first architecture for scaling the platform.

## Stack
- Node.js + Express
- PostgreSQL (Prisma schema included)
- JWT authentication
- Modular route structure

## Modules
- auth
- users / profile
- weather / advisory
- crops recommendation
- disease inference adapter (external AI endpoint + fallback)
- market / profit
- schemes
- alerts
- admin

## Disease AI Integration
- Endpoint: `POST /api/v1/disease/analyze`
- Configure external model with:
  - `AI_DISEASE_ENDPOINT`
  - `AI_DISEASE_API_KEY` (optional)
  - `AI_DISEASE_TIMEOUT_MS` (optional)
- If model endpoint is unavailable, backend uses fallback inference so farmer flow is not blocked.

## Run (after adding backend package.json + dependencies)
1. Install dependencies.
2. Configure `.env`.
3. Run migrations.
4. Start server.

This project intentionally keeps backend as scaffold so frontend can continue building in this repository without breaking Vite build.