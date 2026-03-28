import { Router } from 'express';
import { z } from 'zod';
import { createPost, listModerationQueue, listPosts } from './community.store.js';
import { validateRequest } from '../../lib/validate.js';

const router = Router();

const createPostBodySchema = z.object({
  text: z.string().trim().min(1).max(1200),
  imageUrl: z.string().trim().url().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(8).optional(),
}).strict();

router.get('/posts', (_req, res) => {
  res.json({ posts: listPosts() });
});

router.post('/posts', validateRequest({ body: createPostBodySchema }), (req, res) => {
  const userId = String(req.headers['x-user-id'] || 'anonymous');
  const post = createPost({ ...req.body, userId });
  res.status(201).json({ message: 'Post created', post });
});

router.get('/moderation', (_req, res) => {
  res.json({ queue: listModerationQueue() });
});

export const communityRouter = router;
