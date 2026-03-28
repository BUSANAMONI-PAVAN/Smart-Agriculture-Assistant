import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Bot, LoaderCircle, Send, Sparkles, UserRound } from 'lucide-react';
import { api, type AiChatHistoryItem, type AiChatResponse } from '../services/api';

type ChatItem = {
  id: string;
  threadId: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
  level?: 'low' | 'medium' | 'high';
  weather?: AiChatResponse['weatherSummary'];
  model?: string;
  crop?: string;
};

const QUICK_PROMPTS = [
  'My paddy field may get heavy rain tomorrow. What should I do today?',
  'Give a 3-day action plan for cotton under high temperature.',
  'How do I prevent disease spread after sudden humidity rise?',
];

function readPrimaryCrop() {
  try {
    const raw = localStorage.getItem('farmerProfile');
    if (!raw) return '';
    const profile = JSON.parse(raw) as { crops?: string };
    return profile.crops?.split(',')[0]?.trim() || '';
  } catch {
    return '';
  }
}

function mapHistory(history: AiChatHistoryItem[]) {
  const rows: ChatItem[] = [];
  [...history].reverse().forEach((item) => {
    rows.push({
      id: `${item.id}-q`,
      threadId: item.id,
      role: 'user',
      text: item.question,
      createdAt: item.createdAt,
    });
    rows.push({
      id: `${item.id}-a`,
      threadId: item.id,
      role: 'assistant',
      text: item.answer,
      createdAt: item.createdAt,
      level: (item.metadata?.level as 'low' | 'medium' | 'high') || 'low',
      weather: item.weatherSummary || null,
      model: item.model,
      crop: typeof item.metadata?.crop === 'string' ? String(item.metadata.crop) : '',
    });
  });
  return rows;
}

