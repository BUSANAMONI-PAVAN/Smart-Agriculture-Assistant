import { Router } from 'express';

const router = Router();

router.get('/sources', (_req, res) => {
  res.json({
    modules: [
      {
        module: 'weather-intelligence',
        sources: ['open-meteo', 'osm-reverse-geocode'],
        confidenceRange: '0.74-0.92',
      },
      {
        module: 'crop-recommendation',
        sources: ['soil-profile', 'seasonal-rule-engine', 'weather-snapshot'],
        confidenceRange: '0.68-0.87',
      },
      {
        module: 'disease-detection',
        sources: ['uploaded-image', 'ai-model-or-rule-adapter'],
        confidenceRange: '0.55-0.95',
      },
      {
        module: 'market-intelligence',
        sources: ['market-benchmark-series', 'distance-logistics-model'],
        confidenceRange: '0.61-0.84',
      },
    ],
    generatedAt: new Date().toISOString(),
  });
});

export const transparencyRouter = router;
