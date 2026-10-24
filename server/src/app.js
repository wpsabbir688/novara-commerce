import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { prisma } from './db/prisma.js';
import { loadUser } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authRouter } from './routes/auth.js';
import { productsRouter } from './routes/products.js';
import { categoriesRouter } from './routes/categories.js';
import { brandsRouter } from './routes/brands.js';
import { cartRouter } from './routes/cart.js';
import { wishlistRouter } from './routes/wishlist.js';
import { checkoutRouter } from './routes/checkout.js';
import { ordersRouter } from './routes/orders.js';
import { paymentsRouter, webhooksRouter } from './routes/payments.js';
import { reviewsRouter } from './routes/reviews.js';
import { adminRouter } from './routes/admin.js';
import { accountRouter } from './routes/account.js';
import { publicRouter } from './routes/public.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.use(cors({ origin: env.clientUrl, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(loadUser);

  app.get('/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ ok: true, db: 'up' });
    } catch {
      res.status(503).json({ ok: false, db: 'down' });
    }
  });

  const v1 = express.Router();
  v1.use('/auth', authRouter);
  v1.use('/products', productsRouter);
  v1.use('/categories', categoriesRouter);
  v1.use('/brands', brandsRouter);
  v1.use('/cart', cartRouter);
  v1.use('/wishlist', wishlistRouter);
  v1.use('/checkout', checkoutRouter);
  v1.use('/orders', ordersRouter);
  v1.use('/payments', paymentsRouter);
  v1.use('/reviews', reviewsRouter);
  v1.use('/admin', adminRouter);
  v1.use('/account', accountRouter);
  v1.use('/public', publicRouter);
  app.use('/api/v1', v1);
  app.use('/api/v1/webhooks', webhooksRouter);

  app.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }));
  app.use(errorHandler);
  return app;
}
