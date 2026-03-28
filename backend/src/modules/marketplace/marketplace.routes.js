import { Router } from 'express';
import { z } from 'zod';
import { addMarketplaceOrder, listEquipment, listInputs, listOrders } from './marketplace.store.js';
import { validateRequest } from '../../lib/validate.js';

const router = Router();

const orderBodySchema = z.object({
  itemId: z.string().trim().min(1).max(80),
  quantity: z.number().min(1).max(1000),
  orderType: z.enum(['input', 'rental']),
}).strict();

const optionalUserQuerySchema = z.object({
  userId: z.string().trim().min(1).max(64).optional(),
});

function user(req) {
  return String(req.headers['x-user-id'] || req.query.userId || 'anonymous');
}

router.get('/inputs', (_req, res) => {
  res.json({ items: listInputs() });
});

router.get('/rentals', (_req, res) => {
  res.json({ items: listEquipment() });
});

router.post('/orders', validateRequest({ body: orderBodySchema }), (req, res) => {
  const order = addMarketplaceOrder({ ...req.body, userId: user(req) });
  res.status(201).json({ message: 'Order request created', order });
});

router.get('/orders', validateRequest({ query: optionalUserQuerySchema }), (req, res) => {
  res.json({ orders: listOrders(user(req)) });
});

export const marketplaceRouter = router;
