import { GoogleGenerativeAI } from '@google/generative-ai';

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const SECONDARY_MODEL = process.env.GEMINI_SECONDARY_MODEL || 'gemini-2.0-flash-lite';
const FALLBACK_MODELS = [
  DEFAULT_MODEL,
  SECONDARY_MODEL,
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash-latest',
  'gemini-1.5-flash',
];
const MAX_RETRIES_PER_MODEL = Number(process.env.GEMINI_MAX_RETRIES || 2);

let client = null;

function getClient() {
  if (client) {
    return client;
  }

  const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    return null;
  }

  client = new GoogleGenerativeAI(apiKey);
  return client;
}

function compact(value, fallback = 'Not available') {
  const text = String(value || '').trim();
  return text || fallback;
}

function buildPrompt({ query, user, weatherSummary, crop }) {
  const weatherSection = weatherSummary
    ? `Weather:
- City: ${compact(weatherSummary.city)}
- Temperature: ${compact(weatherSummary.tempC)} C
- Feels like: ${compact(weatherSummary.feelsLikeC)} C
- Humidity: ${compact(weatherSummary.humidity)}%
- Wind: ${compact(weatherSummary.windKmph)} km/h
- Rain chance (24h): ${compact(weatherSummary.rainChance24h)}%
- Rain expected (24h): ${compact(weatherSummary.rainMm24h)} mm
- Condition: ${compact(weatherSummary.condition)}
`
    : 'Weather: Not available\n';

  return `
You are an expert agriculture advisor for Indian farming conditions.
Keep answers practical, concise, and field-ready.
Always return:
1) A direct answer.
2) A numbered list of action steps.
3) A short risk warning section.
4) A "When to act next" line.

User profile:
- Role: ${compact(user.role)}
- Name: ${compact(user.name)}
- Primary crop: ${compact(crop)}

${weatherSection}

User question:
${query}
`.trim();
}

function fallbackAnswer({ query, weatherSummary, crop }) {
  const risk = weatherSummary?.rainChance24h >= 70
    ? 'High rain risk in the next 24 hours. Avoid over-irrigation and clear drainage.'
    : weatherSummary?.tempC >= 38
      ? 'Heat stress risk is elevated. Protect root moisture and avoid noon spray.'
      : 'No severe immediate weather threat detected.';

  return `
Direct answer:
${query}

Action steps:
1. Check soil moisture before irrigation and avoid fixed-time watering.
2. Inspect ${crop || 'the current crop'} for pest and disease symptoms in the evening.
3. Record market prices and input use for this week to guide next decisions.

Risk warning:
${risk}

When to act next:
Review field conditions again in the next 12-24 hours.
`.trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractStatusCode(error) {
  const direct = Number(error?.status || error?.code);
  if (Number.isFinite(direct) && direct > 0) {
    return direct;
  }
  const match = String(error?.message || '').match(/\b(4\d\d|5\d\d)\b/);
  return match ? Number(match[1]) : null;
}

function isQuotaError(error) {
  const detail = String(error?.message || '').toLowerCase();
  return (
    detail.includes('quota')
    || detail.includes('resource exhausted')
    || detail.includes('rate limit')
    || extractStatusCode(error) === 429
  );
}

function isTransientError(error) {
  const statusCode = extractStatusCode(error);
  if (statusCode && statusCode >= 500) {
    return true;
  }
  const detail = String(error?.message || '').toLowerCase();
  return detail.includes('timeout') || detail.includes('temporar') || detail.includes('unavailable');
}

async function runModelWithRetry(client, modelName, prompt) {
  let lastError = null;
  for (let attempt = 0; attempt <= MAX_RETRIES_PER_MODEL; attempt += 1) {
    try {
      const model = client.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const answer = result?.response?.text()?.trim();
      if (!answer) {
        throw new Error('Gemini returned an empty response.');
      }
      return { answer, quotaExceeded: false };
    } catch (error) {
      lastError = error;
      if (isQuotaError(error)) {
        return { answer: null, quotaExceeded: true, error };
      }
      if (!isTransientError(error) || attempt === MAX_RETRIES_PER_MODEL) {
        break;
      }
      await sleep(350 * (attempt + 1));
    }
  }
  throw lastError || new Error('Gemini request failed.');
}

export async function generateGeminiFarmingAnswer({ query, user, weatherSummary, crop }) {
  const activeClient = getClient();
  if (!activeClient) {
    return {
      answer: fallbackAnswer({ query, weatherSummary, crop }),
      model: 'local-fallback',
      provider: 'rules',
    };
  }

  try {
    let lastError = null;
    let quotaExceeded = false;
    const prompt = buildPrompt({ query, user, weatherSummary, crop });
    for (const modelName of [...new Set(FALLBACK_MODELS)]) {
      try {
        const result = await runModelWithRetry(activeClient, modelName, prompt);
        if (result.answer) {
          return {
            answer: result.answer,
            model: modelName,
            provider: 'gemini',
          };
        }
        quotaExceeded = quotaExceeded || Boolean(result.quotaExceeded);
        if (result.error) {
          lastError = result.error;
        }
        continue;
      } catch (error) {
        lastError = error;
        const detail = String(error?.message || '').toLowerCase();
        if (!detail.includes('not found') && !detail.includes('unsupported')) {
          throw error;
        }
      }
    }
    throw lastError || new Error(quotaExceeded ? 'Gemini quota exceeded.' : 'No compatible Gemini model was found.');
  } catch (error) {
    const quotaExceeded = isQuotaError(error);
    return {
      answer: fallbackAnswer({ query, weatherSummary, crop }),
      model: 'local-fallback',
      provider: 'rules',
      quotaExceeded,
      detail: error?.message || null,
    };
  }
}
