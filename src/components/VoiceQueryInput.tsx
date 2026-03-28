import { Mic, MicOff } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

type VoiceQueryInputProps = {
  onQuery: (query: string) => void;
};

type SpeechRecognitionCtor = new () => {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

export function VoiceQueryInput({ onQuery }: VoiceQueryInputProps) {
  const { language } = useLanguage();
  const [value, setValue] = useState('');
  const [listening, setListening] = useState(false);

  const recognitionCtor = useMemo(() => {
    const windowRef = window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor; SpeechRecognition?: SpeechRecognitionCtor };
    return windowRef.SpeechRecognition || windowRef.webkitSpeechRecognition;
  }, []);

  const startListening = () => {
    if (!recognitionCtor) return;
    const recognition = new recognitionCtor();
    recognition.lang = language === 'te' ? 'te-IN' : 'en-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    setListening(true);

    recognition.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript || '';
      setValue(text);
      onQuery(text);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.start();
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      <label className="mb-2 block text-sm font-medium text-gray-700">
        {language === 'te' ? 'వాయిస్ ప్రశ్న' : 'Voice Query'}
      </label>
      <div className="flex items-center gap-2">
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={language === 'te' ? 'ఉదా: ఈరోజు ఏ పంట వేయాలి?' : 'Example: Which crop should I sow today?'}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={startListening}
          disabled={!recognitionCtor}
          className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-40"
        >
          {listening ? <MicOff size={16} /> : <Mic size={16} />}
          {language === 'te' ? 'మాట్లాడు' : 'Speak'}
        </button>
        <button
          type="button"
          onClick={() => onQuery(value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          {language === 'te' ? 'అడుగు' : 'Ask'}
        </button>
      </div>
    </div>
  );
}