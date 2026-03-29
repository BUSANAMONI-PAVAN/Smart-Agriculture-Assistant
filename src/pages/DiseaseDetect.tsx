import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Bug, Upload, RefreshCw, History } from 'lucide-react';
import { api } from '../services/api';
import { createAlert, shouldTriggerAlert } from '../utils/alertEngine';
import { pushBrowserNotification } from '../utils/browserNotifications';

type DetectionResult = {
  nameKey: string;
  obsKey: string;
  cureKey: string;
  confidence: number;
  cause?: string;
  treatment?: string[];
  prevention?: string[];
  source?: string;
};

type ScanHistoryItem = {
  id: string;
  crop: string;
  diseaseKey: string;
  confidence: number;
  level: 'low' | 'medium' | 'high';
  createdAt: string;
};

const DISEASE_KEY_MAP: Record<string, { nameKey: string; obsKey: string; cureKey: string }> = {
  healthy: { nameKey: 'healthy', obsKey: 'healthy_msg', cureKey: 'healthy_msg' },
  leaf_blight: { nameKey: 'leaf_blight', obsKey: 'leaf_blight_obs', cureKey: 'leaf_blight_cure' },
  rust: { nameKey: 'leaf_blight', obsKey: 'leaf_blight_obs', cureKey: 'leaf_blight_cure' },
  powdery_mildew: {
    nameKey: 'powdery_mildew',
    obsKey: 'powdery_mildew_obs',
    cureKey: 'powdery_mildew_cure',
  },
  unknown: { nameKey: 'unknown_disease', obsKey: 'unknown_msg', cureKey: 'unknown_msg' },
};

