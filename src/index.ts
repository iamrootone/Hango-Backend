import { Hono } from 'hono';
import { cors } from 'hono/cors';
import authRoutes from './routes/auth.js';
import vocabularyRoutes from './routes/vocabulary.js';
import aiChatRoutes from './routes/ai-chat.js';

const app = new Hono();

// CORS middleware
app.use('*', cors({
  origin: '*', // In production, restrict to your app's domain
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Health check
app.get('/', (c) => {
  return c.json({ status: 'ok', message: 'HanGo API is running' });
});

// Routes
app.route('/auth', authRoutes);
app.route('/vocabulary', vocabularyRoutes);
app.route('/ai', aiChatRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

export default app;
