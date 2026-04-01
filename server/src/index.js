import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import createTables from './db/schema.js';
import authRoutes from './routes/auth.js';
import customerRoutes from './routes/customers.js';
import manualRoutes from './routes/manuals.js';
import orderRoutes from './routes/orders.js';
import checklistRoutes from './routes/checklists.js';
import chatRoutes from './routes/chat.js';
import ncrRoutes from './routes/ncr.js';
import tpqcRoutes from './routes/tpqc.js';
import dashboardRoutes from './routes/dashboard.js';
import userRoutes from './routes/users.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json({ limit: '50mb' }));
app.use('/storage', express.static(path.join(__dirname, '..', process.env.STORAGE_PATH || 'storage')));

// Serve client build in production
const clientBuild = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientBuild));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/manuals', manualRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/checklists', checklistRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/ncr', ncrRoutes);
app.use('/api/tp-qc', tpqcRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', userRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// SPA fallback
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(clientBuild, 'index.html'));
  }
});

// Initialize
async function start() {
  try {
    await createTables();
    console.log('Database tables ready');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`QualityLens server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start:', err);
    process.exit(1);
  }
}

start();
