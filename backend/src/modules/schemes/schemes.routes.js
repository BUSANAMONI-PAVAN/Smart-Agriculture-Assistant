import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ schemes: [] });
});

export const schemesRouter = router;