export function DiseaseDetect() {
  const { t, language } = useLanguage();
  const [image, setImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => setImage(event.target?.result as string);
      reader.readAsDataURL(e.target.files[0]);
      setResult(null);
    }
  };

  const notify = (title: string, message: string) => {
    void pushBrowserNotification({
      type: 'disease',
      level: 'high',
      title,
      message,
      path: '/disease-detect',
    });
  };

  const sendManagerAlert = async (message: string) => {
    const managerWebhookUrl = localStorage.getItem('managerWebhookUrl');
    if (!managerWebhookUrl) return;

    try {
      await fetch(managerWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Disease Detection Alert', body: message, time: new Date().toISOString() }),
      });
    } catch {
      // Keep UI responsive even if manager webhook is unavailable.
    }
  };

  const preprocessImage = async (source: string): Promise<string> => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Image failed to load.'));
      img.src = source;
    });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported.');

    // Resize before upload to reduce bandwidth for rural networks.
    const maxSize = 512;
    const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL('image/jpeg', 0.82);
  };

  const localFallback = async (src: string): Promise<DetectionResult> => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Image failed to load.'));
      img.src = src;
    });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported.');

    const width = 240;
    const height = Math.max(1, Math.round((img.height / img.width) * width));
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(img, 0, 0, width, height);

    const pixels = ctx.getImageData(0, 0, width, height).data;
    let green = 0;
    let brown = 0;
    let yellow = 0;
    let white = 0;

    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];

      if (g > r + 20 && g > b + 20) green += 1;
      if (r > 85 && g > 45 && g < 150 && b < 100) brown += 1;
      if (r > 130 && g > 120 && b < 110) yellow += 1;
      if (r > 190 && g > 190 && b > 190) white += 1;
    }

    const total = pixels.length / 4;
    const brownRatio = brown / total;
    const yellowRatio = yellow / total;
    const whiteRatio = white / total;
    const greenRatio = green / total;

    if (whiteRatio > 0.16) {
      return {
        nameKey: 'powdery_mildew',
        obsKey: 'powdery_mildew_obs',
        cureKey: 'powdery_mildew_cure',
        confidence: Math.min(92, Math.round(68 + whiteRatio * 100)),
        source: 'local-fallback',
      };
    }

    if (brownRatio + yellowRatio > 0.18) {
      return {
        nameKey: 'leaf_blight',
        obsKey: 'leaf_blight_obs',
        cureKey: 'leaf_blight_cure',
        confidence: Math.min(90, Math.round(70 + (brownRatio + yellowRatio) * 100)),
        source: 'local-fallback',
      };
    }

    if (greenRatio > 0.4) {
      return {
        nameKey: 'healthy',
        obsKey: 'healthy_msg',
        cureKey: 'healthy_msg',
        confidence: Math.min(90, Math.round(70 + greenRatio * 35)),
        source: 'local-fallback',
      };
    }

    return {
      nameKey: 'unknown_disease',
      obsKey: 'unknown_msg',
      cureKey: 'unknown_msg',
      confidence: 58,
      source: 'local-fallback',
    };
  };

  const loadHistory = async () => {
    try {
      const response = await api.getDiseaseHistory();
      const mapped = response.scans.slice(0, 8).map((scan) => ({
        id: scan.id,
        crop: scan.crop,
        diseaseKey: scan.diseaseKey,
        confidence: scan.confidence,
        level: scan.level,
        createdAt: scan.createdAt,
      }));
      setScanHistory(mapped);
    } catch {
      setScanHistory([]);
    }
  };

  useEffect(() => {
    void loadHistory();
  }, []);

  const analyze = async () => {
    if (!image) return;
    setAnalyzing(true);

    try {
      const preprocessedImage = await preprocessImage(image);
      const crop = localStorage.getItem('primaryCrop') || 'unknown';

      const backendResult = await api.analyzeDisease({ imageData: preprocessedImage, crop });
      const mappedKeys = DISEASE_KEY_MAP[backendResult.prediction.diseaseKey] || DISEASE_KEY_MAP.unknown;
      const detection: DetectionResult = {
        ...mappedKeys,
        confidence: backendResult.prediction.confidence,
        cause: backendResult.prediction.cause,
        treatment: backendResult.prediction.treatment,
        prevention: backendResult.prediction.prevention,
        source: backendResult.prediction.source,
      };
      setResult(detection);

      const diseaseText = t(detection.nameKey);
      const level = backendResult.prediction.level;
      const signature = `disease-${backendResult.prediction.diseaseKey}-${Math.round(detection.confidence / 5)}`;

      if (shouldTriggerAlert(signature, level)) {
        notify(
          detection.nameKey === 'healthy' ? 'Plant health looks stable' : `${diseaseText} review needed`,
          `Confidence ${detection.confidence}%. ${backendResult.prediction.cause || 'Inspect leaves and begin the suggested treatment plan.'}`,
        );
        void sendManagerAlert(`Detected: ${diseaseText} | Confidence: ${detection.confidence}%`);
        createAlert({
          type: 'disease',
          level,
          message: `${diseaseText} detected with ${detection.confidence}% confidence`,
        });
        void api.ingestAlert({
          type: 'disease',
          level,
          title: detection.nameKey === 'healthy' ? 'Plant Health Update' : 'Disease Risk Detected',
          message: `${diseaseText} detected with ${detection.confidence}% confidence`,
          source: 'web-farmer-disease-ai',
          metadata: {
            diseaseKey: backendResult.prediction.diseaseKey,
            confidence: detection.confidence,
            fingerprint: signature,
            inferenceSource: detection.source,
          },
        });
      }
    } catch {
      try {
        const fallbackResult = await localFallback(image);
        setResult(fallbackResult);
      } catch {
        setResult({
          nameKey: 'unknown_disease',
          obsKey: 'unknown_msg',
          cureKey: 'unknown_msg',
          confidence: 55,
          source: 'local-fallback',
        });
      }
    } finally {
      setAnalyzing(false);
      void loadHistory();
    }
  };

  return (
    <div className="container mx-auto max-w-5xl p-4">
      <h1 className="mb-6 flex items-center gap-2 text-3xl font-bold">
        <Bug className="text-red-600" />
        {t('disease_detection')}
      </h1>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-red-50 bg-white p-6 shadow-lg lg:col-span-2">
          {!image ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex h-64 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 transition-colors hover:bg-gray-50"
            >
              <Upload size={48} className="mb-2 text-gray-400" />
              <span className="font-medium text-gray-500">{t('upload_image')}</span>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleUpload}
              />
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-lg border border-gray-200">
              <img src={image} alt="Uploaded leaf" className="h-64 w-full object-cover" />
              <button
                onClick={() => {
                  setImage(null);
                  setResult(null);
                }}
                className="absolute right-2 top-2 rounded-full bg-white/90 p-2 text-red-600 shadow-md hover:bg-white"
              >
                <RefreshCw size={20} />
              </button>
            </div>
          )}

          {image && !result && (
            <button
              onClick={() => void analyze()}
              disabled={analyzing}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 py-3 font-bold text-white shadow-lg transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              {analyzing ? (
                <>
                  {t('analyzing')} <RefreshCw className="animate-spin" />
                </>
              ) : (
                t('analyze_button')
              )}
            </button>
          )}

          {result && (
            <div className="animate-fade-in mt-6 rounded-lg border border-red-100 bg-red-50 p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-2xl font-bold text-red-800">{t(result.nameKey)}</h2>
                <span className="rounded-full bg-red-200 px-3 py-1 text-sm font-bold text-red-800">
                  {result.confidence}% {t('confidence')}
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="mb-1 font-bold text-gray-700">{t('observation')}:</h4>
                  <p className="text-gray-600">{t(result.obsKey)}</p>
                </div>

                <div className="rounded-lg border border-red-100 bg-white p-4 shadow-sm">
                  <h4 className="mb-2 font-bold text-green-700">{t('recommended_cure')}:</h4>
                  <ul className="list-inside list-disc space-y-1 text-gray-700">
                    <li>{t(result.cureKey)}</li>
                    {(result.treatment || []).slice(0, 2).map((tip, idx) => (
                      <li key={`${tip}-${idx}`}>{tip}</li>
                    ))}
                  </ul>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">
                    {language === 'te' ? 'డేటా మూలం' : 'Inference source'}: {result.source || 'unknown'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowDetails((value) => !value)}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    {showDetails ? (language === 'te' ? 'వివరాలు దాచు' : 'Hide details') : (language === 'te' ? 'వివరాలు చూపు' : 'Show details')}
                  </button>
                </div>

                {showDetails && (
                  <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700">
                    <p className="mb-2"><span className="font-semibold">Cause:</span> {result.cause || '-'}</p>
                    <p className="mb-1 font-semibold">Prevention:</p>
                    <ul className="list-inside list-disc space-y-1">
                      {(result.prevention || []).map((tip) => (
                        <li key={tip}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <aside className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gray-800">
            <History size={18} />
            {language === 'te' ? 'తాజా స్కాన్‌లు' : 'Recent scans'}
          </h3>
          <div className="space-y-2">
            {scanHistory.length === 0 ? (
              <p className="text-sm text-gray-500">{language === 'te' ? 'చరిత్ర అందుబాటులో లేదు.' : 'No scan history yet.'}</p>
            ) : (
              scanHistory.map((scan) => {
                const mapped = DISEASE_KEY_MAP[scan.diseaseKey] || DISEASE_KEY_MAP.unknown;
                return (
                  <div key={scan.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm">
                    <p className="font-semibold text-gray-800">{t(mapped.nameKey)}</p>
                    <p className="text-xs text-gray-600">{scan.confidence}% confidence</p>
                    <p className="text-xs text-gray-500">{new Date(scan.createdAt).toLocaleString()}</p>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