function downloadTextFile(filename: string, mimeType: string, content: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function AIAssistant() {
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [severityFilter, setSeverityFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all');
  const [cropFilter, setCropFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const primaryCrop = useMemo(() => readPrimaryCrop(), []);

  const assistantRows = useMemo(() => messages.filter((item) => item.role === 'assistant'), [messages]);
  const cropOptions = useMemo(() => {
    const set = new Set<string>();
    assistantRows.forEach((item) => {
      const value = String(item.crop || '').trim();
      if (value) {
        set.add(value.toLowerCase());
      }
    });
    return ['all', ...Array.from(set)];
  }, [assistantRows]);

  const filteredThreadIds = useMemo(() => {
    const fromTs = fromDate ? Date.parse(`${fromDate}T00:00:00`) : null;
    const toTs = toDate ? Date.parse(`${toDate}T23:59:59`) : null;
    const ids = new Set<string>();

    assistantRows.forEach((row) => {
      if (severityFilter !== 'all' && row.level !== severityFilter) return;
      if (cropFilter !== 'all' && String(row.crop || '').toLowerCase() !== cropFilter) return;
      const rowTs = Date.parse(row.createdAt);
      if (fromTs && rowTs < fromTs) return;
      if (toTs && rowTs > toTs) return;
      ids.add(row.threadId);
    });

    return ids;
  }, [assistantRows, severityFilter, cropFilter, fromDate, toDate]);

  const hasActiveFilters = severityFilter !== 'all' || cropFilter !== 'all' || Boolean(fromDate) || Boolean(toDate);
  const visibleMessages = useMemo(
    () => (hasActiveFilters ? messages.filter((item) => filteredThreadIds.has(item.threadId)) : messages),
    [hasActiveFilters, filteredThreadIds, messages],
  );

  const exportRows = useMemo(
    () =>
      assistantRows
        .filter((row) => (!hasActiveFilters ? true : filteredThreadIds.has(row.threadId)))
        .map((row) => ({
          threadId: row.threadId,
          createdAt: row.createdAt,
          crop: row.crop || '',
          level: row.level || '',
          model: row.model || '',
          answer: row.text,
        })),
    [assistantRows, filteredThreadIds, hasActiveFilters],
  );

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        setCoords(null);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 600000 },
    );
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoadingHistory(true);
      try {
        const response = await api.getAiHistory(30);
        setMessages(mapHistory(response.history));
      } catch {
        setMessages([]);
      } finally {
        setLoadingHistory(false);
      }
    };

    void load();
  }, []);

  const sendPrompt = async (value: string) => {
    const text = value.trim();
    if (!text || loading) return;

    setError('');
    setLoading(true);

    const userRow: ChatItem = {
      id: `user-${Date.now()}`,
      threadId: `thread-${Date.now()}`,
      role: 'user',
      text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userRow]);
    setPrompt('');

    try {
      const response = await api.askAi({
        query: text,
        lat: coords?.lat,
        lng: coords?.lng,
        crop: primaryCrop || undefined,
      });

      const aiRow: ChatItem = {
        id: response.id ? `${response.id}-a` : `assistant-${Date.now()}`,
        threadId: userRow.threadId,
        role: 'assistant',
        text: response.answer,
        createdAt: response.generatedAt,
        level: response.level,
        weather: response.weatherSummary,
        model: response.model,
        crop: primaryCrop || '',
      };
      setMessages((prev) => [...prev, aiRow]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to fetch AI answer right now.');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void sendPrompt(prompt);
  };

  const exportAsJson = () => {
    const payload = JSON.stringify(exportRows, null, 2);
    downloadTextFile(`ai-chat-export-${new Date().toISOString().slice(0, 10)}.json`, 'application/json', payload);
  };

  const exportAsCsv = () => {
    const header = ['thread_id', 'created_at', 'crop', 'severity', 'model', 'answer'];
    const escape = (value: string) => `"${String(value || '').replace(/"/g, '""')}"`;
    const rows = exportRows.map((item) =>
      [item.threadId, item.createdAt, item.crop, item.level, item.model, item.answer].map((value) => escape(String(value))).join(','),
    );
    downloadTextFile(
      `ai-chat-export-${new Date().toISOString().slice(0, 10)}.csv`,
      'text/csv;charset=utf-8',
      [header.join(','), ...rows].join('\n'),
    );
  };

  return (
    <div className="container mx-auto max-w-6xl p-4">
      <section className="rounded-[28px] border border-[#d3e8cc] bg-[linear-gradient(130deg,#f7fff4_0%,#f0f8e8_50%,#edf8ff_100%)] p-5 shadow-[0_20px_45px_rgba(58,107,78,0.12)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.26em] text-[#4f7d4f]">Gemini AI Assistant</p>
            <h1 className="mt-2 text-3xl font-black text-[#1f3d24]">Ask farming questions in real time</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#4d6b4d]">
              Weather-aware AI guidance for crop planning, disease prevention, irrigation, and field decisions.
            </p>
          </div>
          <div className="rounded-full border border-[#b9d5b2] bg-white/80 px-3 py-2 text-xs font-semibold text-[#325f38]">
            {coords ? `Location ready (${coords.lat.toFixed(2)}, ${coords.lng.toFixed(2)})` : 'Location optional'}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {QUICK_PROMPTS.map((sample) => (
            <button
              key={sample}
              type="button"
              onClick={() => void sendPrompt(sample)}
              className="rounded-full border border-[#c8dcc4] bg-white/80 px-3 py-1.5 text-xs font-semibold text-[#355a36] transition hover:-translate-y-0.5 hover:bg-white"
            >
              {sample}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-5 rounded-[20px] border border-[#dbe8d8] bg-white/85 p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-5">
          <label className="text-xs font-semibold uppercase tracking-wide text-[#47664b]">
            Severity
            <select
              value={severityFilter}
              onChange={(event) => setSeverityFilter(event.target.value as 'all' | 'low' | 'medium' | 'high')}
              className="mt-1 h-10 w-full rounded-xl border border-[#c7dcc5] bg-white px-3 text-sm text-[#204027]"
            >
              <option value="all">All</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-[#47664b]">
            Crop
            <select
              value={cropFilter}
              onChange={(event) => setCropFilter(event.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-[#c7dcc5] bg-white px-3 text-sm text-[#204027]"
            >
              {cropOptions.map((item) => (
                <option key={item} value={item}>
                  {item === 'all' ? 'All crops' : item}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-[#47664b]">
            From
            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-[#c7dcc5] bg-white px-3 text-sm text-[#204027]"
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-[#47664b]">
            To
            <input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-[#c7dcc5] bg-white px-3 text-sm text-[#204027]"
            />
          </label>
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={exportAsJson}
              disabled={!exportRows.length}
              className="h-10 rounded-xl border border-[#c7dcc5] bg-white px-3 text-xs font-bold text-[#2c5a32] disabled:opacity-50"
            >
              Export JSON
            </button>
            <button
              type="button"
              onClick={exportAsCsv}
              disabled={!exportRows.length}
              className="h-10 rounded-xl border border-[#c7dcc5] bg-white px-3 text-xs font-bold text-[#2c5a32] disabled:opacity-50"
            >
              Export CSV
            </button>
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-[24px] border border-[#dbe8d8] bg-white/80 p-4 shadow-[0_12px_28px_rgba(31,64,43,0.08)] backdrop-blur-sm">
        <div className="max-h-[55vh] space-y-4 overflow-auto pr-1">
          {loadingHistory ? (
            <div className="rounded-2xl border border-[#e2ece0] bg-[#f8fbf7] p-4 text-sm text-[#4b6c4f]">Loading previous chat…</div>
          ) : visibleMessages.length ? (
            visibleMessages.map((item) => (
              <article key={item.id} className={`flex gap-3 ${item.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                {item.role === 'assistant' && (
                  <div className="mt-1 rounded-full bg-[#e8f6e2] p-2 text-[#2f6c34]">
                    <Bot size={16} />
                  </div>
                )}

                <div
                  className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                    item.role === 'user'
                      ? 'border border-[#cae4c0] bg-[linear-gradient(130deg,#ecffe8,#dff7d3)] text-[#1e3f24]'
                      : 'border border-[#d7e2ef] bg-[linear-gradient(130deg,#f8fcff,#eef5ff)] text-[#213a4e]'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{item.text}</p>

                  {item.role === 'assistant' && item.weather && (
                    <div className="mt-2 rounded-xl bg-white/70 px-3 py-2 text-xs text-[#365056]">
                      <p className="font-semibold">
                        Weather context: {item.weather.city}, {item.weather.tempC} C, rain {item.weather.rainChance24h}%
                      </p>
                    </div>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[#5a7083]">
                    {item.level && (
                      <span className="rounded-full border border-[#c6d4e6] bg-white/80 px-2 py-0.5 font-semibold uppercase">
                        {item.level} alert
                      </span>
                    )}
                    {item.model && (
                      <span className="rounded-full border border-[#c6d4e6] bg-white/80 px-2 py-0.5">Model: {item.model}</span>
                    )}
                    <span>{new Date(item.createdAt).toLocaleString()}</span>
                  </div>
                </div>

                {item.role === 'user' && (
                  <div className="mt-1 rounded-full bg-[#dff2da] p-2 text-[#2f6c34]">
                    <UserRound size={16} />
                  </div>
                )}
              </article>
            ))
          ) : (
            <div className="rounded-2xl border border-[#e2ece0] bg-[#f8fbf7] p-4 text-sm text-[#4b6c4f]">
              {hasActiveFilters ? 'No chat matches these filters.' : 'No AI chat yet. Ask your first farming question.'}
            </div>
          )}
        </div>

        {error && <div className="mt-3 rounded-xl border border-[#f2c9c2] bg-[#fff2ef] px-3 py-2 text-sm text-[#9d3c30]">{error}</div>}

        <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3 md:flex-row">
          <label className="sr-only" htmlFor="ai-query">Ask AI</label>
          <input
            id="ai-query"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Ask about crop, weather, disease, fertilizer, or market timing..."
            className="h-12 flex-1 rounded-2xl border border-[#c7dcc5] bg-white px-4 text-sm text-[#204027] outline-none transition focus:border-[#5d9964]"
          />
          <button
            type="submit"
            disabled={loading || !prompt.trim()}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#2c7d41,#4c9f5c)] px-5 text-sm font-bold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-65"
          >
            {loading ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />}
            {loading ? 'Thinking...' : 'Ask AI'}
          </button>
        </form>

        <p className="mt-2 flex items-center gap-2 text-xs text-[#4b6c4f]">
          <Sparkles size={14} />
          AI answers are guidance. Always verify local conditions before major farm operations.
        </p>
      </section>
    </div>
  );
}
